"""add rbac fields and indexes

Revision ID: 20260526_01
Revises: f59810d75dca
Create Date: 2026-05-26 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260526_01'
down_revision: Union[str, None] = 'f59810d75dca'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add fields to users table
    op.add_column('users', sa.Column('max_discount', sa.Float(), nullable=False, server_default='0.0'))
    op.add_column('users', sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    
    # Add index to is_active
    op.create_index(op.f('ix_users_is_active'), 'users', ['is_active'], unique=False)
    
    # Add mechanic_id to work_orders
    op.add_column('work_orders', sa.Column('mechanic_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_work_orders_mechanic_id_users', 'work_orders', 'users', ['mechanic_id'], ['id'])
    op.create_index(op.f('ix_work_orders_mechanic_id'), 'work_orders', ['mechanic_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_work_orders_mechanic_id'), table_name='work_orders')
    op.drop_constraint('fk_work_orders_mechanic_id_users', 'work_orders', type_='foreignkey')
    op.drop_column('work_orders', 'mechanic_id')
    op.drop_index(op.f('ix_users_is_active'), table_name='users')
    op.drop_column('users', 'updated_at')
    op.drop_column('users', 'max_discount')
