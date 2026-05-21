from contextlib import asynccontextmanager
import time

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.routes import api_router
from app.config import settings
from app.scheduler.reminders import start_scheduler, stop_scheduler
from app.logging_config import setup_logging, request_logger
from app.middleware.rate_limiter import limiter, _rate_limit_exceeded_handler, RateLimitExceeded
from app.exceptions.handlers import setup_exception_handlers

# Inicializar Sentry
if settings.SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastAPIIntegration
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            integrations=[FastAPIIntegration()],
            traces_sample_rate=1.0,
            environment=settings.ENVIRONMENT,
        )
    except Exception as exc:
        print(f"[Sentry Init Error] Failed to initialize Sentry: {exc}")



# Middleware para logging de requests
class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # Obtener información del request
        method = request.method
        path = request.url.path
        client_ip = request.client.host
        
        try:
            response = await call_next(request)
            process_time = (time.time() - start_time) * 1000
            
            # Log del request exitoso
            request_logger.log_request(
                method=method,
                path=path,
                status_code=response.status_code,
                response_time_ms=process_time,
                ip_address=client_ip
            )
            
            # Agregar header de tiempo de respuesta
            response.headers["X-Process-Time"] = str(process_time)
            return response
            
        except Exception as e:
            process_time = (time.time() - start_time) * 1000
            
            # Log del error
            request_logger.log_error(
                method=method,
                path=path,
                error=str(e),
                ip_address=client_ip
            )
            
            # Re-lanzar la excepción para que FastAPI la maneje
            raise


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Setup logging
    setup_logging()
    
    # Startup
    start_scheduler()
    yield
    # Shutdown
    stop_scheduler()


app = FastAPI(
    title="MotoStock API",
    description="Backend API for MotoStock inventory and sales management system.",
    version="1.0.0",
    lifespan=lifespan,
)

# Configurar rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configurar manejadores de excepciones
setup_exception_handlers(app)

# Agregar middleware de logging primero
app.add_middleware(LoggingMiddleware)

# CORS config
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")

@app.get("/health")
def health_check():
    """Health check completo con información del sistema."""
    from app.database import engine
    from app.logging_config import get_logger
    import psutil
    import platform
    from datetime import datetime
    
    logger = get_logger("health")
    
    try:
        # Verificar conexión a base de datos
        with engine.connect() as conn:
            db_status = "connected"
            db_check_time = datetime.utcnow().isoformat()
    except Exception as e:
        logger.error("Database health check failed", error=str(e))
        db_status = "disconnected"
        db_check_time = None
    
    # Información del sistema
    system_info = {
        "platform": platform.system(),
        "platform_release": platform.release(),
        "platform_version": platform.version(),
        "architecture": platform.machine(),
        "hostname": platform.node(),
        "processor": platform.processor(),
    }
    
    # Recursos del sistema
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    
    health_data = {
        "status": "healthy" if db_status == "connected" else "unhealthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
        "services": {
            "database": {
                "status": db_status,
                "last_check": db_check_time
            },
            "api": {
                "status": "running",
                "uptime_seconds": psutil.boot_time()
            }
        },
        "system": {
            **system_info,
            "memory_usage_percent": memory.percent,
            "memory_available_gb": round(memory.available / (1024**3), 2),
            "disk_usage_percent": round((disk.used / disk.total) * 100, 2),
            "disk_free_gb": round(disk.free / (1024**3), 2),
            "cpu_percent": psutil.cpu_percent(interval=1)
        }
    }
    
    # Log del health check
    logger.info("Health check performed", **health_data)
    
    return health_data


@app.get("/health/ready")
def readiness_check():
    """Readiness check para Kubernetes/Docker."""
    from sqlalchemy import text

    try:
        from app.database import engine
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ready"}
    except Exception:
        return {"status": "not_ready"}, 503


@app.get("/health/live")
def liveness_check():
    """Liveness check para Kubernetes/Docker."""
    from datetime import datetime

    return {"status": "alive", "timestamp": datetime.utcnow().isoformat()}
