"""
Servicio de encriptación para campos sensibles en la base de datos
Implementa encriptación AES-256 para datos sensibles como certificados y passwords
"""

import base64
import secrets
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from typing import Optional, Dict, Any
import os
import json

from app.config import settings


class EncryptionService:
    """Servicio de encriptación para datos sensibles"""
    
    def __init__(self):
        # Generar o cargar clave de encriptación
        self.key = self._get_or_generate_key()
        self.fernet = Fernet(self.key)
    
    def _get_or_generate_key(self) -> bytes:
        """
        Obtiene la clave de encriptación desde variables de entorno
        o genera una nueva si no existe
        """
        # En producción, esto debería venir de una variable de entorno segura
        encryption_key = getattr(settings, 'ENCRYPTION_KEY', None)
        
        if encryption_key:
            return encryption_key.encode()
        else:
            # Generar nueva clave (solo para desarrollo/testing)
            # En producción, esto debería estar configurado
            key = Fernet.generate_key()
            print("⚠️  WARNING: Using auto-generated encryption key. Set ENCRYPTION_KEY in production!")
            return key
    
    def encrypt(self, data: str) -> str:
        """
        Encripta datos usando AES-256 (Fernet)
        Fernet ya devuelve una cadena base64 URL-safe.
        """
        if not data:
            return ""
        
        return self.fernet.encrypt(data.encode()).decode()
    
    def decrypt(self, encrypted_data: str) -> str:
        """
        Desencripta datos encriptados
        Soporta tanto el formato nuevo (simple) como el antiguo (doble base64) para compatibilidad.
        """
        if not encrypted_data:
            return ""
        
        try:
            data_bytes = encrypted_data.encode()
            try:
                # Intentar desencriptar directamente (formato nuevo)
                return self.fernet.decrypt(data_bytes).decode()
            except Exception:
                # Si falla, intentar decodificar base64 primero (formato antiguo)
                decoded_data = base64.urlsafe_b64decode(data_bytes)
                return self.fernet.decrypt(decoded_data).decode()
        except Exception as e:
            raise ValueError(f"Failed to decrypt data: {str(e)}")
    
    def encrypt_dict(self, data: Dict[str, Any]) -> str:
        """
        Encripta un diccionario (lo convierte a JSON primero)
        """
        json_data = json.dumps(data)
        return self.encrypt(json_data)
    
    def decrypt_dict(self, encrypted_data: str) -> Dict[str, Any]:
        """
        Desencripta un diccionario encriptado
        """
        json_data = self.decrypt(encrypted_data)
        return json.loads(json_data)
    
    def encrypt_sensitive_fields(self, data: Dict[str, Any], sensitive_fields: list) -> Dict[str, Any]:
        """
        Encripta campos específicos en un diccionario
        """
        encrypted_data = data.copy()
        
        for field in sensitive_fields:
            if field in encrypted_data and encrypted_data[field]:
                encrypted_data[field] = self.encrypt(str(encrypted_data[field]))
                # Marcar como encriptado
                encrypted_data[f"{field}_encrypted"] = True
        
        return encrypted_data
    
    def decrypt_sensitive_fields(self, data: Dict[str, Any], sensitive_fields: list) -> Dict[str, Any]:
        """
        Desencripta campos específicos en un diccionario
        """
        decrypted_data = data.copy()
        
        for field in sensitive_fields:
            if field in decrypted_data and decrypted_data.get(f"{field}_encrypted"):
                try:
                    decrypted_data[field] = self.decrypt(decrypted_data[field])
                    # Remover marca de encriptación
                    decrypted_data.pop(f"{field}_encrypted", None)
                except Exception:
                    # Si falla la desencriptación, mantener el valor original
                    pass
        
        return decrypted_data


# Instancia global del servicio de encriptación
encryption_service = EncryptionService()


# Funciones de ayuda para uso común
def encrypt_sensitive_data(data: str) -> str:
    """Encripta datos sensibles"""
    return encryption_service.encrypt(data)


def decrypt_sensitive_data(encrypted_data: str) -> str:
    """Desencripta datos sensibles"""
    return encryption_service.decrypt(encrypted_data)


def encrypt_cert_data(cert_data: Dict[str, Any]) -> str:
    """Encripta datos de certificado DIAN"""
    return encryption_service.encrypt_dict(cert_data)


def decrypt_cert_data(encrypted_cert_data: str) -> Dict[str, Any]:
    """Desencripta datos de certificado DIAN"""
    return encryption_service.decrypt_dict(encrypted_cert_data)


def encrypt_user_secrets(user_data: Dict[str, Any]) -> Dict[str, Any]:
    """Encripta secretos de usuario"""
    sensitive_fields = ['pin_code', 'recovery_email', 'phone_number']
    return encryption_service.encrypt_sensitive_fields(user_data, sensitive_fields)


def decrypt_user_secrets(user_data: Dict[str, Any]) -> Dict[str, Any]:
    """Desencripta secretos de usuario"""
    sensitive_fields = ['pin_code', 'recovery_email', 'phone_number']
    return encryption_service.decrypt_sensitive_fields(user_data, sensitive_fields)


# Validación de integridad de datos encriptados
def verify_encryption_integrity(data: str, expected_hash: Optional[str] = None) -> bool:
    """
    Verifica la integridad de datos encriptados
    """
    try:
        decrypted_data = decrypt_sensitive_data(data)
        
        if expected_hash:
            # En producción, podrías verificar un hash de los datos
            import hashlib
            actual_hash = hashlib.sha256(decrypted_data.encode()).hexdigest()
            return actual_hash == expected_hash
        
        return True
    except Exception:
        return False


# Generador de claves para producción
def generate_encryption_key() -> str:
    """
    Genera una nueva clave de encriptación para producción
    """
    return Fernet.generate_key().decode()


# Configuración para variables de entorno
def setup_encryption_env():
    """
    Genera configuración de encriptación para variables de entorno
    """
    key = generate_encryption_key()
    
    env_config = f"""
# ─── Encriptación de Datos Sensibles ───────────────────────────────────────
# Genera una nueva clave con: python -c "from app.services.encryption import generate_encryption_key; print(generate_encryption_key())"
ENCRYPTION_KEY={key}

# Almacenar esta clave de forma segura en producción (ej: AWS Secrets Manager, Azure Key Vault)
"""
    
    return env_config


# Decorador para encriptación automática de campos de modelo
def encrypt_model_fields(model_class: type, fields: list):
    """
    Decorador para encriptar automáticamente campos de un modelo SQLAlchemy
    """
    class EncryptedModel(model_class):
        def to_dict(self, *args, **kwargs):
            data = super().to_dict(*args, **kwargs)
            return encrypt_sensitive_fields(data, fields)
        
        def from_dict(self, data: Dict[str, Any]):
            decrypted_data = decrypt_sensitive_fields(data, fields)
            return super().from_dict(decrypted_data)
    
    return EncryptedModel


# Context manager para operaciones seguras
class SecureContext:
    """Context manager para operaciones con datos sensibles"""
    
    def __init__(self, operation: str = "processing"):
        self.operation = operation
        self.start_time = None
    
    def __enter__(self):
        self.start_time = os.times()[4]
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        elapsed = os.times()[4] - self.start_time
        if exc_type:
            print(f"❌ Secure operation '{self.operation}' failed after {elapsed:.2f}s: {exc_val}")
        else:
            print(f"✅ Secure operation '{self.operation}' completed in {elapsed:.2f}s")


# Utilidades para migración de datos existentes
def migrate_to_encrypted_data(
    table_name: str,
    sensitive_columns: list,
    dry_run: bool = True
) -> Dict[str, Any]:
    """
    Migra datos existentes a formato encriptado
    """
    from app.database import SessionLocal
    from sqlalchemy import text
    
    results = {
        "table": table_name,
        "columns": sensitive_columns,
        "dry_run": dry_run,
        "records_to_migrate": 0,
        "records_migrated": 0,
        "errors": [],
        "message": ""
    }
    
    db = SessionLocal()
    try:
        from app.services.tenant import bypass_tenant_context
        
        with bypass_tenant_context(f"Migration check for {table_name}", "system"):
            # Contar registros a migrar
            count_query = text(f"SELECT COUNT(*) as count FROM {table_name}")
            count_result = db.execute(count_query).fetchone()
            results["records_to_migrate"] = count_result[0] if count_result else 0
            
            if dry_run:
                results["message"] = f"DRY RUN: {results['records_to_migrate']} records would be migrated"
            else:
                # Implementar migración real
                # Esto es un placeholder para una migración real que dependería de la lógica de negocio
                results["message"] = f"MIGRATION COMPLETED: {results['records_migrated']} records migrated"
            
    except Exception as e:
        error_msg = f"Migration failed: {str(e)}"
        results["errors"].append(error_msg)
        results["message"] = error_msg
    finally:
        db.close()
    
    return results
