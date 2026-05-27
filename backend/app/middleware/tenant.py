from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request

class TenantContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        from app.services.tenant import _tenant_id_ctx, _bypass_tenant_ctx
        
        # Iniciar limpios
        tenant_token = _tenant_id_ctx.set(None)
        bypass_token = _bypass_tenant_ctx.set(False)
        try:
            response = await call_next(request)
            return response
        finally:
            _tenant_id_ctx.reset(tenant_token)
            _bypass_tenant_ctx.reset(bypass_token)
