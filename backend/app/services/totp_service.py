"""
Servicio de autenticación de dos factores (2FA) usando TOTP
Implementación de Time-based One-Time Passwords para seguridad adicional
"""

import json
import pyotp
import qrcode
import io
import base64
from typing import Optional, Tuple
from datetime import datetime, timedelta
import secrets

from app.models import User


def _backup_payload(user: User) -> dict:
    if not user.totp_backup_codes:
        return {"hashed": [], "used": []}
    try:
        data = json.loads(user.totp_backup_codes)
        if isinstance(data, dict):
            return {
                "hashed": list(data.get("hashed", [])),
                "used": list(data.get("used", [])),
            }
    except (json.JSONDecodeError, TypeError):
        pass
    if isinstance(user.totp_backup_codes, list):
        return {"hashed": user.totp_backup_codes, "used": []}
    return {"hashed": [], "used": []}


def _set_backup_payload(user: User, hashed: list, used: list) -> None:
    user.totp_backup_codes = json.dumps({"hashed": hashed, "used": used})


class TOTPService:
    """Servicio para gestión de TOTP (Time-based One-Time Passwords)"""
    
    def __init__(self):
        self.issuer = "MotoStock"
        self.digits = 6
        self.period = 30  # segundos
    
    def generate_secret(self) -> str:
        """Genera un nuevo secreto TOTP"""
        return pyotp.random_base32()
    
    def generate_qr_code(self, secret: str, username: str) -> str:
        """Genera un código QR para configuración 2FA"""
        totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
            name=username,
            issuer_name=self.issuer
        )
        
        # Generar QR code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(totp_uri)
        qr.make(fit=True)
        
        # Convertir a imagen base64
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        qr_code_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        return f"data:image/png;base64,{qr_code_base64}"
    
    def verify_totp(self, secret: str, token: str, valid_window: int = 1) -> bool:
        """Verifica un token TOTP"""
        try:
            totp = pyotp.TOTP(secret, digits=self.digits, interval=self.period)
            return totp.verify(token, valid_window=valid_window)
        except Exception:
            return False
    
    def get_current_token(self, secret: str) -> str:
        """Obtiene el token TOTP actual"""
        try:
            totp = pyotp.TOTP(secret, digits=self.digits, interval=self.period)
            return totp.now()
        except Exception:
            return ""
    
    def generate_backup_codes(self, count: int = 10) -> list[str]:
        """Genera códigos de backup de un solo uso"""
        backup_codes = []
        for _ in range(count):
            code = f"{secrets.randbelow(1000000):06d}"
            backup_codes.append(code)
        return backup_codes
    
    def hash_backup_codes(self, backup_codes: list[str]) -> list[str]:
        """Hashea los códigos de backup para almacenamiento seguro"""
        import hashlib
        return [hashlib.sha256(code.encode()).hexdigest() for code in backup_codes]
    
    def verify_backup_code(self, backup_code: str, hashed_codes: list[str]) -> bool:
        """Verifica un código de backup contra los hashes almacenados"""
        import hashlib
        code_hash = hashlib.sha256(backup_code.encode()).hexdigest()
        return code_hash in hashed_codes
    
    def is_backup_code_used(self, backup_code: str, hashed_codes: list[str], used_codes: list[str]) -> bool:
        """Verifica si un código de backup ya fue usado"""
        import hashlib
        code_hash = hashlib.sha256(backup_code.encode()).hexdigest()
        return code_hash in used_codes and code_hash in hashed_codes


class UserTOTPService:
    """Servicio para gestión 2FA de usuarios"""
    
    def __init__(self):
        self.totp_service = TOTPService()
    
    def enable_2fa(self, user_id: int, db) -> Tuple[bool, str]:
        """Habilita 2FA para un usuario"""
        try:
            # Obtener usuario
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                return False, "Usuario no encontrado"
            
            # Generar secreto TOTP
            secret = self.totp_service.generate_secret()
            
            # Generar códigos de backup
            backup_codes = self.totp_service.generate_backup_codes()
            hashed_backup_codes = self.totp_service.hash_backup_codes(backup_codes)
            
            # Guardar en base de datos
            user.totp_secret = secret
            _set_backup_payload(user, hashed_backup_codes, [])
            user.totp_enabled = True
            user.totp_enabled_at = datetime.utcnow()
            
            db.commit()
            
            # Generar QR code para configuración
            qr_code = self.totp_service.generate_qr_code(secret, user.username)
            
            return True, {
                "secret": secret,
                "qr_code": qr_code,
                "backup_codes": backup_codes,
                "instructions": self._get_2fa_instructions()
            }
            
        except Exception as e:
            db.rollback()
            return False, f"Error habilitando 2FA: {str(e)}"
    
    def disable_2fa(self, user_id: int, db) -> Tuple[bool, str]:
        """Deshabilita 2FA para un usuario"""
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                return False, "Usuario no encontrado"
            
            user.totp_enabled = False
            user.totp_secret = None
            user.totp_backup_codes = None
            user.totp_enabled_at = None
            
            db.commit()
            
            return True, "2FA deshabilitado exitosamente"
            
        except Exception as e:
            db.rollback()
            return False, f"Error deshabilitando 2FA: {str(e)}"
    
    def verify_2fa_token(self, user_id: int, token: str, db) -> Tuple[bool, str]:
        """Verifica un token 2FA"""
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                return False, "Usuario no encontrado"
            
            if not user.totp_enabled or not user.totp_secret:
                return False, "2FA no habilitado para este usuario"
            
            # Primero intentar verificar como TOTP
            if self.totp_service.verify_totp(user.totp_secret, token):
                return True, "Token 2FA válido"
            
            # Si falla TOTP, intentar con códigos de backup
            backup = _backup_payload(user)
            if backup["hashed"]:
                if self.totp_service.verify_backup_code(token, backup["hashed"]):
                    import hashlib

                    code_hash = hashlib.sha256(token.encode()).hexdigest()
                    if code_hash in backup["used"]:
                        return False, "Código de backup ya fue utilizado"
                    backup["used"].append(code_hash)
                    _set_backup_payload(user, backup["hashed"], backup["used"])
                    db.commit()
                    return True, "Código de backup válido"
            
            return False, "Token 2FA inválido"
            
        except Exception as e:
            return False, f"Error verificando token 2FA: {str(e)}"
    
    def get_2fa_status(self, user_id: int, db) -> dict:
        """Obtiene el estado 2FA de un usuario"""
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                return {"error": "Usuario no encontrado"}
            
            backup = _backup_payload(user)
            backup_codes_remaining = len(backup["hashed"]) - len(backup["used"])
            
            return {
                "enabled": user.totp_enabled or False,
                "enabled_at": user.totp_enabled_at.isoformat() if user.totp_enabled_at else None,
                "backup_codes_remaining": backup_codes_remaining,
                "can_setup_2fa": not user.totp_enabled
            }
            
        except Exception as e:
            return {"error": f"Error obteniendo estado 2FA: {str(e)}"}
    
    def regenerate_backup_codes(self, user_id: int, db) -> Tuple[bool, str]:
        """Regenera códigos de backup para un usuario"""
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                return False, "Usuario no encontrado"
            
            if not user.totp_enabled:
                return False, "2FA no habilitado para esta cuenta"
            
            # Generar nuevos códigos de backup
            backup_codes = self.totp_service.generate_backup_codes()
            hashed_backup_codes = self.totp_service.hash_backup_codes(backup_codes)
            
            # Actualizar en base de datos
            _set_backup_payload(user, hashed_backup_codes, [])
            
            db.commit()
            
            return True, {
                "backup_codes": backup_codes,
                "message": "Códigos de backup regenerados exitosamente"
            }
            
        except Exception as e:
            db.rollback()
            return False, f"Error regenerando códigos de backup: {str(e)}"
    
    def _get_2fa_instructions(self) -> str:
        """Obtiene instrucciones para configurar 2FA"""
        return """
        🔐 CONFIGURACIÓN DE AUTENTICACIÓN DE DOS FACTORES (2FA)
        
        1️⃣ ESCANEA EL CÓIGO QR:
        - Abre Google Authenticator, Authy, o Microsoft Authenticator
        - Escanea el código QR mostrado
        
        2️⃣ CONFIGURACIÓN MANUAL:
        - Si no puedes escanear, ingresa este código manualmente:
        - Abre tu app de autenticación
        - Selecciona "Agregar cuenta"
        - Ingresa el código proporcionado
        
        3️⃣ GUARDA CÓDIGOS DE BACKUP:
        - Guarda estos códigos en lugar seguro
        - Úsalos cuando no tengas acceso a tu app de autenticación
        - Cada código solo se puede usar una vez
        
        4️⃣ USO:
        - Después de login con usuario y contraseña
        - Ingresa el código de 6 dígitos que muestra tu app
        - El código cambia cada 30 segundos
        
        ⚠️ IMPORTANTE:
        - Guarda los códigos de backup en lugar seguro
        - No compartas tu código QR ni los códigos de backup
        - Si pierdes acceso a tu app, usa los códigos de backup
        """


# Instancia global del servicio
totp_service = UserTOTPService()


# Funciones helper para uso en otras partes del código
def enable_user_2fa(user_id: int, db) -> Tuple[bool, str, dict]:
    """Habilita 2FA para un usuario (wrapper)"""
    success, result = totp_service.enable_2fa(user_id, db)
    if success:
        return True, "2FA habilitado exitosamente", result
    return False, result, {}


def verify_user_2fa_token(user_id: int, token: str, db) -> Tuple[bool, str]:
    """Verifica token 2FA de usuario (wrapper)"""
    return totp_service.verify_2fa_token(user_id, token, db)


def get_user_2fa_status(user_id: int, db) -> dict:
    """Obtiene estado 2FA de usuario (wrapper)"""
    return totp_service.get_2fa_status(user_id, db)


def disable_user_2fa(user_id: int, db) -> Tuple[bool, str]:
    """Deshabilita 2FA de usuario (wrapper)"""
    return totp_service.disable_2fa(user_id, db)
