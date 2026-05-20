"""clients: add updated_at for sync LWW

Revision ID: 20260513_01
Revises: 20260508_04
Create Date: 2026-05-13
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260513_01"
down_revision: Union[str, None] = "20260508_04"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "clients",
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute("UPDATE clients SET updated_at = created_at WHERE updated_at IS NULL")
    op.alter_column(
        "clients",
        "updated_at",
        nullable=False,
        server_default=sa.text("now()"),
    )


def downgrade() -> None:
    op.drop_column("clients", "updated_at")
