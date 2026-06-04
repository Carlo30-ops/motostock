"""strengthen owner role

Revision ID: 20260604_01
Revises: 20260526_05
Create Date: 2026-06-04 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260604_01'
down_revision: Union[str, None] = '20260526_05'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add cashier_id and deleted_at to sales
    op.add_column('sales', sa.Column('cashier_id', sa.Integer(), nullable=True))
    op.add_column('sales', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    
    # Add foreign key and index
    op.create_foreign_key('fk_sales_cashier_id_users', 'sales', 'users', ['cashier_id'], ['id'])
    op.create_index(op.f('ix_sales_cashier_id'), 'sales', ['cashier_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_sales_cashier_id'), table_name='sales')
    op.drop_constraint('fk_sales_cashier_id_users', 'sales', type_='foreignkey')
    op.drop_column('sales', 'deleted_at')
    op.drop_column('sales', 'cashier_id')
