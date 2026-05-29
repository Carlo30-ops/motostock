"""
Tests para el servicio de refresh tokens
Valida la gestión segura de tokens JWT con refresh tokens
"""

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import Mock, patch
from jose import JWTError, jwt

from app.services.auth_refresh import (
    RefreshTokenService, 
    create_user_tokens,
    get_current_user_from_token,
    update_refresh_token_usage
)
from app.models import User, RefreshToken


class TestRefreshTokenService:
    """Tests para la clase RefreshTokenService"""
    
    def setup_method(self):
        """Configuración inicial para cada test"""
        self.service = RefreshTokenService()
        self.mock_user = Mock(spec=User)
        self.mock_user.id = 1
        self.mock_user.username = "testuser"
        self.mock_user.email = "test@example.com"
        self.mock_user.role = "admin"
        self.mock_user.is_active = True
        self.mock_db = Mock()
    
    def test_create_access_token(self):
        """Test creación de access token"""
        data = {"sub": "testuser", "user_id": 1, "role": "admin"}
        
        token = self.service.create_access_token(data)
        
        assert token is not None
        assert isinstance(token, str)
        
        # Verificar que el token contiene los datos correctos
        payload = jwt.decode(token, "test_secret", algorithms=["HS256"])
        assert payload["sub"] == "testuser"
        assert payload["user_id"] == 1
        assert payload["role"] == "admin"
        assert payload["type"] == "access"
        assert "exp" in payload
    
    def test_create_access_token_with_expiry(self):
        """Test creación de access token con expiración personalizada"""
        data = {"sub": "testuser"}
        expires_delta = timedelta(hours=2)
        
        token = self.service.create_access_token(data, expires_delta)
        
        payload = jwt.decode(token, "test_secret", algorithms=["HS256"])
        
        # Verificar que la expiración es aproximadamente 2 horas desde ahora
        exp_time = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        expected_time = datetime.now(timezone.utc) + expires_delta
        
        # Permitir una diferencia de 5 segundos
        time_diff = abs((exp_time - expected_time).total_seconds())
        assert time_diff < 5
    
    def test_create_refresh_token(self):
        """Test creación de refresh token"""
        refresh_token = self.service.create_refresh_token(self.mock_user.id, self.mock_db)
        
        assert refresh_token is not None
        assert isinstance(refresh_token, str)
        assert len(refresh_token) > 20  # Los refresh tokens son largos
        
        # Verificar que se guardó en la base de datos
        self.mock_db.add.assert_called_once()
        self.mock_db.commit.assert_called_once()
    
    def test_create_refresh_token_revokes_existing(self):
        """Test que crear refresh token revoca los existentes"""
        # Simular que ya existe un refresh token
        self.service.revoke_user_refresh_tokens = Mock(return_value=2)
        
        refresh_token = self.service.create_refresh_token(self.mock_user.id, self.mock_db)
        
        # Verificar que se revocaron los tokens existentes
        self.service.revoke_user_refresh_tokens.assert_called_once_with(self.mock_user.id, self.mock_db)
        
        # Verificar que se creó el nuevo token
        assert refresh_token is not None
        self.mock_db.add.assert_called_once()
        self.mock_db.commit.assert_called_once()
    
    def test_verify_refresh_token_valid(self):
        """Test verificación de refresh token válido"""
        # Simular refresh token en base de datos
        mock_refresh_token = Mock(spec=RefreshToken)
        mock_refresh_token.user_id = self.mock_user.id
        mock_refresh_token.expires_at = datetime.now(timezone.utc) + timedelta(days=30)
        
        self.mock_db.query.return_value.filter.return_value.first.return_value = mock_refresh_token
        self.mock_db.query.return_value.filter.return_value.filter.return_value.first.return_value = self.mock_user
        
        user = self.service.verify_refresh_token("valid_refresh_token", self.mock_db)
        
        assert user == self.mock_user
    
    def test_verify_refresh_token_not_found(self):
        """Test verificación de refresh token no encontrado"""
        self.mock_db.query.return_value.filter.return_value.first.return_value = None
        
        user = self.service.verify_refresh_token("invalid_refresh_token", self.mock_db)
        
        assert user is None
    
    def test_verify_refresh_token_expired(self):
        """Test verificación de refresh token expirado"""
        # Simular refresh token expirado
        mock_refresh_token = Mock(spec=RefreshToken)
        mock_refresh_token.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
        
        self.mock_db.query.return_value.filter.return_value.first.return_value = mock_refresh_token
        
        user = self.service.verify_refresh_token("expired_refresh_token", self.mock_db)
        
        assert user is None
    
    def test_verify_refresh_token_inactive_user(self):
        """Test verificación de refresh token con usuario inactivo"""
        # Simular refresh token válido pero usuario inactivo
        mock_refresh_token = Mock(spec=RefreshToken)
        mock_refresh_token.user_id = self.mock_user.id
        mock_refresh_token.expires_at = datetime.now(timezone.utc) + timedelta(days=30)
        
        inactive_user = Mock(spec=User)
        inactive_user.id = self.mock_user.id
        inactive_user.is_active = False
        
        self.mock_db.query.return_value.filter.return_value.first.return_value = mock_refresh_token
        self.mock_db.query.return_value.filter.return_value.filter.return_value.first.return_value = inactive_user
        
        user = self.service.verify_refresh_token("valid_refresh_token", self.mock_db)
        
        assert user is None
    
    def test_revoke_refresh_token_valid(self):
        """Test revocación de refresh token válido"""
        mock_refresh_token = Mock(spec=RefreshToken)
        mock_refresh_token.is_active = True
        
        self.mock_db.query.return_value.filter.return_value.first.return_value = mock_refresh_token
        
        result = self.service.revoke_refresh_token("valid_refresh_token", self.mock_db)
        
        assert result is True
        assert mock_refresh_token.is_active is False
        assert mock_refresh_token.revoked_at is not None
        self.mock_db.commit.assert_called_once()
    
    def test_revoke_refresh_token_not_found(self):
        """Test revocación de refresh token no encontrado"""
        self.mock_db.query.return_value.filter.return_value.first.return_value = None
        
        result = self.service.revoke_refresh_token("invalid_refresh_token", self.mock_db)
        
        assert result is False
    
    def test_revoke_user_refresh_tokens(self):
        """Test revocación de todos los refresh tokens de un usuario"""
        # Simular 3 tokens activos
        mock_query = self.mock_db.query.return_value.filter.return_value
        mock_query.update.return_value = 3
        
        count = self.service.revoke_user_refresh_tokens(self.mock_user.id, self.mock_db)
        
        assert count == 3
        mock_query.update.assert_called_once()
        self.mock_db.commit.assert_called_once()
    
    def test_refresh_access_token_valid(self):
        """Test refresh de access token con refresh token válido"""
        # Simular refresh token válido
        mock_refresh_token = Mock(spec=RefreshToken)
        mock_refresh_token.user_id = self.mock_user.id
        mock_refresh_token.expires_at = datetime.now(timezone.utc) + timedelta(days=30)
        
        self.mock_db.query.return_value.filter.return_value.first.return_value = mock_refresh_token
        self.mock_db.query.return_value.filter.return_value.filter.return_value.first.return_value = self.mock_user
        
        # Mock para crear nuevo refresh token
        self.service.create_refresh_token = Mock(return_value="new_refresh_token")
        
        result = self.service.refresh_access_token("valid_refresh_token", self.mock_db)
        
        assert result is not None
        assert "access_token" in result
        assert "refresh_token" in result
        assert result["refresh_token"] == "new_refresh_token"
        assert "user" in result
        assert result["user"]["id"] == self.mock_user.id
        assert result["user"]["username"] == self.mock_user.username
    
    def test_refresh_access_token_invalid(self):
        """Test refresh de access token con refresh token inválido"""
        self.mock_db.query.return_value.filter.return_value.first.return_value = None
        
        result = self.service.refresh_access_token("invalid_refresh_token", self.mock_db)
        
        assert result is None
    
    def test_logout_valid(self):
        """Test logout con refresh token válido"""
        mock_refresh_token = Mock(spec=RefreshToken)
        mock_refresh_token.is_active = True
        
        self.mock_db.query.return_value.filter.return_value.first.return_value = mock_refresh_token
        
        result = self.service.logout("valid_refresh_token", self.mock_db)
        
        assert result is True
        assert mock_refresh_token.is_active is False
    
    def test_logout_invalid(self):
        """Test logout con refresh token inválido"""
        self.mock_db.query.return_value.filter.return_value.first.return_value = None
        
        result = self.service.logout("invalid_refresh_token", self.mock_db)
        
        assert result is False
    
    def test_logout_all(self):
        """Test logout en todos los dispositivos"""
        self.service.revoke_user_refresh_tokens = Mock(return_value=3)
        
        count = self.service.logout_all(self.mock_user.id, self.mock_db)
        
        assert count == 3
        self.service.revoke_user_refresh_tokens.assert_called_once_with(self.mock_user.id, self.mock_db)
    
    def test_cleanup_expired_tokens(self):
        """Test limpieza de tokens expirados"""
        mock_query = self.mock_db.query.return_value.filter.return_value
        mock_query.delete.return_value = 5
        
        count = self.service.cleanup_expired_tokens(self.mock_db)
        
        assert count == 5
        mock_query.delete.assert_called_once()
        self.mock_db.commit.assert_called_once()


class TestRefreshTokenHelpers:
    """Tests para funciones helper de refresh tokens"""
    
    def setup_method(self):
        """Configuración inicial para cada test"""
        self.mock_user = Mock(spec=User)
        self.mock_user.id = 1
        self.mock_user.username = "testuser"
        self.mock_user.email = "test@example.com"
        self.mock_user.role = "admin"
        self.mock_db = Mock()
    
    @patch('app.services.auth_refresh.RefreshTokenService.create_access_token')
    @patch('app.services.auth_refresh.RefreshTokenService.create_refresh_token')
    def test_create_user_tokens(self, mock_create_refresh, mock_create_access):
        """Test creación de tokens para usuario"""
        mock_create_access.return_value = "access_token_123"
        mock_create_refresh.return_value = "refresh_token_456"
        
        result = create_user_tokens(self.mock_user, self.mock_db)
        
        assert result["access_token"] == "access_token_123"
        assert result["refresh_token"] == "refresh_token_456"
        assert result["token_type"] == "bearer"
        assert "expires_in" in result
        assert "user" in result
        assert result["user"]["id"] == self.mock_user.id
        assert result["user"]["username"] == self.mock_user.username
        
        mock_create_access.assert_called_once_with({
            "sub": self.mock_user.username,
            "user_id": self.mock_user.id,
            "role": self.mock_user.role
        })
        mock_create_refresh.assert_called_once_with(self.mock_user.id, self.mock_db)
    
    @patch('app.services.auth_refresh.RefreshTokenService.verify_refresh_token')
    def test_get_current_user_from_token_valid(self, mock_verify):
        """Test obtener usuario actual desde token válido"""
        mock_verify.return_value = self.mock_user
        
        user = get_current_user_from_token("valid_token", self.mock_db)
        
        assert user == self.mock_user
        mock_verify.assert_called_once_with("valid_token", self.mock_db)
    
    @patch('app.services.auth_refresh.RefreshTokenService.verify_refresh_token')
    def test_get_current_user_from_token_invalid(self, mock_verify):
        """Test obtener usuario actual desde token inválido"""
        mock_verify.return_value = None
        
        user = get_current_user_from_token("invalid_token", self.mock_db)
        
        assert user is None
        mock_verify.assert_called_once_with("invalid_token", self.mock_db)
    
    def test_update_refresh_token_usage(self):
        """Test actualización de último uso de refresh token"""
        mock_refresh_token = Mock(spec=RefreshToken)
        mock_refresh_token.last_used_at = None
        
        self.mock_db.query.return_value.filter.return_value.first.return_value = mock_refresh_token
        
        update_refresh_token_usage("refresh_token", self.mock_db)
        
        assert mock_refresh_token.last_used_at is not None
        self.mock_db.commit.assert_called_once()


class TestRefreshTokenSecurity:
    """Tests de seguridad para refresh tokens"""
    
    def setup_method(self):
        """Configuración inicial para cada test"""
        self.service = RefreshTokenService()
        self.mock_user = Mock(spec=User)
        self.mock_user.id = 1
        self.mock_user.username = "testuser"
        self.mock_user.is_active = True
        self.mock_db = Mock()
    
    def test_refresh_token_uniqueness(self):
        """Test que cada refresh token es único"""
        token1 = self.service.create_refresh_token(self.mock_user.id, self.mock_db)
        token2 = self.service.create_refresh_token(self.mock_user.id, self.mock_db)
        
        assert token1 != token2
    
    def test_refresh_token_length(self):
        """Test que los refresh tokens tienen longitud adecuada"""
        refresh_token = self.service.create_refresh_token(self.mock_user.id, self.mock_db)
        
        # Los refresh tokens deberían tener al menos 32 caracteres
        assert len(refresh_token) >= 32
    
    def test_access_token_expiration(self):
        """Test que los access tokens expiran correctamente"""
        data = {"sub": "testuser"}
        
        token = self.service.create_access_token(data)
        
        # El token debería expirar en el tiempo configurado
        with patch('app.services.auth_refresh.settings.ACCESS_TOKEN_EXPIRE_MINUTES', 1):
            token_short = self.service.create_access_token(data)
            
            payload_short = jwt.decode(token_short, "test_secret", algorithms=["HS256"])
            exp_short = datetime.fromtimestamp(payload_short["exp"], tz=timezone.utc)
            expected_short = datetime.now(timezone.utc) + timedelta(minutes=1)
            
            time_diff = abs((exp_short - expected_short).total_seconds())
            assert time_diff < 5
    
    def test_refresh_token_expiration(self):
        """Test que los refresh tokens expiran en 30 días"""
        refresh_token = self.service.create_refresh_token(self.mock_user.id, self.mock_db)
        
        # Verificar que se guardó con expiración de 30 días
        mock_refresh_token = self.mock_db.add.call_args[0][0]
        expected_expiry = datetime.now(timezone.utc) + timedelta(days=30)
        
        time_diff = abs((mock_refresh_token.expires_at - expected_expiry).total_seconds())
        assert time_diff < 5
    
    def test_token_type_validation(self):
        """Test que los tokens tienen el tipo correcto"""
        data = {"sub": "testuser"}
        
        access_token = self.service.create_access_token(data)
        
        payload = jwt.decode(access_token, "test_secret", algorithms=["HS256"])
        assert payload["type"] == "access"
    
    def test_concurrent_refresh_token_creation(self):
        """Test creación concurrente de refresh tokens"""
        import threading
        import time
        
        tokens = []
        errors = []
        
        def create_token():
            try:
                token = self.service.create_refresh_token(self.mock_user.id, self.mock_db)
                tokens.append(token)
            except Exception as e:
                errors.append(e)
        
        # Crear 10 tokens concurrentemente
        threads = []
        for _ in range(10):
            thread = threading.Thread(target=create_token)
            threads.append(thread)
            thread.start()
        
        for thread in threads:
            thread.join()
        
        # Verificar que todos los tokens se crearon correctamente
        assert len(errors) == 0
        assert len(tokens) == 10
        
        # Verificar que todos los tokens son únicos
        assert len(set(tokens)) == len(tokens)
    
    def test_refresh_token_revocation_persistence(self):
        """Test que la revocación de refresh tokens persiste"""
        mock_refresh_token = Mock(spec=RefreshToken)
        mock_refresh_token.is_active = True
        mock_refresh_token.revoked_at = None
        
        self.mock_db.query.return_value.filter.return_value.first.return_value = mock_refresh_token
        
        # Revocar token
        self.service.revoke_refresh_token("test_token", self.mock_db)
        
        # Verificar que los cambios se guardaron
        assert mock_refresh_token.is_active is False
        assert mock_refresh_token.revoked_at is not None
        self.mock_db.commit.assert_called_once()


class TestRefreshTokenIntegration:
    """Tests de integración para refresh tokens"""
    
    def test_full_authentication_flow(self):
        """Test flujo completo de autenticación"""
        mock_user = Mock(spec=User)
        mock_user.id = 1
        mock_user.username = "testuser"
        mock_user.email = "test@example.com"
        mock_user.role = "admin"
        mock_user.is_active = True
        mock_db = Mock()
        
        # 1. Crear tokens iniciales
        tokens = create_user_tokens(mock_user, mock_db)
        
        assert "access_token" in tokens
        assert "refresh_token" in tokens
        
        # 2. Simular expiración del access token
        # (en la práctica esto se detectaría con un error 401)
        
        # 3. Refrescar el access token
        service = RefreshTokenService()
        
        # Mock para simular refresh token válido
        mock_refresh_token = Mock(spec=RefreshToken)
        mock_refresh_token.user_id = mock_user.id
        mock_refresh_token.expires_at = datetime.now(timezone.utc) + timedelta(days=30)
        
        mock_db.query.return_value.filter.return_value.first.return_value = mock_refresh_token
        mock_db.query.return_value.filter.return_value.filter.return_value.first.return_value = mock_user
        service.create_refresh_token = Mock(return_value="new_refresh_token")
        
        new_tokens = service.refresh_access_token(tokens["refresh_token"], mock_db)
        
        assert new_tokens is not None
        assert "access_token" in new_tokens
        assert "refresh_token" in new_tokens
        assert new_tokens["refresh_token"] == "new_refresh_token"
        
        # 4. Logout
        service.revoke_refresh_token(new_tokens["refresh_token"], mock_db)
        
        # 5. Intento de refresh fallido
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        failed_refresh = service.refresh_access_token(new_tokens["refresh_token"], mock_db)
        
        assert failed_refresh is None


# Tests de error handling
class TestRefreshTokenErrorHandling:
    """Tests para manejo de errores en refresh tokens"""
    
    def setup_method(self):
        """Configuración inicial para cada test"""
        self.service = RefreshTokenService()
        self.mock_db = Mock()
    
    def test_database_connection_error(self):
        """Test manejo de error de conexión a base de datos"""
        self.mock_db.query.side_effect = Exception("Database connection error")
        
        with pytest.raises(Exception):
            self.service.verify_refresh_token("test_token", self.mock_db)
    
    def test_invalid_token_format(self):
        """Test manejo de token con formato inválido"""
        with pytest.raises(JWTError):
            jwt.decode("invalid_token", "test_secret", algorithms=["HS256"])
    
    def test_corrupted_refresh_token(self):
        """Test manejo de refresh token corrupto"""
        # Simular refresh token corrupto en base de datos
        mock_refresh_token = Mock(spec=RefreshToken)
        mock_refresh_token.user_id = 1
        mock_refresh_token.expires_at = datetime.now(timezone.utc) + timedelta(days=30)
        
        self.mock_db.query.return_value.filter.return_value.first.return_value = mock_refresh_token
        
        # Mock para que falle la creación de nuevo refresh token
        self.service.create_refresh_token = Mock(side_effect=Exception("Token creation failed"))
        
        result = self.service.refresh_access_token("corrupted_token", self.mock_db)
        
        assert result is None


# Fixtures para pytest
@pytest.fixture
def mock_user():
    """Fixture con usuario mock"""
    user = Mock(spec=User)
    user.id = 1
    user.username = "testuser"
    user.email = "test@example.com"
    user.role = "admin"
    user.is_active = True
    return user


@pytest.fixture
def mock_db():
    """Fixture con base de datos mock"""
    return Mock()


@pytest.fixture
def refresh_token_service():
    """Fixture con servicio de refresh tokens"""
    return RefreshTokenService()
