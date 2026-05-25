"""add sale offline id

Revision ID: 20260525_02
Revises: 20260525_01
Create Date: 2026-05-25 15:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260525_02"
down_revision = "20260525_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("sales", sa.Column("offline_id", sa.String(length=50), nullable=True))
    op.create_index(op.f("ix_sales_offline_id"), "sales", ["offline_id"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_sales_offline_id"), table_name="sales")
    op.drop_column("sales", "offline_id")
