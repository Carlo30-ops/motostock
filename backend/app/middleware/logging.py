import time
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request
from app.logging_config import request_logger

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
