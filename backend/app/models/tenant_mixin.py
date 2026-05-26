from typing import Optional
from sqlalchemy import ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, declared_attr

class TenantMixin:
    """
    Mixin class to automatically add organization_id to multi-tenant models
    and enable tenant routing/filtering validation.
    """
    __tenant_column__ = "organization_id"
    __tenant_strategy__ = "shared_db"
    
    __tenant_metadata__ = {
        "sharding_key": "organization_id",
        "isolation_level": "logical",
        "strategy": "shared_db",
    }

    @declared_attr
    def organization_id(cls) -> Mapped[Optional[int]]:
        return mapped_column(ForeignKey("organizations.id"), nullable=True, index=True)

    @classmethod
    def is_tenant_aware(cls) -> bool:
        return True

    def check_tenant(self, tenant_id: int) -> None:
        """Helper method to validate if this instance belongs to the active tenant."""
        if self.organization_id is not None and self.organization_id != tenant_id:
            from app.services.tenant import TenantSecurityError
            raise TenantSecurityError(
                f"Violación de seguridad: el recurso {self.__class__.__name__} "
                f"pertenece a otra organización."
            )

