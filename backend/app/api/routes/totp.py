"""
API Routes para autenticación de dos factores (2FA)
Endpoints para gestión de TOTP y configuración de seguridad adicional
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from datetime import datetime

from app.database import get_db
from app.services.totp_service import (
    enable_user_2fa, 
    verify_user_2fa_token, 
    get_user_2fa_status,
    disable_user_2fa
)
from app.models.user_2fa import AuditLog, User2FA
from app.auth import get_current_user
from pydantic import BaseModel, EmailStr

router = APIRouter(prefix="/api/2fa", tags=["2FA"])


class TOTPEnableRequest(BaseModel):
    """Request para habilitar 2FA"""
    password: str
    
class TOTPVerifyRequest(BaseModel):
    """Request para verificar token 2FA"""
    token: str
    remember_device: bool = False
    
class TOTPBackupCodeRequest(BaseModel):
    """Request para usar código de backup"""
    backup_code: str
    
class TOTPRecoveryRequest(BaseModel):
    """Request para recuperación 2FA"""
    email: EmailStr


@router.post("/enable")
async def enable_totp(
    request: TOTPEnableRequest,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Habilita autenticación de dos factores para el usuario actual
    """
    try:
        success, message, result = enable_user_2fa(current_user.id, db)
        
        if success:
            # Log de auditoría
            audit_log = AuditLog.log_2fa_event(
                user_id=current_user.id,
                event_type="2FA_ENABLED",
                success=True,
                ip_address=request.client.host,
                user_agent=request.headers.get("user-agent"),
                event_data={"method": "totp_setup"}
            )
            db.add(audit_log)
            db.commit()
            
            return {
                "success": True,
                "message": message,
                "data": {
                    "qr_code": result["qr_code"],
                    "backup_codes": result["backup_codes"],
                    "instructions": result["instructions"]
                }
            }
        else:
            # Log de error
            audit_log = AuditLog.log_2fa_event(
                user_id=current_user.id,
                event_type="2FA_ENABLE_FAILED",
                success=False,
                ip_address=request.client.host,
                user_agent=request.headers.get("user-agent"),
                event_data={"error": message}
            )
            db.add(audit_log)
            db.commit()
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=message
            )
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error habilitando 2FA: {str(e)}"
        )


@router.post("/verify")
async def verify_totp(
    request: TOTPVerifyRequest,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Verifica un token TOTP para completar autenticación 2FA
    """
    try:
        success, message = verify_user_2fa_token(current_user.id, request.token, db)
        
        if success:
            # Log de auditoría
            audit_log = AuditLog.log_2fa_event(
                user_id=current_user.id,
                event_type="2FA_VERIFIED",
                success=True,
                ip_address=request.client.host,
                user_agent=request.headers.get("user-agent"),
                event_data={
                    "method": "totp",
                    "remember_device": request.remember_device
                }
            )
            db.add(audit_log)
            db.commit()
            
            return {
                "success": True,
                "message": "Token 2FA verificado exitosamente"
            }
        else:
            # Log de error
            audit_log = AuditLog.log_2fa_event(
                user_id=current_user.id,
                event_type="2FA_VERIFICATION_FAILED",
                success=False,
                ip_address=request.client.host,
                user_agent=request.headers.get("user-agent"),
                event_data={"error": message}
            )
            db.add(audit_log)
            db.commit()
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=message
            )
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error verificando token 2FA: {str(e)}"
        )


@router.post("/backup-code")
async def verify_backup_code(
    request: TOTPBackupCodeRequest,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Verifica un código de backup para autenticación 2FA
    """
    try:
        # Implementar verificación de código de backup
        user = db.query(User2FA).filter(User2FA.id == current_user.id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario no encontrado"
            )
        
        # Verificar código de backup
        if user.verify_backup_code(request.backup_code):
            # Marcar código como usado
            if not user.used_backup_codes:
                user.used_backup_codes = []
            
            import hashlib
            code_hash = hashlib.sha256(request.backup_code.encode()).hexdigest()
            user.used_backup_codes.append(code_hash)
            
            # Resetear intentos fallidos
            user.reset_2fa_failed_attempts()
            
            db.commit()
            
            # Log de auditoría
            audit_log = AuditLog.log_2fa_event(
                user_id=current_user.id,
                event_type="2FA_BACKUP_USED",
                success=True,
                ip_address=request.client.host,
                user_agent=request.headers.get("user-agent"),
                event_data={"method": "backup_code"}
            )
            db.add(audit_log)
            db.commit()
            
            return {
                "success": True,
                "message": "Código de backup verificado exitosamente"
            }
        else:
            # Incrementar intentos fallidos
            user.increment_2fa_failed_attempts()
            db.commit()
            
            # Log de error
            audit_log = AuditLog.log_2fa_event(
                user_id=current_user.id,
                event_type="2FA_BACKUP_FAILED",
                success=False,
                ip_address=request.client.host,
                user_agent=request.headers.get("user-agent"),
                event_data={"error": "Código de backup inválido"}
            )
            db.add(audit_log)
            db.commit()
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Código de backup inválido"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error verificando código de backup: {str(e)}"
        )


@router.get("/status")
async def get_totp_status(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Obtiene el estado actual de 2FA del usuario
    """
    try:
        status = get_user_2fa_status(current_user.id, db)
        
        if "error" in status:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=status["error"]
            )
        
        return {
            "success": True,
            "data": status
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error obteniendo estado 2FA: {str(e)}"
        )


@router.post("/disable")
async def disable_totp(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Deshabilita autenticación de dos factores para el usuario actual
    """
    try:
        success, message = disable_user_2fa(current_user.id, db)
        
        if success:
            # Log de auditoría
            audit_log = AuditLog.log_2fa_event(
                user_id=current_user.id,
                event_type="2FA_DISABLED",
                success=True,
                ip_address=request.client.host,
                user_agent=request.headers.get("user-agent")
            )
            db.add(audit_log)
            db.commit()
            
            return {
                "success": True,
                "message": message
            }
        else:
            # Log de error
            audit_log = AuditLog.log_2fa_event(
                user_id=current_user.id,
                event_type="2FA_DISABLE_FAILED",
                success=False,
                ip_address=request.client.host,
                user_agent=request.headers.get("user-agent"),
                event_data={"error": message}
            )
            db.add(audit_log)
            db.commit()
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=message
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deshabilitando 2FA: {str(e)}"
        )


@router.post("/regenerate-backup-codes")
async def regenerate_backup_codes(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Regenera códigos de backup para el usuario actual
    """
    try:
        from app.services.totp_service import totp_service
        
        success, result = totp_service.regenerate_backup_codes(current_user.id, db)
        
        if success:
            # Log de auditoría
            audit_log = AuditLog.log_2fa_event(
                user_id=current_user.id,
                event_type="2FA_BACKUP_CODES_REGENERATED",
                success=True,
                ip_address=request.client.host,
                user_agent=request.headers.get("user-agent"),
                event_data={"backup_codes_count": len(result["backup_codes"])}
            )
            db.add(audit_log)
            db.commit()
            
            return {
                "success": True,
                "message": result["message"],
                "data": {
                    "backup_codes": result["backup_codes"]
                }
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error regenerando códigos de backup: {str(e)}"
        )


@router.post("/recovery")
async def request_recovery_code(
    payload: TOTPRecoveryRequest,
    http_request: Request,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Solicita un código de recuperación para 2FA
    """
    try:
        # Buscar usuario por email
        user = db.query(User2FA).filter(User2FA.email == payload.email).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No existe una cuenta con este email"
            )
        
        if not user.is_2fa_enabled():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="2FA no está habilitado para esta cuenta"
            )
        
        # Generar código de recuperación
        recovery_code = user.generate_recovery_code()
        db.commit()
        
        # Envío por email pendiente (SMTP en settings); no exponer el código en la API.
        # send_recovery_email(user.email, recovery_code)
        
        # Log de auditoría
        audit_log = AuditLog.log_2fa_event(
            user_id=user.id,
            event_type="2FA_RECOVERY_REQUESTED",
            success=True,
            ip_address=http_request.client.host if http_request.client else None,
            user_agent=http_request.headers.get("user-agent"),
            event_data={"email": payload.email},
        )
        db.add(audit_log)
        db.commit()

        return {
            "success": True,
            "message": "Solicitud registrada. El envío por email no está configurado: contacta al administrador o usa otro canal de recuperación si existe.",
            "email_delivery": "disabled",
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error solicitando recuperación: {str(e)}",
        )


@router.get("/audit-logs")
async def get_2fa_audit_logs(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 50,
    offset: int = 0
) -> Dict[str, Any]:
    """
    Obtiene logs de auditoría 2FA del usuario actual
    """
    try:
        logs = db.query(AuditLog).filter(
            AuditLog.user_id == current_user.id,
            AuditLog.event_type.like("2FA_%")
        ).order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()
        
        return {
            "success": True,
            "data": [log.to_dict_safe() for log in logs],
            "pagination": {
                "limit": limit,
                "offset": offset,
                "total": len(logs)
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error obteniendo logs de auditoría: {str(e)}"
        )


@router.get("/qr-code")
async def get_qr_code(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Genera un nuevo código QR para configuración 2FA
    """
    try:
        from app.services.totp_service import totp_service
        
        # Verificar que 2FA ya esté habilitado
        status = get_user_2fa_status(current_user.id, db)
        if not status.get("enabled"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="2FA no está habilitado"
            )
        
        # Generar nuevo QR code
        user = db.query(User2FA).filter(User2FA.id == current_user.id).first()
        
        if user and user.totp_secret:
            qr_code = totp_service.generate_qr_code(user.totp_secret, user.username)
            
            return {
                "success": True,
                "data": {
                    "qr_code": qr_code,
                    "instructions": totp_service._get_2fa_instructions()
                }
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se encontró configuración 2FA"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generando código QR: {str(e)}"
        )
