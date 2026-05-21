"""Endpoints 2FA (TOTP) — Fase B."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.services.auth import get_current_active_user
from app.services.totp_service import (
    disable_user_2fa,
    enable_user_2fa,
    get_user_2fa_status,
    totp_service,
    verify_user_2fa_token,
)

router = APIRouter()


class TOTPVerifyRequest(BaseModel):
    token: str


@router.get("/status")
def totp_status(
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    db: Session = Depends(get_db),
):
    return get_user_2fa_status(current_user.id, db)


@router.post("/enable")
def enable_totp(
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    db: Session = Depends(get_db),
):
    success, message, result = enable_user_2fa(current_user.id, db)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message if isinstance(message, str) else str(message),
        )
    return {"success": True, "message": message, "data": result}


@router.post("/verify")
def verify_totp(
    payload: TOTPVerifyRequest,
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    db: Session = Depends(get_db),
):
    ok, msg = verify_user_2fa_token(current_user.id, payload.token, db)
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
    return {"success": True, "message": msg}


@router.post("/disable")
def disable_totp(
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    db: Session = Depends(get_db),
):
    ok, msg = disable_user_2fa(current_user.id, db)
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
    return {"success": True, "message": msg}


@router.post("/regenerate-backup-codes")
def regenerate_backup_codes(
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    db: Session = Depends(get_db),
):
    ok, result = totp_service.regenerate_backup_codes(current_user.id, db)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result if isinstance(result, str) else str(result),
        )
    return {"success": True, "data": result}
