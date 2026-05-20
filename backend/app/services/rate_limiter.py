"""
Servicio de Rate Limiting Avanzado
Implementación de rate limiting con Redis para protección contra ataques
"""

import redis
import json
import time
from typing import Dict, Optional, Tuple, Any
from datetime import datetime, timedelta
from functools import wraps
from fastapi import HTTPException, status, Request
from sqlalchemy.orm import Session

from app.config import Settings


class RateLimitExceeded(HTTPException):
    """Excepción personalizada para rate limiting"""
    def __init__(self, limit: int, window: int, retry_after: int):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Maximum {limit} requests per {window} seconds.",
            headers={
                "Retry-After": str(retry_after),
                "X-RateLimit-Limit": str(limit),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(int(time.time()) + window)
            }
        )


class RedisRateLimiter:
    """Implementación de rate limiting con Redis"""
    
    def __init__(self):
        self.redis_client = None
        self._connect_redis()
    
    def _connect_redis(self):
        """Conecta a Redis"""
        try:
            settings = Settings()
            self.redis_client = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                password=settings.REDIS_PASSWORD,
                db=settings.REDIS_DB,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30
            )
            
            # Test connection
            self.redis_client.ping()
            
        except Exception as e:
            print(f"Error conectando a Redis: {e}")
            # Fallback a memoria local si Redis no está disponible
            self.redis_client = None
    
    def is_connected(self) -> bool:
        """Verifica si Redis está conectado"""
        try:
            return self.redis_client and self.redis_client.ping()
        except:
            return False
    
    def _get_key(self, key: str) -> str:
        """Genera clave para Redis"""
        return f"rate_limit:{key}"
    
    def _get_window_key(self, key: str, window: int) -> str:
        """Genera clave con timestamp para ventana deslizante"""
        current_time = int(time.time())
        window_start = current_time - (current_time % window)
        return f"{self._get_key(key)}:{window_start}"
    
    def is_allowed(
        self, 
        key: str, 
        limit: int, 
        window: int,
        identifier: Optional[str] = None
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Verifica si una petición está permitida bajo el rate limit
        
        Args:
            key: Clave única para el rate limit (ej: 'api', 'auth', 'upload')
            limit: Límite de peticiones permitidas
            window: Ventana de tiempo en segundos
            identifier: Identificador único (IP, user_id, etc.)
        
        Returns:
            Tuple[bool, Dict]: (permitido, información adicional)
        """
        if not self.is_connected():
            # Si Redis no está disponible, permitir todo (fallback)
            return True, {"fallback": True, "reason": "Redis unavailable"}
        
        # Construir clave completa
        full_key = f"{key}:{identifier}" if identifier else key
        
        # Usar sliding window para mayor precisión
        window_key = self._get_window_key(full_key, window)
        current_time = int(time.time())
        
        try:
            # Usar pipeline para atomicidad
            pipe = self.redis_client.pipeline()
            
            # Limpiar claves antiguas (cleanup)
            pipe.zremrangebyscore(window_key, 0, current_time - window)
            
            # Agregar petición actual
            pipe.zadd(window_key, {str(current_time): current_time})
            
            # Contar peticiones en la ventana
            pipe.zcard(window_key)
            
            # Establecer expiración para la clave
            pipe.expire(window_key, window + 60)  # Extra 60s para cleanup
            
            results = pipe.execute()
            request_count = results[2]
            
            remaining = max(0, limit - request_count)
            reset_time = current_time + window
            
            return request_count < limit, {
                "limit": limit,
                "remaining": remaining,
                "reset_time": reset_time,
                "request_count": request_count,
                "window": window
            }
            
        except Exception as e:
            print(f"Error en rate limiting: {e}")
            # Fallback: permitir si hay error
            return True, {"fallback": True, "reason": str(e)}
    
    def get_rate_limit_status(
        self, 
        key: str, 
        identifier: Optional[str] = None
    ) -> Dict[str, Any]:
        """Obtiene estado actual de rate limit"""
        if not self.is_connected():
            return {"fallback": True, "reason": "Redis unavailable"}
        
        full_key = f"{key}:{identifier}" if identifier else key
        
        try:
            # Buscar todas las ventanas activas
            pattern = f"{self._get_key(full_key)}:*"
            keys = self.redis_client.keys(pattern)
            
            if not keys:
                return {"limit": 0, "remaining": 0, "reset_time": 0}
            
            total_requests = 0
            latest_reset = 0
            
            for key in keys:
                # Contar peticiones en cada ventana
                count = self.redis_client.zcard(key)
                total_requests += count
                
                # Obtener timestamp de reset más reciente
                key_parts = key.split(':')
                if len(key_parts) > 2:
                    try:
                        reset_time = int(key_parts[-1])
                        latest_reset = max(latest_reset, reset_time)
                    except ValueError:
                        continue
            
            return {
                "total_requests": total_requests,
                "latest_reset": latest_reset,
                "keys_found": len(keys)
            }
            
        except Exception as e:
            return {"error": str(e)}
    
    def reset_rate_limit(self, key: str, identifier: Optional[str] = None):
        """Resetea el rate limit para una clave específica"""
        if not self.is_connected():
            return False
        
        full_key = f"{key}:{identifier}" if identifier else key
        pattern = f"{self._get_key(full_key)}:*"
        
        try:
            keys = self.redis_client.keys(pattern)
            if keys:
                self.redis_client.delete(*keys)
            return True
        except Exception as e:
            print(f"Error reseteando rate limit: {e}")
            return False


# Instancia global del rate limiter
rate_limiter = RedisRateLimiter()


def rate_limit(
    key: str,
    limit: int,
    window: int,
    identifier_func: Optional[callable] = None
):
    """
    Decorador para aplicar rate limiting a endpoints FastAPI
    
    Args:
        key: Clave para el rate limit
        limit: Límite de peticiones
        window: Ventana de tiempo en segundos
        identifier_func: Función para generar identificador único
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Obtener request de los argumentos
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            
            if not request:
                # Buscar en kwargs
                request = kwargs.get('request')
            
            # Generar identificador
            identifier = None
            if identifier_func:
                identifier = identifier_func(request)
            
            # Verificar rate limit
            allowed, info = rate_limiter.is_allowed(key, limit, window, identifier)
            
            # Agregar headers de rate limit a la respuesta
            if hasattr(request, 'state'):
                request.state.rate_limit_info = info
            
            if not allowed:
                retry_after = info.get('reset_time', int(time.time())) + window
                raise RateLimitExceeded(limit, window, retry_after)
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


# Funciones de identificador comunes
def get_ip_identifier(request: Request) -> str:
    """Obtiene IP del cliente como identificador"""
    # Proxy headers comunes
    forwarded_for = request.headers.get("X-Forwarded-For")
    real_ip = request.headers.get("X-Real-IP")
    
    if forwarded_for:
        ip = forwarded_for.split(",")[0].strip()
    elif real_ip:
        ip = real_ip
    else:
        ip = request.client.host if request.client else "unknown"
    
    return f"ip:{ip}"


def get_user_identifier(request: Request) -> str:
    """Obtiene ID de usuario como identificador"""
    # Intentar obtener usuario del request
    if hasattr(request, 'state') and hasattr(request.state, 'user'):
        user_id = getattr(request.state, 'user', {}).get('id')
        if user_id:
            return f"user:{user_id}"
    
    # Fallback a IP si no hay usuario
    return get_ip_identifier(request)


def get_endpoint_identifier(request: Request) -> str:
    """Obtiene endpoint como identificador"""
    return f"endpoint:{request.url.path}"


def get_combined_identifier(request: Request) -> str:
    """Combina múltiples identificadores"""
    ip_id = get_ip_identifier(request)
    endpoint_id = get_endpoint_identifier(request)
    return f"{ip_id}:{endpoint_id}"


# Rate limits predefinidos para diferentes tipos de endpoints
RATE_LIMITS = {
    # Límites muy restrictivos para autenticación
    "auth_login": {"limit": 5, "window": 300},  # 5 intentos en 5 minutos
    "auth_register": {"limit": 3, "window": 3600},  # 3 registros en 1 hora
    "auth_forgot": {"limit": 3, "window": 3600},  # 3 recuperaciones en 1 hora
    "auth_2fa": {"limit": 10, "window": 300},  # 10 intentos 2FA en 5 minutos
    
    # Límites moderados para API general
    "api_default": {"limit": 60, "window": 60},  # 60 requests por minuto
    "api_search": {"limit": 30, "window": 60},  # 30 búsquedas por minuto
    "api_upload": {"limit": 10, "window": 60},  # 10 uploads por minuto
    
    # Límites específicos para operaciones críticas
    "pos_sale": {"limit": 20, "window": 60},  # 20 ventas por minuto
    "inventory_update": {"limit": 30, "window": 60},  # 30 actualizaciones por minuto
    "report_generate": {"limit": 5, "window": 300},  # 5 reportes en 5 minutos
}


def get_rate_limit_config(key: str) -> Dict[str, int]:
    """Obtiene configuración de rate limit para una clave"""
    return RATE_LIMITS.get(key, RATE_LIMITS["api_default"])


def apply_rate_limit_middleware(request: Request, call_next):
    """
    Middleware para aplicar rate limiting global
    """
    # Rate limiting global por IP
    allowed, info = rate_limiter.is_allowed(
        key="global",
        limit=100,  # 100 requests por minuto global
        window=60,
        identifier=get_ip_identifier(request)
    )
    
    if not allowed:
        raise RateLimitExceeded(100, 60, info.get('reset_time', int(time.time())) + 60)
    
    # Guardar información para headers
    request.state.global_rate_limit = info
    
    return call_next(request)


class RateLimitService:
    """Servicio de alto nivel para gestión de rate limiting"""
    
    def __init__(self):
        self.limiter = rate_limiter
    
    def check_rate_limit(
        self, 
        key: str, 
        identifier: Optional[str] = None,
        custom_limit: Optional[int] = None,
        custom_window: Optional[int] = None
    ) -> Tuple[bool, Dict[str, Any]]:
        """Verifica rate limit con configuración personalizada"""
        config = get_rate_limit_config(key)
        limit = custom_limit or config["limit"]
        window = custom_window or config["window"]
        
        return self.limiter.is_allowed(key, limit, window, identifier)
    
    def get_user_rate_limits(self, user_id: int) -> Dict[str, Any]:
        """Obtiene todos los rate limits para un usuario"""
        user_identifier = f"user:{user_id}"
        limits = {}
        
        for key in RATE_LIMITS.keys():
            status = self.limiter.get_rate_limit_status(key, user_identifier)
            limits[key] = status
        
        return limits
    
    def reset_user_limits(self, user_id: int):
        """Resetea todos los rate limits para un usuario"""
        user_identifier = f"user:{user_id}"
        
        for key in RATE_LIMITS.keys():
            self.limiter.reset_rate_limit(key, user_identifier)
    
    def get_ip_rate_limits(self, ip_address: str) -> Dict[str, Any]:
        """Obtiene todos los rate limits para una IP"""
        ip_identifier = f"ip:{ip_address}"
        limits = {}
        
        for key in RATE_LIMITS.keys():
            status = self.limiter.get_rate_limit_status(key, ip_identifier)
            limits[key] = status
        
        return limits
    
    def block_ip(self, ip_address: str, duration_minutes: int = 60):
        """Bloquea una IP temporalmente"""
        ip_identifier = f"ip:{ip_address}"
        
        # Agregar a blacklist con expiración
        block_key = f"blocked_ip:{ip_identifier}"
        self.limiter.redis_client.setex(
            block_key,
            duration_minutes * 60,
            json.dumps({"blocked_at": datetime.utcnow().isoformat()})
        )
    
    def is_ip_blocked(self, ip_address: str) -> bool:
        """Verifica si una IP está bloqueada"""
        ip_identifier = f"ip:{ip_address}"
        block_key = f"blocked_ip:{ip_identifier}"
        
        return self.limiter.redis_client.exists(block_key)
    
    def get_blocked_ips(self) -> list:
        """Obtiene lista de IPs bloqueadas"""
        pattern = "blocked_ip:*"
        keys = self.limiter.redis_client.keys(pattern)
        
        blocked_ips = []
        for key in keys:
            ip = key.replace("blocked_ip:ip:", "")
            blocked_ips.append(ip)
        
        return blocked_ips
    
    def unblock_ip(self, ip_address: str):
        """Desbloquea una IP"""
        ip_identifier = f"ip:{ip_address}"
        block_key = f"blocked_ip:{ip_identifier}"
        
        self.limiter.redis_client.delete(block_key)


# Instancia global del servicio
rate_limit_service = RateLimitService()
