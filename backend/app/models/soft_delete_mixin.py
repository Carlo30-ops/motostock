from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import DateTime
from sqlalchemy.orm import Mapped, mapped_column

class SoftDeleteMixin:
    """
    Mixin class to add soft delete functionality to SQLAlchemy models.
    """
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    def delete(self) -> None:
        """Mark the instance as deleted."""
        self.deleted_at = datetime.now(timezone.utc)

    def restore(self) -> None:
        """Restore a soft-deleted instance."""
        self.deleted_at = None
