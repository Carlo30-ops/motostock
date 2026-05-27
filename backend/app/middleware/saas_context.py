import time
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request
from app.logging_config import log_context, request_logger
from app.services.tenant import _tenant_id_ctx

class SaaSContextMiddleware(BaseHTTPMiddleware):
    """
    Enterprise middleware to manage SaaS context (Request ID, Tenant ID, User ID)
    across the entire request lifecycle, ensuring observability and isolation.
    """
    async def dispatch(self, request: Request, call_next):
        # 1. Generate or extract Request ID for tracing
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        
        # 2. Initial log context
        ctx = {
            "request_id": request_id,
            "ip_address": request.client.host if request.client else "unknown",
            "method": request.method,
            "path": request.url.path,
        }
        
        # Set initial context
        context_token = log_context.set(ctx)
        
        start_time = time.time()
        try:
            response = await call_next(request)
            
            # 3. Update context with dynamic info (after Auth/Tenant middlewares)
            # Tenant ID might be set by Auth middleware during the request
            current_tenant_id = _tenant_id_ctx.get()
            if current_tenant_id:
                ctx["tenant_id"] = current_tenant_id
                log_context.set(ctx)
            
            process_time = (time.time() - start_time) * 1000
            
            # 4. Standard log
            request_logger.log_request(
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                response_time_ms=process_time,
                ip_address=request.client.host if request.client else None
            )
            
            # Inject headers for client-side tracing
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Process-Time"] = str(process_time)
            
            return response
            
        except Exception as e:
            # Full context is preserved for the error log
            request_logger.log_error(
                method=request.method,
                path=request.url.path,
                error=str(e),
                ip_address=request.client.host if request.client else None
            )
            raise
        finally:
            # Clean up context
            log_context.reset(context_token)
