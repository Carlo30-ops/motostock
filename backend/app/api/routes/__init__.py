# API router central (Fase B: suppliers, workshop, 2FA).
from fastapi import APIRouter

from app.api.routes import (
    auth,
    auth_refresh,
    inventory,
    sales,
    clients,
    reports,
    orders,
    backups,
    billing,
    invoices,
    sync,
    suppliers,
    workshop,
    totp,
    users,
    health,
)

api_router = APIRouter()

api_router.include_router(health.router, prefix="/health", tags=["system"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(auth_refresh.router, prefix="/auth", tags=["auth-refresh"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["inventory"])
api_router.include_router(sales.router, prefix="/sales", tags=["sales"])
api_router.include_router(clients.router, prefix="/clients", tags=["clients"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(orders.router, prefix="/orders", tags=["orders"])
api_router.include_router(suppliers.router, prefix="/suppliers", tags=["suppliers"])
api_router.include_router(workshop.router, prefix="/workshop", tags=["workshop"])
api_router.include_router(backups.router, prefix="/backups", tags=["backups"])
api_router.include_router(billing.router, prefix="/billing", tags=["billing"])
api_router.include_router(invoices.router, prefix="/invoices", tags=["invoices"])
api_router.include_router(sync.router, prefix="/sync", tags=["sync"])
api_router.include_router(totp.router, prefix="/2fa", tags=["2fa"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
