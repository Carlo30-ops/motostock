"""
Endpoints de autenticación con refresh tokens
"""

from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.services.auth_refresh import (
    RefreshTokenService,
    authenticate_and_create_tokens,
    get_current_user_from_token
)

router = APIRouter(prefix="/api/auth", tags=["authentication"])


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int
    user: dict


class TokenRefresh(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str


@router.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    Endpoint de login con refresh tokens
    """
    tokens = authenticate_and_create_tokens(db, form_data.username, form_data.password)
    
    if not tokens:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return tokens


@router.post("/refresh", response_model=Token)
async def refresh_access_token(
    token_data: TokenRefresh,
    db: Session = Depends(get_db)
):
    """
    Endpoint para refrescar access token usando refresh token
    """
    tokens = RefreshTokenService.refresh_access_token(token_data.refresh_token, db)
    
    if not tokens:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Actualizar último uso del refresh token
    RefreshTokenService.update_refresh_token_usage(token_data.refresh_token, db)
    
    return tokens


@router.post("/logout")
async def logout(
    token_data: TokenRefresh,
    db: Session = Depends(get_db)
):
    """
    Endpoint para cerrar sesión (revocar refresh token)
    """
    success = RefreshTokenService.logout(token_data.refresh_token, db)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Refresh token not found"
        )
    
    return {"message": "Successfully logged out"}


@router.post("/logout-all")
async def logout_all(
    current_user: UserResponse = Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """
    Endpoint para cerrar sesión en todos los dispositivos
    """
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    revoked_count = RefreshTokenService.logout_all(current_user.id, db)
    
    return {
        "message": f"Successfully logged out from {revoked_count} devices"
    }


@router.get("/me", response_model=UserResponse)
async def get_current_user(
    current_user: UserResponse = Depends(get_current_user_from_token)
):
    """
    Endpoint para obtener información del usuario actual
    """
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    return current_user


@router.post("/verify-token")
async def verify_token(
    token: str,
    db: Session = Depends(get_db)
):
    """
    Endpoint para verificar si un token es válido
    """
    user = get_current_user_from_token(token, db)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    
    return {
        "valid": True,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role
        }
    }


# Endpoint de mantenimiento (solo admin)
@router.post("/cleanup-tokens")
async def cleanup_expired_tokens(
    current_user: UserResponse = Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """
    Endpoint para limpiar tokens expirados (mantenimiento)
    Solo usuarios con rol admin pueden ejecutar
    """
    if not current_user or current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    cleaned_count = RefreshTokenService.cleanup_expired_tokens(db)
    
    return {
        "message": f"Cleaned up {cleaned_count} expired tokens"
    }
