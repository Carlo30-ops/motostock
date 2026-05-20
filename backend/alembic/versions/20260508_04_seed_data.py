"""seed data

Revision ID: 20260508_04
Revises: 20260508_03
Create Date: 2026-05-08 14:30:00.000000

Esta migración inserta los datos iniciales del sistema,
reemplazando completamente el seed.sql para mantener consistencia.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column
from sqlalchemy import String, Integer, Float, Boolean, Date, DateTime
from datetime import date, datetime

# revision identifiers, used by Alembic.
revision: str = "20260508_04"
down_revision: Union[str, None] = "20260508_03"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Insertar usuarios iniciales
    users_table = table('users',
        column('username', String),
        column('email', String),
        column('hashed_password', String),
        column('pin_code', String),
        column('role', String),
        column('is_active', Boolean)
    )
    
    op.bulk_insert(users_table, [
        {
            'username': 'admin',
            'email': 'admin@motostock.com',
            'hashed_password': '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LFvO.',  # password: admin123
            'pin_code': '1234',
            'role': 'admin',
            'is_active': True
        },
        {
            'username': 'cashier',
            'email': 'cashier@motostock.com',
            'hashed_password': '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LFvO.',  # password: cashier123
            'pin_code': '5678',
            'role': 'cashier',
            'is_active': True
        }
    ])

    # Insertar productos iniciales
    products_table = table('products',
        column('code', String),
        column('name', String),
        column('category', String),
        column('brand', String),
        column('barcode', String),
        column('supplier', String),
        column('stock', Integer),
        column('sale_price', Float),
        column('cost_price', Float),
        column('reorder_threshold', Integer)
    )
    
    op.bulk_insert(products_table, [
        {
            'code': 'ACEITE001',
            'name': 'Aceite 4T 20W50',
            'category': 'Lubricantes',
            'brand': 'Shell',
            'barcode': '7700001001',
            'supplier': 'Distribuidora Shell',
            'stock': 25,
            'sale_price': 15000.0,
            'cost_price': 12000.0,
            'reorder_threshold': 10
        },
        {
            'code': 'FILTRO001',
            'name': 'Filtro de Aceite',
            'category': 'Filtros',
            'brand': 'Bosch',
            'barcode': '7700001002',
            'supplier': 'AutoParts S.A.',
            'stock': 50,
            'sale_price': 8000.0,
            'cost_price': 6000.0,
            'reorder_threshold': 15
        },
        {
            'code': 'BUJIA001',
            'name': 'Bujía NGK CR7HSA',
            'category': 'Encendido',
            'brand': 'NGK',
            'barcode': '7700001003',
            'supplier': 'NGK Colombia',
            'stock': 30,
            'sale_price': 12000.0,
            'cost_price': 9000.0,
            'reorder_threshold': 10
        },
        {
            'code': 'CADENA001',
            'name': 'Cadena 428 120 Eslabones',
            'category': 'Transmisión',
            'brand': 'DID',
            'barcode': '7700001004',
            'supplier': 'Motos Parts Ltda',
            'stock': 15,
            'sale_price': 45000.0,
            'cost_price': 35000.0,
            'reorder_threshold': 5
        },
        {
            'code': 'FRENOS001',
            'name': 'Pastillas de Freno Delanteras',
            'category': 'Frenos',
            'brand': 'Brembo',
            'barcode': '7700001005',
            'supplier': 'Brembo Colombia',
            'stock': 20,
            'sale_price': 25000.0,
            'cost_price': 20000.0,
            'reorder_threshold': 8
        }
    ])

    # Insertar clientes iniciales
    clients_table = table('clients',
        column('document_id', String),
        column('name', String),
        column('email', String),
        column('phone', String),
        column('motorcycle_model', String),
        column('last_service_date', Date),
        column('oil_change_interval_km', Integer),
        column('current_km', Integer),
        column('credit_balance', Float)
    )
    
    op.bulk_insert(clients_table, [
        {
            'document_id': '123456789',
            'name': 'Juan Pérez',
            'email': 'juan.perez@email.com',
            'phone': '3001234567',
            'motorcycle_model': 'Honda CB 150',
            'last_service_date': date(2024, 4, 15),
            'oil_change_interval_km': 6000,
            'current_km': 15000,
            'credit_balance': 0.0
        },
        {
            'document_id': '987654321',
            'name': 'María García',
            'email': 'maria.garcia@email.com',
            'phone': '3109876543',
            'motorcycle_model': 'Yamaha YBR 125',
            'last_service_date': date(2024, 3, 20),
            'oil_change_interval_km': 6000,
            'current_km': 8000,
            'credit_balance': 50000.0
        },
        {
            'document_id': '456789123',
            'name': 'Carlos Rodríguez',
            'email': 'carlos.rodriguez@email.com',
            'phone': '3204567890',
            'motorcycle_model': 'Suzuki Gixxer 150',
            'last_service_date': date(2024, 4, 1),
            'oil_change_interval_km': 6000,
            'current_km': 12000,
            'credit_balance': 0.0
        }
    ])

    # Insertar combos iniciales
    combos_table = table('combos',
        column('name', String),
        column('price', Float)
    )
    
    op.bulk_insert(combos_table, [
        {
            'name': 'Combo Cambio de Aceite Básico',
            'price': 28000.0
        },
        {
            'name': 'Combo Mantenimiento Completo',
            'price': 55000.0
        }
    ])

    # Obtener IDs de combos para insertar items
    connection = op.get_bind()
    
    # Insertar combo items para el combo básico (id=1)
    combo_items_table = table('combo_items',
        column('combo_id', Integer),
        column('product_id', Integer),
        column('quantity', Integer)
    )
    
    op.bulk_insert(combo_items_table, [
        {'combo_id': 1, 'product_id': 1, 'quantity': 1},  # Aceite
        {'combo_id': 1, 'product_id': 2, 'quantity': 1},  # Filtro
        {'combo_id': 2, 'product_id': 1, 'quantity': 1},  # Aceite
        {'combo_id': 2, 'product_id': 2, 'quantity': 1},  # Filtro
        {'combo_id': 2, 'product_id': 3, 'quantity': 1},  # Bujía
    ])


def downgrade() -> None:
    # Eliminar datos en orden inverso por foreign keys
    op.execute("DELETE FROM combo_items")
    op.execute("DELETE FROM combos")
    op.execute("DELETE FROM clients")
    op.execute("DELETE FROM products")
    op.execute("DELETE FROM users")
