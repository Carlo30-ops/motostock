"""add user pin and rbac roles

Revision ID: 20260508_02
Revises: 20260508_01
Create Date: 2026-05-08 11:35:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260508_02"
down_revision: Union[str, None] = "20260508_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("pin_code", sa.String(length=10), nullable=True))
    op.create_index(op.f("ix_users_pin_code"), "users", ["pin_code"], unique=True)

    # Normalize old role values to new hierarchy.
    op.execute("UPDATE users SET role = 'supervisor' WHERE role = 'manager'")
    op.execute("UPDATE users SET role = 'superadmin' WHERE role = 'owner'")


def downgrade() -> None:
    op.drop_index(op.f("ix_users_pin_code"), table_name="users")
    op.drop_column("users", "pin_code")
