from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import api_router
from app.config import settings
from app.scheduler.reminders import start_scheduler, stop_scheduler
from app.logging_config import setup_logging
from app.middleware.rate_limiter import limiter, _rate_limit_exceeded_handler, RateLimitExceeded
from app.middleware.security import SecurityHeadersMiddleware
from app.middleware.saas_context import SaaSContextMiddleware
from app.middleware.tenant import TenantContextMiddleware
from app.exceptions.handlers import setup_exception_handlers

# Configure Sentry
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

# Middlewares (Order is important)
app.add_middleware(SaaSContextMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(TenantContextMiddleware)

# CORS config
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(api_router, prefix="/api")
