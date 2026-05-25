"""add_multi_branch_support

Revision ID: f59810d75dca
Revises: 20260525_02
Create Date: 2026-05-25 18:41:50.630731

"""
from typing import Sequence, Optional

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f59810d75dca'
down_revision: Optional[str] = '20260525_02'
branch_labels: Optional[Sequence[str]] = None
depends_on: Optional[Sequence[str]] = None


def upgrade() -> None:
    # 1. Create branches table
    op.create_table('branches',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('address', sa.String(length=255), nullable=True),
    sa.Column('phone', sa.String(length=50), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_branches_id'), 'branches', ['id'], unique=False)
    op.create_index(op.f('ix_branches_name'), 'branches', ['name'], unique=True)

    # 2. Seed default branch
    op.execute("INSERT INTO branches (name, is_active) VALUES ('Sede Principal', true)")
    
    # 3. Add branch_id columns as nullable initially
    tables_to_update = ['users', 'products', 'sales', 'purchase_orders', 'vehicles', 'work_orders']
    for table in tables_to_update:
        op.add_column(table, sa.Column('branch_id', sa.Integer(), nullable=True))
        # 4. Assign existing data to default branch (ID 1)
        op.execute(f"UPDATE {table} SET branch_id = 1")
        # 5. Make branch_id non-nullable and add foreign key
        op.alter_column(table, 'branch_id', nullable=False)
        op.create_foreign_key(f'fk_{table}_branch_id', table, 'branches', ['branch_id'], ['id'])
        op.create_index(op.f(f'ix_{table}_branch_id'), table, ['branch_id'], unique=False)

    # Adjustments to existing constraints and columns
    op.drop_constraint('clients_document_id_key', 'clients', type_='unique')
    op.drop_index('ix_clients_document_id', table_name='clients')
    op.create_index(op.f('ix_clients_document_id'), 'clients', ['document_id'], unique=True)
    
    op.alter_column('invoices', 'dian_status',
               existing_type=postgresql.ENUM('pending', 'accepted', 'rejected', name='dian_status_enum'),
               type_=sa.Enum('pending', 'accepted', 'rejected', name='dianstatus'),
               existing_nullable=False,
               existing_server_default=sa.text("'pending'::dian_status_enum"))

    op.drop_constraint('products_barcode_key', 'products', type_='unique')
    op.drop_constraint('products_code_key', 'products', type_='unique')
    op.create_index(op.f('ix_products_barcode'), 'products', ['barcode'], unique=False)
    op.create_index(op.f('ix_products_code'), 'products', ['code'], unique=False)

    op.drop_column('purchase_order_items', 'received_quantity')
    op.add_column('purchase_orders', sa.Column('date', sa.Date(), nullable=True))
    op.execute("UPDATE purchase_orders SET date = order_date")
    op.alter_column('purchase_orders', 'date', nullable=False)
    
    op.add_column('purchase_orders', sa.Column('total', sa.Float(), nullable=False, server_default='0'))
    
    op.alter_column('purchase_orders', 'status',
               existing_type=postgresql.ENUM('pending', 'sent', 'received', name='order_status_enum'),
               type_=sa.Enum('pending', 'sent', 'received', name='orderstatus'),
               existing_nullable=False,
               existing_server_default=sa.text("'pending'::order_status_enum"))
    op.alter_column('purchase_orders', 'notes',
               existing_type=sa.TEXT(),
               nullable=False, server_default='')
    
    op.drop_column('purchase_orders', 'order_date')
    op.drop_column('purchase_orders', 'expected_date')
    op.drop_column('purchase_orders', 'received_date')

    op.drop_constraint('refresh_tokens_token_key', 'refresh_tokens', type_='unique')
    op.drop_index('ix_refresh_tokens_token', table_name='refresh_tokens')
    op.create_index(op.f('ix_refresh_tokens_token'), 'refresh_tokens', ['token'], unique=True)

    op.alter_column('sales', 'payment_method',
               existing_type=postgresql.ENUM('cash', 'card', 'credit', 'nequi', name='payment_method_enum'),
               type_=sa.Enum('cash', 'card', 'credit', 'nequi', name='paymentmethod'),
               existing_nullable=False)

    op.drop_constraint('users_email_key', 'users', type_='unique')
    op.drop_constraint('users_pin_code_key', 'users', type_='unique')
    op.drop_constraint('users_username_key', 'users', type_='unique')
    op.drop_index('ix_users_email', table_name='users')
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.drop_index('ix_users_username', table_name='users')
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)

    op.create_index(op.f('ix_work_order_services_id'), 'work_order_services', ['id'], unique=False)
    op.alter_column('work_orders', 'status',
               existing_type=postgresql.ENUM('scheduled', 'in_progress', 'completed', 'cancelled', name='work_order_status_enum'),
               type_=sa.Enum('scheduled', 'in_progress', 'completed', 'cancelled', name='workorderstatus'),
               existing_nullable=False,
               existing_server_default=sa.text("'scheduled'::work_order_status_enum"))


def downgrade() -> None:
    # NOTE: Downgrade is complex due to data migration and enum changes. 
    # Simplified version that drops what was added.
    tables_to_update = ['users', 'products', 'sales', 'purchase_orders', 'vehicles', 'work_orders']
    for table in tables_to_update:
        op.drop_constraint(f'fk_{table}_branch_id', table, type_='foreignkey')
        op.drop_index(op.f(f'ix_{table}_branch_id'), table_name=table)
        op.drop_column(table, 'branch_id')
    
    op.drop_index(op.f('ix_branches_name'), table_name='branches')
    op.drop_index(op.f('ix_branches_id'), table_name='branches')
    op.drop_table('branches')
    
    # Rest of downgrades for columns and constraints would go here but 
    # given the scope and safety, we focus on the upgrade path.
    pass
