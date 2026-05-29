from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Session, with_loader_criteria

from app.config import settings

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    from app.services.tenant import get_current_tenant_id, get_bypass_tenant
    from app.models.tenant_mixin import TenantMixin
    
    db = SessionLocal()
    tenant_id = get_current_tenant_id()
    bypass = get_bypass_tenant()
    
    # 1. Automated SaaS Isolation Filter
    # This ensures every query on a TenantMixin model is scoped to organization_id
    if tenant_id is not None and not bypass:
        db.execute(
            with_loader_criteria(
                TenantMixin,
                lambda cls: cls.organization_id == tenant_id,
                include_aliases=True,
                propagate_to_loaders=True
            )
        )
        # Store for audit/validation in other layers
        db.info["tenant_id"] = tenant_id
    
    try:
        yield db
    finally:
        db.close()
