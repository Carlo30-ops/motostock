"""Rate limiting middleware para proteger la API contra abusos."""

import time
from typing import Dict, Optional
from fastapi import Request, HTTPException, status
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
import redis
from app.logging_config import get_logger
from app.config import settings

logger = get_logger("rate_limiter")


def _redis_storage_uri() -> str:
    password = (settings.REDIS_PASSWORD or "").strip()
    auth = f":{password}@" if password else ""
    return f"redis://{auth}{settings.REDIS_HOST}:{settings.REDIS_PORT}/{settings.REDIS_DB}"


# SlowAPI: en producción usar Redis si responde al ping; si no, memoria.
try:
    _redis_test = redis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        db=settings.REDIS_DB,
        password=(settings.REDIS_PASSWORD or None) or None,
        decode_responses=True,
    )
    _redis_test.ping()
    if settings.ENVIRONMENT == "production":
        limiter = Limiter(
            key_func=get_remote_address,
            storage_uri=_redis_storage_uri(),
        )
        logger.info(
            "Rate limiting configurado con Redis",
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
        )
    else:
        limiter = Limiter(key_func=get_remote_address, storage_uri="memory://")
        logger.info("Rate limiting en memoria (solo producción usa Redis)")
except Exception as e:
    limiter = Limiter(key_func=get_remote_address, storage_uri="memory://")
    logger.warning("Rate limiting configurado con memoria (Redis no disponible)", error=str(e))

# Límites por defecto
DEFAULT_LIMITS = {
    "global": "100/minute",  # 100 requests por minuto por IP
    "auth": "5/minute",      # 5 intentos de login por minuto
    "api": "60/minute",      # 60 requests por minuto para endpoints de API
    "upload": "10/minute",   # 10 uploads por minuto
}

class RateLimitConfig:
    """Configuración de rate limits por endpoint."""
    
    @staticmethod
    def get_limit(endpoint: str) -> str:
        """Obtener el límite de rate para un endpoint específico."""
        if "/auth" in endpoint:
            return DEFAULT_LIMITS["auth"]
        elif "/upload" in endpoint or "/invoices" in endpoint:
            return DEFAULT_LIMITS["upload"]
        elif endpoint.startswith("/api/"):
            return DEFAULT_LIMITS["api"]
        else:
            return DEFAULT_LIMITS["global"]

class AdvancedRateLimiter:
    """Rate limiter avanzado con diferentes estrategias."""
    
    def __init__(self):
        self.requests: Dict[str, list] = {}
        self.blocked_ips: Dict[str, float] = {}  # IP -> timestamp de bloqueo
        
    def is_blocked(self, ip: str) -> bool:
        """Verificar si una IP está temporalmente bloqueada."""
        if ip in self.blocked_ips:
            if time.time() > self.blocked_ips[ip]:
                del self.blocked_ips[ip]
                return False
            return True
        return False
    
    def block_ip(self, ip: str, duration_minutes: int = 15):
        """Bloquear una IP temporalmente."""
        self.blocked_ips[ip] = time.time() + (duration_minutes * 60)
        logger.warning("IP bloqueada temporalmente", ip=ip, duration_minutes=duration_minutes)
    
    def check_rate_limit(self, ip: str, limit: str) -> bool:
        """Verificar si se excede el límite de requests."""
        if self.is_blocked(ip):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="IP temporalmente bloqueada por exceder límites"
            )
        
        # Parsear límite (ej: "100/minute")
        try:
            max_requests, period = limit.split("/")
            max_requests = int(max_requests)
            
            # Convertir período a segundos
            if period == "minute":
                period_seconds = 60
            elif period == "hour":
                period_seconds = 3600
            elif period == "second":
                period_seconds = 1
            else:
                period_seconds = 60  # Default a minuto
            
        except ValueError:
            logger.error("Formato de rate limit inválido", limit=limit)
            return True
        
        now = time.time()
        
        # Inicializar lista de timestamps para esta IP
        if ip not in self.requests:
            self.requests[ip] = []
        
        # Remover timestamps antiguos (fuera del período)
        self.requests[ip] = [
            timestamp for timestamp in self.requests[ip]
            if now - timestamp < period_seconds
        ]
        
        # Verificar límite
        if len(self.requests[ip]) >= max_requests:
            # Bloquear IP si excede significativamente el límite
            if len(self.requests[ip]) > max_requests * 2:
                self.block_ip(ip)
            
            logger.warning("Rate limit excedido", 
                         ip=ip, 
                         current_requests=len(self.requests[ip]),
                         max_requests=max_requests,
                         period=period)
            
            return False
        
        # Agregar timestamp actual
        self.requests[ip].append(now)
        return True

# Instancia global del rate limiter avanzado
advanced_limiter = AdvancedRateLimiter()

def rate_limit_middleware(request: Request, call_next):
    """Middleware de rate limiting personalizado."""
    ip = get_remote_address(request)
    endpoint = request.url.path
    
    # Obtener límite para este endpoint
    limit = RateLimitConfig.get_limit(endpoint)
    
    # Verificar rate limit
    if not advanced_limiter.check_rate_limit(ip, limit):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": "Rate limit exceeded",
                "limit": limit,
                "retry_after": 60  # segundos
            }
        )
    
    # Continuar con la request
    response = call_next(request)
    
    # Agregar headers de rate limiting
    response.headers["X-RateLimit-Limit"] = limit
    response.headers["X-RateLimit-Remaining"] = str(max(0, 100 - len(advanced_limiter.requests.get(ip, []))))
    
    return response

# Decoradores para uso fácil
def rate_limit(limit: str):
    """Decorador para aplicar rate limit a un endpoint específico."""
    def decorator(func):
        return limiter.limit(limit)(func)
    return decorator

# Excepción personalizada para rate limiting
class RateLimitException(HTTPException):
    def __init__(self, detail: str, retry_after: int = 60):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail,
            headers={"Retry-After": str(retry_after)}
        )
