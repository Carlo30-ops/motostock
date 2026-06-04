"""phase_1a_purchasing_inventory_audit

Revision ID: 20260526_02
Revises: 20260526_01
Create Date: 2026-05-26 18:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '20260526_02'
down_revision: Union[str, None] = '20260526_01'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create Enums
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE movement_type AS ENUM (
                'purchase', 'sale', 'adjustment', 'return_supplier', 'transfer'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE purchase_order_status AS ENUM (
                'draft', 'pending_approval', 'approved', 'rejected', 
                'ordered', 'partially_received', 'received', 'cancelled'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )
    
    # We still need the objects for the table creation
    movement_type = sa.Enum(
        'purchase', 'sale', 'adjustment', 'return_supplier', 'transfer', 
        name='movement_type'
    )
    purchase_order_status = sa.Enum(
        'draft', 'pending_approval', 'approved', 'rejected', 
        'ordered', 'partially_received', 'received', 'cancelled', 
        name='purchase_order_status'
    )

    # 2. Create inventory_movements table
    op.create_table(
        'inventory_movements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('branch_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('movement_type', postgresql.ENUM('purchase', 'sale', 'adjustment', 'return_supplier', 'transfer', name='movement_type', create_type=False), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('previous_stock', sa.Integer(), nullable=False),
        sa.Column('new_stock', sa.Integer(), nullable=False),
        sa.Column('previous_cost', sa.Float(), nullable=False),
        sa.Column('new_cost', sa.Float(), nullable=False),
        sa.Column('unit_cost', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('reference_type', sa.String(length=50), nullable=True),
        sa.Column('reference_id', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_inventory_movements_branch_id'), 'inventory_movements', ['branch_id'], unique=False)
    op.create_index(op.f('ix_inventory_movements_id'), 'inventory_movements', ['id'], unique=False)
    op.create_index(op.f('ix_inventory_movements_product_id'), 'inventory_movements', ['product_id'], unique=False)

    # 3. Update purchase_orders
    # Handle Enum change: first alter column type
    # Note: Existing 'OrderStatus' needs to be migrated to 'PurchaseOrderStatus'
    # For simplicity in this migration, we'll cast existing values.
    
    # Add new columns first
    op.add_column('purchase_orders', sa.Column('approved_by_id', sa.Integer(), nullable=True))
    op.add_column('purchase_orders', sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('purchase_orders', sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))
    op.create_foreign_key(None, 'purchase_orders', 'users', ['approved_by_id'], ['id'])

    # Change status column type
    # Map old 'pending' to 'draft' or 'pending_approval'? 
    # Let's map existing 'pending' -> 'ordered' (as it was used before) or 'draft'
    # Actually, old 'pending' meant it was created but not received.
    op.execute("ALTER TABLE purchase_orders ALTER COLUMN status DROP DEFAULT")
    op.execute("ALTER TABLE purchase_orders ALTER COLUMN status TYPE VARCHAR(255)")
    op.execute("UPDATE purchase_orders SET status = 'ordered' WHERE status = 'pending'")
    op.execute("UPDATE purchase_orders SET status = 'ordered' WHERE status = 'sent'")
    op.execute("ALTER TABLE purchase_orders ALTER COLUMN status TYPE purchase_order_status USING status::purchase_order_status")
    op.execute("ALTER TABLE purchase_orders ALTER COLUMN status SET DEFAULT 'draft'")

    # 4. Update purchase_order_items
    op.add_column('purchase_order_items', sa.Column('received_quantity', sa.Integer(), server_default='0', nullable=False))


def downgrade() -> None:
    # 4. Rollback purchase_order_items
    op.drop_column('purchase_order_items', 'received_quantity')

    # 3. Rollback purchase_orders
    op.drop_constraint(None, 'purchase_orders', type_='foreignkey')
    op.drop_column('purchase_orders', 'updated_at')
    op.drop_column('purchase_orders', 'approved_at')
    op.drop_column('purchase_orders', 'approved_by_id')
    
    # Revert Enum (this is tricky, usually we'd go back to the old one if it existed as a type)
    op.execute("ALTER TABLE purchase_orders ALTER COLUMN status TYPE VARCHAR(255)")
    op.execute("UPDATE purchase_orders SET status = 'pending' WHERE status IN ('draft', 'pending_approval', 'approved', 'rejected', 'ordered', 'partially_received', 'cancelled')")
    # We can't easily recreate the exact old Enum type if it was deleted, but we can try
    # Re-creating old orderstatus if needed, but usually it's better to just leave it as varchar or the new enum if it's a superset.
    
    # 2. Drop inventory_movements
    op.drop_index(op.f('ix_inventory_movements_product_id'), table_name='inventory_movements')
    op.drop_index(op.f('ix_inventory_movements_id'), table_name='inventory_movements')
    op.drop_index(op.f('ix_inventory_movements_branch_id'), table_name='inventory_movements')
    op.drop_table('inventory_movements')

    # 1. Drop Enums
    op.execute("DROP TYPE movement_type")
    op.execute("DROP TYPE purchase_order_status")
