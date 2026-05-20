"""
Modelo de usuario con soporte 2FA (Two-Factor Authentication)
Extiende el modelo base de usuario con campos para autenticación de dos factores
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ARRAY
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database import Base


class User2FA(Base):
    """Modelo extendido de usuario con funcionalidad 2FA"""
    __tablename__ = "users_2fa"

    # Campos básicos heredados
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default='cashier', nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Campos 2FA
    totp_enabled = Column(Boolean, default=False, nullable=False)
    totp_secret = Column(String(255), nullable=True)  # Secreto TOTP encriptado
    totp_enabled_at = Column(DateTime, nullable=True)  # Cuándo se habilitó 2FA
    totp_last_used = Column(DateTime, nullable=True)  # Último uso exitoso
    totp_backup_codes = Column(ARRAY(String), nullable=True)  # Códigos de backup hasheados
    used_backup_codes = Column(ARRAY(String), nullable=True)  # Códigos de backup usados
    totp_failed_attempts = Column(Integer, default=0, nullable=False)  # Intentos fallidos
    totp_locked_until = Column(DateTime, nullable=True)  # Bloqueo temporal
    totp_device_trusted = Column(ARRAY(String), nullable=True)  # Dispositivos confiables
    totp_recovery_code = Column(String(32), nullable=True)  # Código de recuperación
    totp_recovery_expires = Column(DateTime, nullable=True)  # Expiración código recuperación

    # Relaciones
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user", cascade="all, delete-orphan")

    def is_2fa_enabled(self) -> bool:
        """Verifica si 2FA está habilitado"""
        return self.totp_enabled and bool(self.totp_secret)
    
    def is_2fa_locked(self) -> bool:
        """Verifica si el acceso 2FA está bloqueado"""
        if not self.totp_locked_until:
            return False
        return datetime.utcnow() < self.totp_locked_until
    
    def can_use_backup_code(self) -> bool:
        """Verifica si se pueden usar códigos de backup"""
        if not self.totp_backup_codes or not self.used_backup_codes:
            return True
        return len(self.totp_backup_codes) > len(self.used_backup_codes)
    
    def get_backup_codes_remaining(self) -> int:
        """Obtiene cantidad de códigos de backup disponibles"""
        if not self.totp_backup_codes:
            return 0
        if not self.used_backup_codes:
            return len(self.totp_backup_codes)
        return len(self.totp_backup_codes) - len(self.used_backup_codes)
    
    def is_device_trusted(self, device_fingerprint: str) -> bool:
        """Verifica si un dispositivo es confiable"""
        if not self.totp_device_trusted:
            return False
        return device_fingerprint in self.totp_device_trusted
    
    def add_trusted_device(self, device_fingerprint: str):
        """Agrega un dispositivo a la lista de confiables"""
        if not self.totp_device_trusted:
            self.totp_device_trusted = []
        
        if device_fingerprint not in self.totp_device_trusted:
            self.totp_device_trusted.append(device_fingerprint)
    
    def remove_trusted_device(self, device_fingerprint: str):
        """Remueve un dispositivo de la lista de confiables"""
        if self.totp_device_trusted and device_fingerprint in self.totp_device_trusted:
            self.totp_device_trusted.remove(device_fingerprint)
    
    def increment_2fa_failed_attempts(self):
        """Incrementa intentos fallidos 2FA"""
        self.totp_failed_attempts += 1
        
        # Bloquear después de 5 intentos fallidos
        if self.totp_failed_attempts >= 5:
            self.totp_locked_until = datetime.utcnow() + timedelta(minutes=15)
    
    def reset_2fa_failed_attempts(self):
        """Resetea intentos fallidos 2FA"""
        self.totp_failed_attempts = 0
        self.totp_locked_until = None
    
    def is_recovery_code_valid(self, recovery_code: str) -> bool:
        """Verifica si el código de recuperación es válido"""
        if not self.totp_recovery_code or not self.totp_recovery_expires:
            return False
        return (
            self.totp_recovery_code == recovery_code and
            datetime.utcnow() < self.totp_recovery_expires
        )
    
    def generate_recovery_code(self) -> str:
        """Genera un nuevo código de recuperación"""
        import secrets
        self.totp_recovery_code = secrets.token_urlsafe(16)
        self.totp_recovery_expires = datetime.utcnow() + timedelta(hours=24)
        return self.totp_recovery_code
    
    def get_2fa_status(self) -> dict:
        """Obtiene estado completo de 2FA"""
        return {
            "enabled": self.is_2fa_enabled(),
            "enabled_at": self.totp_enabled_at.isoformat() if self.totp_enabled_at else None,
            "last_used": self.totp_last_used.isoformat() if self.totp_last_used else None,
            "failed_attempts": self.totp_failed_attempts,
            "locked_until": self.totp_locked_until.isoformat() if self.totp_locked_until else None,
            "is_locked": self.is_2fa_locked(),
            "backup_codes_remaining": self.get_backup_codes_remaining(),
            "trusted_devices": self.totp_device_trusted or [],
            "has_recovery_code": bool(self.totp_recovery_code),
            "recovery_expires": self.totp_recovery_expires.isoformat() if self.totp_recovery_expires else None
        }
    
    def to_dict_safe(self) -> dict:
        """Convierte a diccionario sin datos sensibles"""
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": self.role,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "2fa_status": self.get_2fa_status()
        }
    
    def to_dict_with_2fa(self, include_sensitive: bool = False) -> dict:
        """Convierte a diccionario con opción de incluir datos 2FA"""
        base_dict = self.to_dict_safe()
        
        if include_sensitive:
            base_dict.update({
                "totp_enabled": self.totp_enabled,
                "totp_enabled_at": self.totp_enabled_at.isoformat() if self.totp_enabled_at else None,
                "totp_last_used": self.totp_last_used.isoformat() if self.totp_last_used else None,
                "totp_failed_attempts": self.totp_failed_attempts,
                "totp_locked_until": self.totp_locked_until.isoformat() if self.totp_locked_until else None,
                "backup_codes_remaining": self.get_backup_codes_remaining(),
                "trusted_devices": self.totp_device_trusted or []
            })
        
        return base_dict
    
    def __repr__(self) -> str:
        """Representación segura sin datos sensibles"""
        return f"<User2FA(id={self.id}, username={self.username}, 2fa={self.is_2fa_enabled()})>"


class UserSession(Base):
    """Modelo para sesiones de usuario con soporte 2FA"""
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    session_token = Column(String(255), unique=True, nullable=False, index=True)
    device_fingerprint = Column(String(255), nullable=True, index=True)
    device_info = Column(Text, nullable=True)  # User agent, IP, etc.
    is_2fa_verified = Column(Boolean, default=False, nullable=False)
    is_trusted_device = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    last_activity = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relaciones
    user = relationship("User2FA", back_populates="sessions")

    def is_expired(self) -> bool:
        """Verifica si la sesión ha expirado"""
        return datetime.utcnow() > self.expires_at
    
    def is_valid(self) -> bool:
        """Verifica si la sesión es válida"""
        return (
            self.is_active and
            not self.is_expired() and
            (self.is_2fa_verified or self.is_trusted_device)
        )
    
    def extend_session(self, minutes: int = 30):
        """Extiende la sesión"""
        self.expires_at = datetime.utcnow() + timedelta(minutes=minutes)
        self.last_activity = datetime.utcnow()
    
    def invalidate(self):
        """Invalida la sesión"""
        self.is_active = False
    
    def to_dict_safe(self) -> dict:
        """Convierte a diccionario sin datos sensibles"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "device_fingerprint": self.device_fingerprint,
            "is_2fa_verified": self.is_2fa_verified,
            "is_trusted_device": self.is_trusted_device,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "last_activity": self.last_activity.isoformat() if self.last_activity else None,
            "is_active": self.is_active,
            "is_valid": self.is_valid()
        }
    
    def __repr__(self) -> str:
        """Representación segura"""
        return f"<UserSession(id={self.id}, user_id={self.user_id}, valid={self.is_valid()})>"


class AuditLog(Base):
    """Modelo para logs de auditoría con eventos 2FA"""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    event_type = Column(String(50), nullable=False, index=True)
    event_data = Column(Text, nullable=True)  # Datos del evento en JSON
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    device_fingerprint = Column(String(255), nullable=True)
    success = Column(Boolean, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relaciones
    user = relationship("User2FA", back_populates="audit_logs")

    @classmethod
    def log_2fa_event(cls, user_id: int, event_type: str, success: bool, 
                      ip_address: str = None, user_agent: str = None, 
                      device_fingerprint: str = None, event_data: dict = None):
        """Crea un log de auditoría para evento 2FA"""
        import json
        return cls(
            user_id=user_id,
            event_type=event_type,
            event_data=json.dumps(event_data) if event_data else None,
            ip_address=ip_address,
            user_agent=user_agent,
            device_fingerprint=device_fingerprint,
            success=success
        )
    
    def to_dict_safe(self) -> dict:
        """Convierte a diccionario sin datos sensibles"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "event_type": self.event_type,
            "success": self.success,
            "ip_address": self.ip_address,
            "device_fingerprint": self.device_fingerprint,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
    
    def __repr__(self) -> str:
        """Representación segura"""
        return f"<AuditLog(id={self.id}, user_id={self.user_id}, event={self.event_type})>"
