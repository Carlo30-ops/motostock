from fastapi import APIRouter, Request
from app.config import settings
from app.database import engine
from app.logging_config import get_logger
import psutil
import platform
from datetime import datetime
from sqlalchemy import text

router = APIRouter()
logger = get_logger("health")

@router.get("")
def health_check():
    """Health check completo con información del sistema."""
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


@router.get("/ready")
def readiness_check():
    """Readiness check para Kubernetes/Docker."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ready"}
    except Exception:
        return {"status": "not_ready"}, 503


@router.get("/live")
def liveness_check():
    """Liveness check para Kubernetes/Docker."""
    return {"status": "alive", "timestamp": datetime.utcnow().isoformat()}
