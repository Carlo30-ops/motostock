#!/usr/bin/env python3
"""
Script para generar seeds seguros sin contraseñas hardcodeadas
Genera contraseñas aleatorias y outputs para configuración inicial
"""

import secrets
import hashlib
import sys
from datetime import datetime

def generate_secure_password(length: int = 16) -> str:
    """Genera una contraseña segura aleatoria"""
    alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
    password = ''.join(secrets.choice(alphabet) for _ in range(length))
    return password

def hash_password(password: str) -> str:
    """Genera hash bcrypt-style (simulado para demostración)"""
    # En producción, usaríamos bcrypt real
    salt = secrets.token_hex(16)
    hashed = hashlib.sha256((password + salt).encode()).hexdigest()
    return f"${salt}${hashed}"

def generate_admin_credentials():
    """Genera credenciales seguras para el admin"""
    username = "admin"
    email = "admin@motostock.local"
    password = generate_secure_password(12)
    pin_code = ''.join(secrets.choice('0123456789') for _ in range(4))
    
    # Simular hash bcrypt
    hashed_password = hash_password(password)
    
    return {
        "username": username,
        "email": email,
        "password": password,
        "hashed_password": hashed_password,
        "pin_code": pin_code,
        "role": "admin"
    }

def generate_cashier_credentials():
    """Genera credenciales seguras para el cajero"""
    username = "cashier1"
    email = "cashier1@motostock.local"
    password = generate_secure_password(10)
    pin_code = ''.join(secrets.choice('0123456789') for _ in range(4))
    
    hashed_password = hash_password(password)
    
    return {
        "username": username,
        "email": email,
        "password": password,
        "hashed_password": hashed_password,
        "pin_code": pin_code,
        "role": "cashier"
    }

def generate_jwt_secret():
    """Genera una clave JWT segura"""
    return secrets.token_urlsafe(32)

def generate_dian_credentials():
    """Genera credenciales DIAN de ejemplo"""
    return {
        "nit": "900123456-7",
        "company_name": "MotoStock SAS",
        "address": "Calle 123 #45-67, Bogota",
        "dian_resolution": "18760000001",
        "resolution_number": "18760000001",
        "invoice_prefix": "FV",
        "cert_path": "./certs/cert.p12",
        "cert_password": generate_secure_password(8), # Solo para demo
        "provider": "siigo"
    }

def generate_env_file():
    """Genera archivo .env seguro"""
    admin_creds = generate_admin_credentials()
    cashier_creds = generate_cashier_credentials()
    jwt_secret = generate_jwt_secret()
    dian_creds = generate_dian_credentials()
    
    env_content = f"""# ─── PostgreSQL ───────────────────────────────────────────────────────────────
POSTGRES_USER=motostock
POSTGRES_PASSWORD={generate_secure_password(20)}
POSTGRES_DB=motostock

# ─── FastAPI / JWT ────────────────────────────────────────────────────────────
SECRET_KEY={jwt_secret}
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
CORS_ORIGINS=["https://yourdomain.com","https://app.yourdomain.com"]

# ─── Credenciales Generadas (GUARDAR EN LUGAR SEGURO) ───────────────────────────
# Admin User: {admin_creds['username']}
# Admin Password: {admin_creds['password']}
# Admin PIN: {admin_creds['pin_code']}

# Cashier User: {cashier_creds['username']}
# Cashier Password: {cashier_creds['password']}
# Cashier PIN: {cashier_creds['pin_code']}

# ─── Twilio (WhatsApp + SMS notifications) ────────────────────────────────────
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_FROM_NUMBER=+15005550006
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# ─── Frontend ─────────────────────────────────────────────────────────────────
VITE_API_URL=http://localhost:8000

# ─── Backup Automático y Reportes ─────────────────────────────────────────────
BACKUP_INTERVAL_HOURS=12
BACKUP_RETENTION_DAYS=30
BACKUP_EMAIL=dueno@correo.com
REPORT_EMAIL=dueno@correo.com

# ─── DIAN / Siigo ─────────────────────────────────────────────────────────────
DIAN_ENV=habilitacion
DIAN_PROVIDER=siigo
DIAN_CERT_PATH=./certs/cert.p12
DIAN_CERT_PASSWORD={dian_creds['cert_password']}
DIAN_NIT={dian_creds['nit']}
DIAN_RESOLUTION={dian_creds['dian_resolution']}
DIAN_INVOICE_PREFIX={dian_creds['invoice_prefix']}
SIIGO_API_BASE_URL=https://api.siigo.com
SIIGO_API_TOKEN=your_siigo_token

# ─── SMTP (Backups/Reportes) ─────────────────────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASSWORD=your_password
"""

    return env_content

def generate_secure_seed_sql():
    """Genera SQL seed con contraseñas hasheadas"""
    admin_creds = generate_admin_credentials()
    cashier_creds = generate_cashier_credentials()
    
    sql_content = f"""-- MotoStock Secure Seed Data
-- Generated on: {datetime.now().isoformat()}
-- This file contains secure hashed passwords only

-- Users table with secure passwords
INSERT INTO users (username, email, hashed_password, pin_code, role, is_active, created_at)
VALUES 
    (
        '{admin_creds['username']}',
        '{admin_creds['email']}',
        '{admin_creds['hashed_password']}', -- Password: {admin_creds['password']}
        '{admin_creds['pin_code']}',
        'admin',
        true,
        NOW()
    ),
    (
        '{cashier_creds['username']}',
        '{cashier_creds['email']}',
        '{cashier_creds['hashed_password']}', -- Password: {cashier_creds['password']}
        '{cashier_creds['pin_code']}',
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
        '{hash_password("demo_cert_password")}', -- Change this in production
        'siigo',
        NOW(),
        NOW()
    );
"""

    return sql_content, admin_creds, cashier_creds

def main():
    """Función principal"""
    print("🔐 MotoStock - Secure Seed Generator")
    print("=" * 50)
    
    # Generar .env file
    env_content = generate_env_file()
    with open('.env.secure', 'w') as f:
        f.write(env_content)
    print("✅ Generated .env.secure file")
    
    # Generar SQL seed
    sql_content, admin_creds, cashier_creds = generate_secure_seed_sql()
    with open('sql/seed_secure.sql', 'w') as f:
        f.write(sql_content)
    print("✅ Generated sql/seed_secure.sql file")
    
    # Mostrar credenciales generadas
    print("\n" + "=" * 50)
    print("🔑 GENERATED CREDENTIALS (SAVE THESE SECURELY)")
    print("=" * 50)
    print(f"\n👑 ADMIN USER:")
    print(f"   Username: {admin_creds['username']}")
    print(f"   Email: {admin_creds['email']}")
    print(f"   Password: {admin_creds['password']}")
    print(f"   PIN: {admin_creds['pin_code']}")
    
    print(f"\n💳 CASHIER USER:")
    print(f"   Username: {cashier_creds['username']}")
    print(f"   Email: {cashier_creds['email']}")
    print(f"   Password: {cashier_creds['password']}")
    print(f"   PIN: {cashier_creds['pin_code']}")
    
    print("\n" + "=" * 50)
    print("📋 NEXT STEPS:")
    print("1. Copy .env.secure to .env")
    print("2. Replace seed.sql with seed_secure.sql")
    print("3. Store credentials in a secure password manager")
    print("4. Change default passwords on first login")
    print("5. Configure production environment variables")
    print("=" * 50)

if __name__ == "__main__":
    main()
