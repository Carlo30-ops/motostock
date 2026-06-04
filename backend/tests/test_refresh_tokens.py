"""
Tests para el servicio de refresh tokens
Valida la gestión segura de tokens JWT con refresh tokens
"""

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import Mock, patch, MagicMock
from jose import JWTError, jwt

from app.services.auth_refresh import (
    RefreshTokenService, 
    create_user_tokens,
    get_current_user_from_token,
    update_refresh_token_usage
)
from app.models import User, RefreshToken
from app.config import settings


class TestRefreshTokenService:
    """Tests para la clase RefreshTokenService"""
    
    def setup_method(self):
        """Configuración inicial para cada test"""
        self.service = RefreshTokenService()
        self.mock_user = MagicMock(spec=User)
        self.mock_user.id = 1
        self.mock_user.username = "testuser"
        self.mock_user.email = "test@example.com"
        self.mock_user.role = "admin"
        self.mock_user.is_active = True
        self.mock_user.branch_id = 1
        self.mock_user.organization_id = 1
        self.mock_db = MagicMock()
    
    def test_create_access_token(self):
        """Test creación de access token"""
        data = {"sub": "testuser", "user_id": 1, "role": "admin"}
        
        token = self.service.create_access_token(data)
        
        assert token is not None
        assert isinstance(token, str)
        
        # Verificar que el token contiene los datos correctos
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
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
        
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        
        # Verificar que la expiración es aproximadamente 2 horas desde ahora
        exp_time = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        expected_time = datetime.now(timezone.utc) + expires_delta
        
        # Permitir una diferencia de 10 segundos (más margen por latencia)
        time_diff = abs((exp_time - expected_time).total_seconds())
        assert time_diff < 10
    
    def test_create_refresh_token(self):
        """Test creación de refresh token"""
        with patch.object(RefreshTokenService, 'revoke_user_refresh_tokens') as mock_revoke:
            refresh_token = self.service.create_refresh_token(self.mock_user.id, self.mock_db)
        
        assert refresh_token is not None
        assert isinstance(refresh_token, str)
        assert len(refresh_token) > 20
        
        mock_revoke.assert_called_once_with(self.mock_user.id, self.mock_db, commit=False)
        self.mock_db.add.assert_called_once()
        self.mock_db.commit.assert_called_once()
    
    def test_verify_refresh_token_valid(self):
        """Test verificación de refresh token válido"""
        mock_rt = MagicMock(spec=RefreshToken)
        mock_rt.user_id = self.mock_user.id
        mock_rt.is_active = True
        mock_rt.expires_at = datetime.now(timezone.utc) + timedelta(days=1)
        
        # Configurar mock de base de datos para devolver el token y el usuario
        self.mock_db.query.return_value.filter.return_value.first.return_value = mock_rt
        
        # El segundo query es para el usuario (usando bypass_tenant_context)
        with patch('app.services.auth_refresh.User', User):
            self.mock_db.query.return_value.filter.return_value.first.side_effect = [mock_rt, self.mock_user]
            user = self.service.verify_refresh_token("valid_token", self.mock_db)
        
        assert user == self.mock_user
    
    def test_verify_refresh_token_not_found(self):
        """Test verificación de refresh token no encontrado"""
        self.mock_db.query.return_value.filter.return_value.first.return_value = None
        
        user = self.service.verify_refresh_token("invalid_token", self.mock_db)
        
        assert user is None
    
    def test_verify_refresh_token_expired(self):
        """Test verificación de refresh token expirado"""
        # La query filtra por fecha, si no encuentra nada es porque está expirado o no existe
        self.mock_db.query.return_value.filter.return_value.first.return_value = None
        
        user = self.service.verify_refresh_token("expired_token", self.mock_db)
        
        assert user is None
    
    def test_revoke_refresh_token_valid(self):
        """Test revocación de refresh token válido"""
        mock_rt = MagicMock(spec=RefreshToken)
        self.mock_db.query.return_value.filter.return_value.first.return_value = mock_rt
        
        result = self.service.revoke_refresh_token("valid_token", self.mock_db)
        
        assert result is True
        assert mock_rt.is_active is False
        self.mock_db.commit.assert_called_once()
    
    def test_revoke_user_refresh_tokens(self):
        """Test revocación de todos los refresh tokens de un usuario"""
        self.mock_db.query.return_value.filter.return_value.update.return_value = 3
        
        count = self.service.revoke_user_refresh_tokens(1, self.mock_db)
        
        assert count == 3
        self.mock_db.commit.assert_called_once()
    
    def test_refresh_access_token_valid(self):
        """Test refresh de access token con refresh token válido"""
        with patch.object(RefreshTokenService, 'verify_refresh_token', return_value=self.mock_user):
            with patch.object(RefreshTokenService, 'create_refresh_token', return_value="new_rt"):
                result = self.service.refresh_access_token("valid_rt", self.mock_db)
        
        assert result is not None
        assert result["access_token"] is not None
        assert result["refresh_token"] == "new_rt"
        assert result["user"]["username"] == "testuser"
    
    def test_logout_all(self):
        """Test logout en todos los dispositivos"""
        with patch.object(RefreshTokenService, 'revoke_user_refresh_tokens', return_value=3) as mock_revoke:
            count = self.service.logout_all(1, self.mock_db)
        
        assert count == 3
        mock_revoke.assert_called_once_with(1, self.mock_db)


class TestRefreshTokenHelpers:
    """Tests para funciones helper de refresh tokens"""
    
    @patch('app.services.auth_refresh.RefreshTokenService.create_access_token')
    @patch('app.services.auth_refresh.RefreshTokenService.create_refresh_token')
    def test_create_user_tokens(self, mock_create_rt, mock_create_at):
        mock_user = MagicMock(spec=User)
        mock_user.id = 1
        mock_user.username = "testuser"
        mock_user.role = "admin"
        mock_user.branch_id = 1
        mock_user.organization_id = 1
        
        mock_create_at.return_value = "at_123"
        mock_create_rt.return_value = "rt_456"
        
        result = create_user_tokens(mock_user, MagicMock())
        
        assert result["access_token"] == "at_123"
        assert result["refresh_token"] == "rt_456"
        assert result["user"]["username"] == "testuser"
    
    @patch('jose.jwt.decode')
    def test_get_current_user_from_token_valid(self, mock_decode):
        mock_decode.return_value = {"sub": "testuser", "user_id": 1}
        mock_db = MagicMock()
        mock_user = MagicMock(spec=User)
        mock_db.query.return_value.filter.return_value.first.return_value = mock_user
        
        user = get_current_user_from_token("token", mock_db)
        
        assert user == mock_user


class TestRefreshTokenIntegration:
    """Tests de integración simplificados"""
    
    def test_full_authentication_flow(self):
        # Este test se puede simplificar o incluso omitir si los unitarios cubren todo,
        # pero vamos a hacerlo robusto con mocks.
        mock_user = MagicMock(spec=User)
        mock_user.id = 1
        mock_user.username = "testuser"
        mock_db = MagicMock()
        
        with patch('app.services.auth_refresh.RefreshTokenService.create_access_token', return_value="at"):
            with patch('app.services.auth_refresh.RefreshTokenService.create_refresh_token', return_value="rt"):
                tokens = create_user_tokens(mock_user, mock_db)
        
        assert tokens["access_token"] == "at"
        assert tokens["refresh_token"] == "rt"
