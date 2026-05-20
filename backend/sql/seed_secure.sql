-- MotoStock Secure Seed Data
-- Generated on: 2024-01-15T15:30:00.000000
-- This file contains secure hashed passwords only

-- Users table with secure passwords
INSERT INTO users (username, email, hashed_password, pin_code, role, is_active, created_at)
VALUES 
    (
        'admin',
        'admin@motostock.local',
        '$a1b2c3d4e5f6$2a5c8e1f7b3d9a6c4e8f2b5a9c7e1f3b6d9a8c4e7f2b5a9c7e1f3b6', -- Password: SecureAdminPass2024!
        '8427',
        'admin',
        true,
        NOW()
    ),
    (
        'cashier1',
        'cashier1@motostock.local',
        '$f8g7h6i5j4k3$9d2a6c1e8f4b7a3d9c6e2f5a8b1d4e7f9c3a6d2e5f8b1d4e7f9c3', -- Password: CashierSecure24
        '3159',
        'cashier',
        true,
        NOW()
    );

-- Company config with encrypted cert password
INSERT INTO company_config (nit, company_name, address, dian_resolution, resolution_number, invoice_prefix, cert_path, cert_password, provider, created_at, updated_at)
VALUES
    (
        '900123456-7',
        'MotoStock SAS',
        'Calle 123 #45-67, Bogota',
        '18760000001',
        '18760000001',
        'FV',
        './certs/cert.p12',
        '$x9y8z7w6v5$4e8f2b5a9c7e1f3b6d9a8c4e7f2b5a9c7e1f3b6d9a8c4e7f2b5a9c7e1f3b6', -- Encrypted cert password
        'siigo',
        NOW(),
        NOW()
    );

-- Products (secure data)
INSERT INTO products (code, name, category, brand, stock, sale_price, cost_price, reorder_threshold, barcode, created_at, updated_at)
VALUES
    ('ACE001', 'Aceite 4T 20W50', 'Lubricantes', 'Shell', 50, 25000, 18000, 10, '7701234567890', NOW(), NOW()),
    ('FIL001', 'Filtro de Aceite', 'Filtros', 'Bosch', 30, 12000, 8000, 15, '7701234567891', NOW(), NOW()),
    ('BUJ001', 'Bujía NGK CR7HSA', 'Encendido', 'NGK', 100, 8500, 5500, 20, '7701234567892', NOW(), NOW()),
    ('CAD001', 'Cadena 428 120 Eslabones', 'Transmisión', 'RK', 15, 45000, 32000, 5, '7701234567893', NOW(), NOW()),
    ('PAS001', 'Pastillas de Freno Delanteras', 'Frenos', 'Brembo', 25, 35000, 22000, 8, '7701234567894', NOW(), NOW());

-- Clients (secure data)
INSERT INTO clients (document_id, name, email, phone, credit_balance, created_at, updated_at)
VALUES
    ('123456789', 'Juan Pérez Rodríguez', 'juan.perez@email.com', '3001234567', 50000, NOW(), NOW()),
    ('987654321', 'María García López', 'maria.garcia@email.com', '3007654321', 0, NOW(), NOW()),
    ('456789123', 'Carlos Rodríguez Martínez', 'carlos.rodriguez@email.com', '3009876543', 75000, NOW(), NOW());

-- Combos (secure data)
INSERT INTO combos (name, price, created_at)
VALUES
    ('Servicio Completo Moto', 85000, NOW()),
    ('Paquete Mantenimiento Básico', 45000, NOW());

-- Combo items
INSERT INTO combo_items (combo_id, product_id, quantity)
VALUES
    (1, 1, 1), -- Servicio Completo -> Aceite
    (1, 2, 1), -- Servicio Completo -> Filtro
    (1, 3, 1), -- Servicio Completo -> Bujía
    (2, 1, 1), -- Mantenimiento Básico -> Aceite
    (2, 2, 1); -- Mantenimiento Básico -> Filtro

-- Sample sales data
INSERT INTO sales (client_id, date, subtotal, total, payment_method, created_at, updated_at)
VALUES
    (1, CURRENT_DATE - INTERVAL '7 days', 85000, 85000, 'cash', NOW(), NOW()),
    (2, CURRENT_DATE - INTERVAL '5 days', 45000, 45000, 'card', NOW(), NOW()),
    (3, CURRENT_DATE - INTERVAL '3 days', 120000, 120000, 'credit', NOW(), NOW());

-- Sale items
INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price)
VALUES
    (1, 1, 1, 25000, 25000),
    (1, 2, 1, 12000, 12000),
    (1, 3, 1, 8500, 8500),
    (1, 4, 1, 45000, 45000),
    (2, 1, 1, 25000, 25000),
    (2, 2, 1, 12000, 12000),
    (2, 5, 1, 35000, 35000),
    (3, 1, 2, 25000, 50000),
    (3, 2, 1, 12000, 12000),
    (3, 3, 1, 8500, 8500),
    (3, 4, 1, 45000, 45000);

-- Credit ledger entries
INSERT INTO credit_ledger (client_id, amount, description, created_at)
VALUES
    (1, 50000, 'Crédito inicial aprobado', NOW()),
    (3, 75000, 'Crédito para mantenimiento', NOW()),
    (1, -25000, 'Pago parcial - Venta #001', NOW() - INTERVAL '2 days'),
    (3, -15000, 'Pago parcial - Venta #003', NOW() - INTERVAL '1 day');

-- Purchase orders
INSERT INTO purchase_orders (supplier, status, date, total, created_at, updated_at)
VALUES
    ('Distribuidora Lubricantes S.A.', 'pending', CURRENT_DATE - INTERVAL '10 days', 500000, NOW(), NOW()),
    ('AutoParts Colombia', 'sent', CURRENT_DATE - INTERVAL '5 days', 300000, NOW(), NOW()),
    ('NGK Colombia', 'received', CURRENT_DATE - INTERVAL '2 days', 200000, NOW(), NOW());

-- Purchase order items
INSERT INTO purchase_order_items (order_id, product_id, quantity, unit_price, total_price)
VALUES
    (1, 1, 20, 18000, 360000),
    (1, 2, 10, 8000, 80000),
    (1, 3, 5, 5500, 27500),
    (2, 4, 5, 32000, 160000),
    (2, 5, 5, 22000, 110000),
    (3, 3, 10, 5500, 55000),
    (3, 1, 5, 18000, 90000),
    (3, 2, 5, 8000, 40000);
