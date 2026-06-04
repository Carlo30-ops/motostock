from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app import schemas, models
from app.database import get_db
from app.services.auth import (
    authenticate_user,
    authenticate_user_by_pin,
    create_access_token,
    get_current_active_user,
)
from app.config import settings
from app.middleware.rate_limiter import limiter
from app.services.auth_refresh import (
    RefreshTokenService,
    create_user_tokens,
    update_refresh_token_usage,
)

router = APIRouter()


@router.post("/token", response_model=schemas.Token)
@limiter.limit("5/minute")
def login_for_access_token(
    request: Request,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Session = Depends(get_db)
):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    tokens = create_user_tokens(user, db)
    return {
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "token_type": "bearer",
        "role": tokens["user"]["role"],
    }


@router.post("/refresh", response_model=schemas.Token)
@limiter.limit("20/minute")
def refresh_access_token(request: Request, payload: schemas.RefreshTokenRequest, db: Session = Depends(get_db)):
    """Refresca el access token usando un refresh token válido."""
    tokens = RefreshTokenService.refresh_access_token(payload.refresh_token, db)
    if not tokens:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token inválido o expirado")
    
    # Actualizar último uso
    update_refresh_token_usage(payload.refresh_token, db)
    
    return {
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "token_type": tokens["token_type"],
        "role": tokens["user"]["role"],
    }


@router.post("/logout")
def logout(payload: schemas.RefreshTokenRequest, db: Session = Depends(get_db)):
    """Revoca el refresh token para cerrar la sesión."""
    RefreshTokenService.logout(payload.refresh_token, db)
    return {"message": "Sesión cerrada correctamente"}


@router.post("/pin-token", response_model=schemas.Token)
@limiter.limit("10/minute")
def login_with_pin(request: Request, payload: schemas.PinLogin, db: Session = Depends(get_db)):
    """Login rápido vía PIN (devuelve tokens completos)."""
    user = authenticate_user_by_pin(db, payload.pin)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="PIN inválido",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    tokens = create_user_tokens(user, db)
    return {
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "token_type": "bearer",
        "role": tokens["user"]["role"],
    }


@router.get("/users/me", response_model=schemas.UserOut)
def read_users_me(
    current_user: Annotated[models.User, Depends(get_current_active_user)]
):
    return current_user
