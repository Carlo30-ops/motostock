"""add refresh tokens and secure user fields

Revision ID: 77a1217cb15d
Revises: 20260526_03
Create Date: 2026-05-29 14:47:12.384371

"""
from typing import Sequence, Optional

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '77a1217cb15d'
down_revision: Optional[str] = '20260526_03'
branch_labels: Optional[Sequence[str]] = None
depends_on: Optional[Sequence[str]] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
