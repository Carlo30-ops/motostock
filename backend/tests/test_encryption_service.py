"""
Tests para el servicio de encriptación
Valida la encriptación/desencriptación de datos sensibles
"""

import pytest
from app.services.encryption import (
    EncryptionService, 
    encryption_service,
    encrypt_sensitive_data,
    decrypt_sensitive_data,
    encrypt_cert_data,
    decrypt_cert_data,
    encrypt_user_secrets,
    decrypt_user_secrets,
    verify_encryption_integrity,
    migrate_to_encrypted_data
)


class TestEncryptionService:
    """Tests para la clase EncryptionService"""
    
    def setup_method(self):
        """Configuración inicial para cada test"""
        self.service = EncryptionService()
        self.test_data = "This is sensitive data"
        self.test_dict = {"key": "value", "secret": "password123"}
    
    def test_encrypt_decrypt_string(self):
        """Test básico de encriptación/desencriptación de strings"""
        # Encriptar
        encrypted = self.service.encrypt(self.test_data)
        
        # Verificar que no es igual al original
        assert encrypted != self.test_data
        assert encrypted != ""
        
        # Desencriptar
        decrypted = self.service.decrypt(encrypted)
        
        # Verificar que es igual al original
        assert decrypted == self.test_data
    
    def test_encrypt_decrypt_empty_string(self):
        """Test encriptación de string vacío"""
        encrypted = self.service.encrypt("")
        decrypted = self.service.decrypt("")
        
        assert encrypted == ""
        assert decrypted == ""
    
    def test_encrypt_decrypt_dict(self):
        """Test encriptación/desencriptación de diccionarios"""
        # Encriptar
        encrypted = self.service.encrypt_dict(self.test_dict)
        
        # Verificar que no es igual al original
        assert encrypted != str(self.test_dict)
        assert encrypted != ""
        
        # Desencriptar
        decrypted = self.service.decrypt_dict(encrypted)
        
        # Verificar que es igual al original
        assert decrypted == self.test_dict
    
    def test_encrypt_sensitive_fields(self):
        """Test encriptación de campos específicos en diccionario"""
        data = {
            "public_field": "public_value",
            "secret_field": "secret_value",
            "normal_field": "normal_value"
        }
        sensitive_fields = ["secret_field"]
        
        encrypted_data = self.service.encrypt_sensitive_fields(data, sensitive_fields)
        
        # Verificar que el campo sensible está encriptado
        assert encrypted_data["secret_field"] != "secret_value"
        assert encrypted_data["secret_field_encrypted"] is True
        
        # Verificar que los campos no sensibles no cambiaron
        assert encrypted_data["public_field"] == "public_value"
        assert encrypted_data["normal_field"] == "normal_value"
    
    def test_decrypt_sensitive_fields(self):
        """Test desencriptación de campos específicos en diccionario"""
        data = {
            "public_field": "public_value",
            "secret_field": "secret_value",
            "normal_field": "normal_value"
        }
        sensitive_fields = ["secret_field"]
        
        # Primero encriptar para tener un valor válido
        encrypted_data = self.service.encrypt_sensitive_fields(data, sensitive_fields)
        
        # Luego desencriptar
        decrypted_data = self.service.decrypt_sensitive_fields(encrypted_data, sensitive_fields)
        
        # Verificar que el campo sensible fue desencriptado
        assert decrypted_data["secret_field"] == "secret_value"
        assert "secret_field_encrypted" not in decrypted_data
        
        # Verificar que los campos no sensibles no cambiaron
        assert decrypted_data["public_field"] == "public_value"
        assert decrypted_data["normal_field"] == "normal_value"
    
    def test_decrypt_invalid_data(self):
        """Test desencriptación de datos inválidos"""
        with pytest.raises(ValueError):
            self.service.decrypt("invalid_encrypted_data")
        
        with pytest.raises(ValueError):
            self.service.decrypt_dict("invalid_encrypted_data")
    
    def test_encryption_consistency(self):
        """Test que la encriptación es consistente"""
        # Encriptar el mismo dato múltiples veces
        encrypted1 = self.service.encrypt(self.test_data)
        encrypted2 = self.service.encrypt(self.test_data)
        
        # Los resultados pueden ser diferentes (debido a IV/salt)
        # pero ambos deben desencriptar al mismo resultado
        assert encrypted1 != encrypted2  # Pueden ser diferentes
        
        decrypted1 = self.service.decrypt(encrypted1)
        decrypted2 = self.service.decrypt(encrypted2)
        
        assert decrypted1 == decrypted2 == self.test_data
    
    def test_unicode_support(self):
        """Test soporte para caracteres Unicode"""
        unicode_data = "Datos sensibles con ñáéíóú y emojis 🚀🔒"
        
        encrypted = self.service.encrypt(unicode_data)
        decrypted = self.service.decrypt(encrypted)
        
        assert decrypted == unicode_data
    
    def test_large_data_encryption(self):
        """Test encriptación de datos grandes"""
        large_data = "x" * 10000  # 10KB de datos
        
        encrypted = self.service.encrypt(large_data)
        decrypted = self.service.decrypt(encrypted)
        
        assert decrypted == large_data
    
    def test_generate_encryption_key(self):
        """Test generación de clave de encriptación"""
        from app.services.encryption import generate_encryption_key
        
        key1 = generate_encryption_key()
        key2 = generate_encryption_key()
        
        # Las claves deben ser diferentes
        assert key1 != key2
        
        # Las claves deben ser strings base64 válidos
        import base64
        base64.urlsafe_b64decode(key1)
        base64.urlsafe_b64decode(key2)
    
    def test_setup_encryption_env(self):
        """Test configuración de variables de entorno"""
        from app.services.encryption import setup_encryption_env
        
        env_config = setup_encryption_env()
        
        # Verificar que contiene la configuración esperada
        assert "ENCRYPTION_KEY" in env_config
        assert "Genera una nueva clave" in env_config
        assert "AWS Secrets Manager" in env_config


class TestGlobalEncryptionService:
    """Tests para la instancia global del servicio de encriptación"""
    
    def test_global_service_availability(self):
        """Test que el servicio global está disponible"""
        assert encryption_service is not None
        assert isinstance(encryption_service, EncryptionService)
    
    def test_global_service_functionality(self):
        """Test funcionalidad del servicio global"""
        test_data = "Global service test data"
        
        encrypted = encrypt_sensitive_data(test_data)
        decrypted = decrypt_sensitive_data(encrypted)
        
        assert decrypted == test_data
    
    def test_cert_data_encryption(self):
        """Test encriptación de datos de certificado"""
        cert_data = {
            "cert_path": "/path/to/cert.p12",
            "cert_password": "cert_password_123",
            "api_key": "api_key_secret"
        }
        
        encrypted = encrypt_cert_data(cert_data)
        decrypted = decrypt_cert_data(encrypted)
        
        assert decrypted == cert_data
    
    def test_user_secrets_encryption(self):
        """Test encriptación de secretos de usuario"""
        user_data = {
            "username": "test_user",
            "pin_code": "1234",
            "recovery_email": "recovery@example.com",
            "phone_number": "+1234567890"
        }
        
        encrypted = encrypt_user_secrets(user_data)
        decrypted = decrypt_user_secrets(encrypted)
        
        assert decrypted == user_data


class TestEncryptionIntegrity:
    """Tests para verificación de integridad de datos encriptados"""
    
    def test_verify_encryption_integrity(self):
        """Test verificación de integridad"""
        from app.services.encryption import verify_encryption_integrity
        
        test_data = "Integrity test data"
        encrypted = encrypt_sensitive_data(test_data)
        
        # Verificar integridad sin hash esperado
        assert verify_encryption_integrity(encrypted) is True
        
        # Verificar integridad con hash esperado
        import hashlib
        expected_hash = hashlib.sha256(test_data.encode()).hexdigest()
        assert verify_encryption_integrity(encrypted, expected_hash) is True
        
        # Verificar integridad con hash incorrecto
        assert verify_encryption_integrity(encrypted, "wrong_hash") is False
    
    def test_verify_encryption_integrity_invalid_data(self):
        """Test verificación de integridad con datos inválidos"""
        from app.services.encryption import verify_encryption_integrity
        
        assert verify_encryption_integrity("invalid_data") is False


class TestSecureContext:
    """Tests para el context manager SecureContext"""
    
    def test_secure_context_execution(self):
        """Test ejecución del context manager seguro"""
        from app.services.encryption import SecureContext
        
        with SecureContext("test_operation") as context:
            assert context.operation == "test_operation"
        
        # El context manager debería completarse sin errores
    
    def test_secure_context_with_exception(self):
        """Test context manager con excepción"""
        from app.services.encryption import SecureContext
        
        with pytest.raises(ValueError):
            with SecureContext("test_operation") as context:
                raise ValueError("Test exception")


class TestMigrationUtilities:
    """Tests para utilidades de migración de datos"""
    
    def test_migrate_to_encrypted_data_dry_run(self):
        """Test migración en modo dry run"""
        from app.services.encryption import migrate_to_encrypted_data
        
        result = migrate_to_encrypted_data(
            table_name="users", # Use a real table name
            sensitive_columns=["pin_code"],
            dry_run=True
        )
        
        assert result["table"] == "users"
        assert result["columns"] == ["pin_code"]
        assert result["dry_run"] is True
        assert "message" in result
        assert "DRY RUN" in result["message"]


# Tests de integración con modelos
class TestModelEncryption:
    """Tests para encriptación en modelos SQLAlchemy"""
    
    def test_secure_user_model_encryption(self):
        """Test encriptación en modelo de usuario"""
        from app.models import User as SecureUser
        
        user = SecureUser()
        
        # Establecer datos sensibles
        user.pin_code = "1234"
        user.recovery_email = "recovery@example.com"
        user.phone_number = "+1234567890"
        
        # Verificar que los datos se encriptan automáticamente
        assert user._pin_code_encrypted is not None
        assert user._pin_code_encrypted != "1234"
        assert user._recovery_email_encrypted is not None
        assert user._recovery_email_encrypted != "recovery@example.com"
        
        # Verificar que los datos se desencriptan correctamente
        assert user.pin_code == "1234"
        assert user.recovery_email == "recovery@example.com"
        assert user.phone_number == "+1234567890"
    
    def test_secure_user_model_has_sensitive_data(self):
        """Test detección de datos sensibles en modelo de usuario"""
        from app.models import User as SecureUser
        
        user = SecureUser()
        
        # Sin datos sensibles
        assert user.has_sensitive_data() is False
        
        # Con datos sensibles
        user.pin_code = "1234"
        assert user.has_sensitive_data() is True
    
    def test_secure_user_model_to_dict_safe(self):
        """Test exportación segura de diccionario"""
        from app.models import User as SecureUser
        
        user = SecureUser()
        user.id = 1
        user.username = "testuser"
        user.email = "test@example.com"
        user.pin_code = "1234"  # Dato sensible
        
        safe_dict = user.to_dict_safe()
        
        # Verificar que los datos sensibles no están incluidos
        assert "pin_code" not in safe_dict
        assert "_pin_code_encrypted" not in safe_dict
        
        # Verificar que los datos públicos sí están incluidos
        assert safe_dict["id"] == 1
        assert safe_dict["username"] == "testuser"
        assert safe_dict["email"] == "test@example.com"
        assert "has_sensitive_data" in safe_dict
    
    def test_secure_user_model_to_dict_with_sensitive(self):
        """Test exportación con datos sensibles"""
        from app.models import User as SecureUser
        
        user = SecureUser()
        user.id = 1
        user.username = "testuser"
        user.pin_code = "1234"
        
        # Sin datos sensibles
        safe_dict = user.to_dict_with_sensitive(include_sensitive=False)
        assert "pin_code" not in safe_dict
        
        # Con datos sensibles
        full_dict = user.to_dict_with_sensitive(include_sensitive=True)
        assert "pin_code" in full_dict
        assert full_dict["pin_code"] == "1234"


# Tests de rendimiento
class TestEncryptionPerformance:
    """Tests de rendimiento para el servicio de encriptación"""
    
    def test_encryption_performance_small_data(self):
        """Test rendimiento con datos pequeños"""
        import time
        
        test_data = "Small test data"
        iterations = 1000
        
        start_time = time.time()
        
        for _ in range(iterations):
            encrypted = encryption_service.encrypt(test_data)
            decrypted = encryption_service.decrypt(encrypted)
        
        end_time = time.time()
        avg_time = (end_time - start_time) / iterations
        
        # Debe ser rápido (menos de 1ms por operación en promedio)
        assert avg_time < 0.001, f"Encryption too slow: {avg_time:.4f}s per operation"
    
    def test_encryption_performance_large_data(self):
        """Test rendimiento con datos grandes"""
        import time
        
        test_data = "x" * 10000  # 10KB
        iterations = 100
        
        start_time = time.time()
        
        for _ in range(iterations):
            encrypted = encryption_service.encrypt(test_data)
            decrypted = encryption_service.decrypt(encrypted)
        
        end_time = time.time()
        avg_time = (end_time - start_time) / iterations
        
        # Debe ser razonable (menos de 10ms por operación en promedio)
        assert avg_time < 0.01, f"Large data encryption too slow: {avg_time:.4f}s per operation"


# Fixtures para pytest
@pytest.fixture
def sample_sensitive_data():
    """Fixture con datos sensibles de ejemplo"""
    return {
        "user_secrets": {
            "pin_code": "1234",
            "recovery_email": "recovery@example.com",
            "phone_number": "+1234567890"
        },
        "cert_data": {
            "cert_path": "/path/to/cert.p12",
            "cert_password": "cert_password_123",
            "api_key": "api_key_secret"
        }
    }


@pytest.fixture
def encryption_service_instance():
    """Fixture con instancia del servicio de encriptación"""
    return EncryptionService()
