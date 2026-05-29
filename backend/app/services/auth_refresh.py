"""
Servicio de autenticación con refresh tokens
Implementación segura de JWT con refresh tokens para mayor seguridad
"""

import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException, status

from app.config import settings
from app.models import User, RefreshToken
from app.database import get_db
from app.services.auth import oauth2_scheme


class RefreshTokenService:
    """Servicio para manejo de refresh tokens"""
    
    @staticmethod
    def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """Crea un access token de corta duración"""
        to_encode = data.copy()
        
        if expires_delta:
            expire = datetime.now(timezone.utc) + expires_delta
        else:
            expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        
        to_encode.update({"exp": expire, "type": "access"})
        return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    
    @staticmethod
    def create_refresh_token(user_id: int, db: Session) -> str:
        """Crea un refresh token de larga duración"""
        # Eliminar refresh tokens existentes para este usuario
        RefreshTokenService.revoke_user_refresh_tokens(user_id, db)
        
        # Generar refresh token único
        refresh_token = secrets.token_urlsafe(32)
        
        # Guardar en base de datos
        db_refresh_token = RefreshToken(
            token=refresh_token,
            user_id=user_id,
            expires_at=datetime.now(timezone.utc) + timedelta(days=30), # 30 días
            created_at=datetime.now(timezone.utc)
        )
        
        db.add(db_refresh_token)
        db.commit()
        db.refresh(db_refresh_token)
        
        return refresh_token
    
    @staticmethod
    def verify_refresh_token(token: str, db: Session) -> Optional[User]:
        """Verifica un refresh token y retorna el usuario"""
        # Buscar token en base de datos
        db_token = db.query(RefreshToken).filter(
            RefreshToken.token == token,
            RefreshToken.is_active == True,
            RefreshToken.expires_at > datetime.now(timezone.utc)
        ).first()
        
        if not db_token:
            return None
        
        # Obtener usuario
        from app.services.tenant import bypass_tenant_context
        with bypass_tenant_context("Resolve user from refresh token", "system"):
            user = db.query(User).filter(User.id == db_token.user_id, User.is_active == True).first()
        
        return user
    
    @staticmethod
    def revoke_refresh_token(token: str, db: Session) -> bool:
        """Revoca un refresh token específico"""
        db_token = db.query(RefreshToken).filter(RefreshToken.token == token).first()
        
        if db_token:
            db_token.is_active = False
            db_token.revoked_at = datetime.now(timezone.utc)
            db.commit()
            return True
        
        return False
    
    @staticmethod
    def revoke_user_refresh_tokens(user_id: int, db: Session) -> int:
        """Revoca todos los refresh tokens de un usuario"""
        count = db.query(RefreshToken).filter(
            RefreshToken.user_id == user_id,
            RefreshToken.is_active == True
        ).update({
            RefreshToken.is_active: False,
            RefreshToken.revoked_at: datetime.now(timezone.utc)
        })
        
        db.commit()
        return count
    
    @staticmethod
    def refresh_access_token(refresh_token: str, db: Session) -> Optional[Dict[str, Any]]:
        """Usa un refresh token para generar un nuevo access token"""
        user = RefreshTokenService.verify_refresh_token(refresh_token, db)
        
        if not user:
            return None
        
        # Guardar atributos del usuario localmente antes del commit de la BD
        user_id = user.id
        username = user.username
        email = user.email
        role = user.role
        branch_id = user.branch_id
        organization_id = user.organization_id

        # Crear nuevo access token
        access_token = RefreshTokenService.create_access_token(
            data={"sub": username, "user_id": user_id, "role": role, "branch_id": branch_id, "organization_id": organization_id}
        )
        
        # Opcional: generar nuevo refresh token (security best practice)
        new_refresh_token = RefreshTokenService.create_refresh_token(user_id, db)
        
        return {
            "access_token": access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "user": {
                "id": user_id,
                "username": username,
                "email": email,
                "role": role
            }
        }
    
    @staticmethod
    def logout(refresh_token: str, db: Session) -> bool:
        """Cierra sesión revocando el refresh token"""
        return RefreshTokenService.revoke_refresh_token(refresh_token, db)
    
    @staticmethod
    def logout_all(user_id: int, db: Session) -> int:
        """Cierra sesión en todos los dispositivos del usuario"""
        return RefreshTokenService.revoke_user_refresh_tokens(user_id, db)
    
    @staticmethod
    def cleanup_expired_tokens(db: Session) -> int:
        """Limpia tokens expirados (para mantenimiento)"""
        expired_count = db.query(RefreshToken).filter(
            RefreshToken.expires_at < datetime.now(timezone.utc)
        ).delete()
        
        db.commit()
        return expired_count


# Funciones de ayuda para endpoints de autenticación
def create_user_tokens(user: User, db: Session) -> Dict[str, Any]:
    """Crea access y refresh tokens para un usuario"""
    # Guardar atributos localmente antes de cualquier commit de BD que pueda expirar la instancia
    user_id = user.id
    username = user.username
    email = user.email
    role = user.role
    branch_id = user.branch_id
    organization_id = user.organization_id

    access_token = RefreshTokenService.create_access_token(
        data={"sub": username, "user_id": user_id, "role": role, "branch_id": branch_id, "organization_id": organization_id}
    )
    refresh_token = RefreshTokenService.create_refresh_token(user_id, db)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": {
            "id": user_id,
            "username": username,
            "email": email,
            "role": role,
            "branch_id": branch_id
        }
    }


def authenticate_and_create_tokens(db: Session, username: str, password: str) -> Optional[Dict[str, Any]]:
    """Autentica usuario y crea tokens"""
    from app.services.auth import authenticate_user
    
    user = authenticate_user(db, username, password)
    if not user:
        return None
    
    return create_user_tokens(user, db)


def get_current_user_from_token(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> Optional[User]:
    """Obtiene usuario actual desde access token"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        user_id: int = payload.get("user_id")
        
        if username is None or user_id is None:
            return None
        
    except JWTError:
        return None
    
    from app.services.tenant import bypass_tenant_context
    with bypass_tenant_context("Resolve user from refresh auth token", "system"):
        user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    return user


# Middleware para actualizar last_used_at de refresh tokens
def update_refresh_token_usage(token: str, db: Session):
    """Actualiza la fecha de último uso del refresh token"""
    db_token = db.query(RefreshToken).filter(RefreshToken.token == token).first()
    if db_token:
        db_token.last_used_at = datetime.now(timezone.utc)
        db.commit()
