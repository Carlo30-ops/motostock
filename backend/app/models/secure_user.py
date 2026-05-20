"""
Modelo de Usuario con encriptación de campos sensibles
Extiende el modelo base de usuario con encriptación automática
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.ext.hybrid import hybrid_property
from datetime import datetime
from typing import Optional

from app.database import Base
from app.services.encryption import encryption_service


class SecureUser(Base):
    """Modelo de usuario con campos sensibles encriptados"""
    __tablename__ = "users"

    # Campos básicos (no encriptados)
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default='cashier', nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Campos encriptados
    _pin_code_encrypted = Column(Text, nullable=True)  # PIN encriptado
    _recovery_email_encrypted = Column(Text, nullable=True)  # Email de recuperación encriptado
    _phone_number_encrypted = Column(Text, nullable=True)  # Teléfono encriptado
    _personal_notes_encrypted = Column(Text, nullable=True)  # Notas personales encriptadas
    _emergency_contact_encrypted = Column(Text, nullable=True)  # Contacto de emergencia encriptado

    # Marca para identificar campos encriptados
    _encrypted_fields_marker = Column(String(10), default="ENCRYPTED")

    @hybrid_property
    def pin_code(self) -> Optional[str]:
        """PIN del usuario (desencriptado)"""
        if self._pin_code_encrypted:
            try:
                return encryption_service.decrypt(self._pin_code_encrypted)
            except Exception:
                return None
        return None

    @pin_code.setter
    def pin_code(self, value: Optional[str]):
        """Establecer PIN (encriptado automáticamente)"""
        if value:
            self._pin_code_encrypted = encryption_service.encrypt(value)
        else:
            self._pin_code_encrypted = None

    @hybrid_property
    def recovery_email(self) -> Optional[str]:
        """Email de recuperación (desencriptado)"""
        if self._recovery_email_encrypted:
            try:
                return encryption_service.decrypt(self._recovery_email_encrypted)
            except Exception:
                return None
        return None

    @recovery_email.setter
    def recovery_email(self, value: Optional[str]):
        """Establecer email de recuperación (encriptado automáticamente)"""
        if value:
            self._recovery_email_encrypted = encryption_service.encrypt(value)
        else:
            self._recovery_email_encrypted = None

    @hybrid_property
    def phone_number(self) -> Optional[str]:
        """Número de teléfono (desencriptado)"""
        if self._phone_number_encrypted:
            try:
                return encryption_service.decrypt(self._phone_number_encrypted)
            except Exception:
                return None
        return None

    @phone_number.setter
    def phone_number(self, value: Optional[str]):
        """Establecer número de teléfono (encriptado automáticamente)"""
        if value:
            self._phone_number_encrypted = encryption_service.encrypt(value)
        else:
            self._phone_number_encrypted = None

    @hybrid_property
    def personal_notes(self) -> Optional[str]:
        """Notas personales (desencriptadas)"""
        if self._personal_notes_encrypted:
            try:
                return encryption_service.decrypt(self._personal_notes_encrypted)
            except Exception:
                return None
        return None

    @personal_notes.setter
    def personal_notes(self, value: Optional[str]):
        """Establecer notas personales (encriptadas automáticamente)"""
        if value:
            self._personal_notes_encrypted = encryption_service.encrypt(value)
        else:
            self._personal_notes_encrypted = None

    @hybrid_property
    def emergency_contact(self) -> Optional[str]:
        """Contacto de emergencia (desencriptado)"""
        if self._emergency_contact_encrypted:
            try:
                return encryption_service.decrypt(self._emergency_contact_encrypted)
            except Exception:
                return None
        return None

    @emergency_contact.setter
    def emergency_contact(self, value: Optional[str]):
        """Establecer contacto de emergencia (encriptado automáticamente)"""
        if value:
            self._emergency_contact_encrypted = encryption_service.encrypt(value)
        else:
            self._emergency_contact_encrypted = None

    # Métodos de utilidad para seguridad
    def verify_pin(self, pin: str) -> bool:
        """Verificar PIN del usuario"""
        return self.pin_code == pin

    def has_sensitive_data(self) -> bool:
        """Verificar si el usuario tiene datos sensibles almacenados"""
        return any([
            self._pin_code_encrypted,
            self._recovery_email_encrypted,
            self._phone_number_encrypted,
            self._personal_notes_encrypted,
            self._emergency_contact_encrypted
        ])

    def get_sensitive_fields_status(self) -> dict:
        """Obtener estado de los campos sensibles"""
        return {
            "has_pin": bool(self._pin_code_encrypted),
            "has_recovery_email": bool(self._recovery_email_encrypted),
            "has_phone": bool(self._phone_number_encrypted),
            "has_personal_notes": bool(self._personal_notes_encrypted),
            "has_emergency_contact": bool(self._emergency_contact_encrypted),
            "total_sensitive_fields": sum([
                bool(self._pin_code_encrypted),
                bool(self._recovery_email_encrypted),
                bool(self._phone_number_encrypted),
                bool(self._personal_notes_encrypted),
                bool(self._emergency_contact_encrypted)
            ])
        }

    def to_dict_safe(self) -> dict:
        """Convertir a diccionario sin datos sensibles"""
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": self.role,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "has_sensitive_data": self.has_sensitive_data(),
            "sensitive_fields_status": self.get_sensitive_fields_status()
        }

    def to_dict_with_sensitive(self, include_sensitive: bool = False) -> dict:
        """Convertir a diccionario con opción de incluir datos sensibles"""
        base_dict = self.to_dict_safe()
        
        if include_sensitive:
            base_dict.update({
                "pin_code": self.pin_code,
                "recovery_email": self.recovery_email,
                "phone_number": self.phone_number,
                "personal_notes": self.personal_notes,
                "emergency_contact": self.emergency_contact
            })
        
        return base_dict

    @classmethod
    def create_with_encryption(cls, **kwargs):
        """Crear usuario con encriptación automática de campos sensibles"""
        # Separar campos sensibles de campos normales
        sensitive_fields = ['pin_code', 'recovery_email', 'phone_number', 'personal_notes', 'emergency_contact']
        normal_fields = {}
        sensitive_data = {}

        for key, value in kwargs.items():
            if key in sensitive_fields:
                sensitive_data[key] = value
            else:
                normal_fields[key] = value

        # Crear instancia con campos normales
        user = cls(**normal_fields)

        # Establecer campos sensibles (se encriptarán automáticamente)
        for field, value in sensitive_data.items():
            setattr(user, field, value)

        return user

    def __repr__(self) -> str:
        """Representación segura sin datos sensibles"""
        return f"<SecureUser(id={self.id}, username={self.username}, role={self.role})>"
