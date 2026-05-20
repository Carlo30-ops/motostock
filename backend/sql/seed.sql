-- MotoStock Database Schema and Seed Data

-- 1. Tables

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    pin_code VARCHAR(10) UNIQUE,
    role VARCHAR(20) DEFAULT 'cashier' NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(100) NOT NULL,
    brand VARCHAR(100) NOT NULL,
    barcode VARCHAR(50) UNIQUE,
    supplier VARCHAR(150),
    stock INTEGER DEFAULT 0 NOT NULL,
    sale_price DOUBLE PRECISION NOT NULL,
    cost_price DOUBLE PRECISION NOT NULL,
    reorder_threshold INTEGER DEFAULT 10 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(50) UNIQUE,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(30) NOT NULL,
    motorcycle_model VARCHAR(150) NOT NULL,
    last_service_date DATE,
    oil_change_interval_km INTEGER DEFAULT 6000 NOT NULL,
    current_km INTEGER DEFAULT 0 NOT NULL,
    credit_balance DOUBLE PRECISION DEFAULT 0.0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE combos (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE combo_items (
    id SERIAL PRIMARY KEY,
    combo_id INTEGER NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER DEFAULT 1 NOT NULL
);

CREATE TABLE credit_ledger (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    amount DOUBLE PRECISION NOT NULL,
    description VARCHAR(255) DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE payment_method_enum AS ENUM ('cash', 'card', 'credit', 'nequi');

CREATE TABLE sales (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id),
    date DATE NOT NULL,
    subtotal DOUBLE PRECISION NOT NULL,
    discount_pct DOUBLE PRECISION DEFAULT 0.0 NOT NULL,
    total DOUBLE PRECISION NOT NULL,
    payment_method payment_method_enum NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE sale_items (
    id SERIAL PRIMARY KEY,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price DOUBLE PRECISION NOT NULL
);

CREATE TYPE order_status_enum AS ENUM ('pending', 'sent', 'received');

CREATE TABLE purchase_orders (
    id SERIAL PRIMARY KEY,
    supplier VARCHAR(150) NOT NULL,
    status order_status_enum DEFAULT 'pending' NOT NULL,
    date DATE NOT NULL,
    total DOUBLE PRECISION NOT NULL,
    notes TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE purchase_order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_cost DOUBLE PRECISION NOT NULL
);

CREATE TYPE dian_status_enum AS ENUM ('pending', 'accepted', 'rejected');

CREATE TABLE company_config (
    id SERIAL PRIMARY KEY,
    nit VARCHAR(30) NOT NULL,
    company_name VARCHAR(200) NOT NULL,
    address VARCHAR(255) NOT NULL,
    dian_resolution VARCHAR(100) NOT NULL,
    resolution_number VARCHAR(100),
    invoice_prefix VARCHAR(20) DEFAULT 'FV' NOT NULL,
    cert_path VARCHAR(255),
    cert_password VARCHAR(255),
    provider VARCHAR(30) DEFAULT 'siigo' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    sale_id INTEGER REFERENCES sales(id),
    external_id VARCHAR(100),
    invoice_number VARCHAR(80) NOT NULL,
    invoice_prefix VARCHAR(20),
    resolution_number VARCHAR(100),
    cufe VARCHAR(120),
    qr_code TEXT,
    dian_status dian_status_enum DEFAULT 'pending' NOT NULL,
    dian_response_xml TEXT,
    provider_payload TEXT,
    subtotal DOUBLE PRECISION NOT NULL,
    tax_total DOUBLE PRECISION DEFAULT 0 NOT NULL,
    total DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Seed Data

INSERT INTO users (username, email, hashed_password, pin_code, role, is_active, created_at)
VALUES (
    'admin',
    'admin@motostock.local',
    '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', -- password: "admin"
    '9999',
    'admin',
    true,
    NOW()
),
(
    'cashier1',
    'cashier1@motostock.local',
    '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', -- password: "admin"
    '1111',
    'cashier',
    true,
    NOW()
),
(
    'seller1',
    'seller1@motostock.local',
    '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
    '2222',
    'seller',
    true,
    NOW()
),
(
    'supervisor1',
    'supervisor1@motostock.local',
    '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
    '3333',
    'supervisor',
    true,
    NOW()
),
(
    'superadmin1',
    'superadmin1@motostock.local',
    '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
    '4444',
    'superadmin',
    true,
    NOW()
);

INSERT INTO products (code, name, category, brand, barcode, supplier, stock, sale_price, cost_price, reorder_threshold, created_at, updated_at)
VALUES 
    ('MOT7100', 'Motul 7100 10W-40 Engine Oil', 'Oil & Lubricants', 'Motul', '1234567890123', 'Motul Distributor', 45, 42.99, 28.50, 20, NOW(), NOW()),
    ('NGK-IR', 'NGK Iridium Spark Plug', 'Ignition', 'NGK', '1234567890124', 'NGK Supplier', 8, 12.99, 7.50, 15, NOW(), NOW()),
    ('EBC-FP', 'EBC Brake Pads - Front', 'Brakes', 'EBC', '1234567890125', 'EBC Brakes', 2, 65.00, 42.00, 5, NOW(), NOW()),
    ('KN-AF', 'K&N Air Filter', 'Air Intake', 'K&N', '1234567890126', 'K&N Official', 18, 55.99, 35.00, 10, NOW(), NOW()),
    ('DID-520', 'DID Chain Kit 520', 'Drive Train', 'DID', '1234567890127', 'DID Parts', 12, 189.99, 125.00, 8, NOW(), NOW()),
    ('MICH-PR5R', 'Michelin Pilot Road 5 Rear Tire', 'Tires', 'Michelin', '1234567890128', 'Michelin Direct', 0, 245.00, 165.00, 3, NOW(), NOW());

INSERT INTO clients (document_id, name, email, phone, motorcycle_model, last_service_date, oil_change_interval_km, current_km, credit_balance, created_at)
VALUES
    ('1010101010', 'John Martinez', 'john@example.com', '+15551234567', 'Yamaha MT-07', '2026-04-15', 5000, 9800, 0, NOW()),
    ('2020202020', 'Sarah Chen', 'sarah@example.com', '+15552345678', 'Honda CB650R', '2026-03-20', 6000, 14500, 45.50, NOW()),
    ('3030303030', 'Mike Johnson', 'mike@example.com', '+15553456789', 'Kawasaki Z900', '2026-05-01', 6000, 18200, 0, NOW());

INSERT INTO combos (name, price, created_at)
VALUES ('Oil Change Kit', 49.99, NOW());

INSERT INTO combo_items (combo_id, product_id, quantity)
VALUES 
    (1, 1, 1),
    (1, 2, 1);

INSERT INTO sales (client_id, date, subtotal, discount_pct, total, payment_method, created_at)
VALUES 
    (1, '2026-05-07', 85.98, 0, 85.98, 'card', NOW()),
    (NULL, '2026-05-06', 81.97, 0, 81.97, 'cash', NOW()),
    (2, '2026-05-05', 189.99, 0, 189.99, 'credit', NOW());

INSERT INTO sale_items (sale_id, product_id, quantity, unit_price)
VALUES
    (1, 1, 2, 42.99),
    (2, 4, 1, 55.99),
    (2, 2, 2, 12.99),
    (3, 5, 1, 189.99);

INSERT INTO credit_ledger (client_id, amount, description, created_at)
VALUES
    (2, 189.99, 'Sale #3', '2026-05-05'),
    (2, -144.49, 'Partial payment', '2026-05-06');

INSERT INTO purchase_orders (supplier, status, date, total, notes, created_at)
VALUES
    ('Motul Distributor', 'sent', '2026-05-05', 684.00, 'Monthly restock', NOW()),
    ('EBC Brakes', 'pending', '2026-05-07', 1410.00, 'Urgent stock needed', NOW());

INSERT INTO purchase_order_items (order_id, product_id, quantity, unit_cost)
VALUES
    (1, 1, 24, 28.50),
    (2, 3, 10, 42.00),
    (2, 6, 6, 165.00);

INSERT INTO company_config (nit, company_name, address, dian_resolution, resolution_number, invoice_prefix, cert_path, cert_password, provider, created_at, updated_at)
VALUES
    ('900123456-7', 'MotoStock SAS', 'Calle 123 #45-67, Bogota', '18760000001', '18760000001', 'FV', './certs/cert.p12', '', 'siigo', NOW(), NOW());
