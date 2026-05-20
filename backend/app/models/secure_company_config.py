"""
Modelo de configuración de empresa con encriptación de campos sensibles
Extiende el modelo base con encriptación automática de certificados y passwords
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.ext.hybrid import hybrid_property
from datetime import datetime
from typing import Optional, Dict, Any

from app.database import Base
from app.services.encryption import encryption_service


class SecureCompanyConfig(Base):
    """Modelo de configuración de empresa con campos sensibles encriptados"""
    __tablename__ = "company_config"

    # Campos básicos (no encriptados)
    id = Column(Integer, primary_key=True, index=True)
    nit = Column(String(30), nullable=False, unique=True)
    company_name = Column(String(200), nullable=False)
    address = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    email = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)
    department = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    
    # Configuración DIAN (campos básicos)
    dian_resolution = Column(String(100), nullable=True)
    resolution_number = Column(String(100), nullable=True)
    invoice_prefix = Column(String(20), default='FV', nullable=False)
    provider = Column(String(30), default='siigo', nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Campos encriptados
    _cert_path_encrypted = Column(Text, nullable=True)  # Ruta del certificado encriptada
    _cert_password_encrypted = Column(Text, nullable=True)  # Password del certificado encriptado
    _api_token_encrypted = Column(Text, nullable=True)  # Token de API encriptado
    _api_secret_encrypted = Column(Text, nullable=True)  # Secret de API encriptado
    _bank_account_encrypted = Column(Text, nullable=True)  # Cuenta bancaria encriptada
    _tax_id_encrypted = Column(Text, nullable=True)  # ID fiscal adicional encriptado
    _legal_representative_encrypted = Column(Text, nullable=True)  # Representante legal encriptado
    _economic_activity_encrypted = Column(Text, nullable=True)  # Actividad económica encriptada

    # Marca para identificar campos encriptados
    _encrypted_fields_marker = Column(String(10), default="ENCRYPTED")

    @hybrid_property
    def cert_path(self) -> Optional[str]:
        """Ruta del certificado (desencriptada)"""
        if self._cert_path_encrypted:
            try:
                return encryption_service.decrypt(self._cert_path_encrypted)
            except Exception:
                return None
        return None

    @cert_path.setter
    def cert_path(self, value: Optional[str]):
        """Establecer ruta del certificado (encriptada automáticamente)"""
        if value:
            self._cert_path_encrypted = encryption_service.encrypt(value)
        else:
            self._cert_path_encrypted = None

    @hybrid_property
    def cert_password(self) -> Optional[str]:
        """Password del certificado (desencriptado)"""
        if self._cert_password_encrypted:
            try:
                return encryption_service.decrypt(self._cert_password_encrypted)
            except Exception:
                return None
        return None

    @cert_password.setter
    def cert_password(self, value: Optional[str]):
        """Establecer password del certificado (encriptado automáticamente)"""
        if value:
            self._cert_password_encrypted = encryption_service.encrypt(value)
        else:
            self._cert_password_encrypted = None

    @hybrid_property
    def api_token(self) -> Optional[str]:
        """Token de API (desencriptado)"""
        if self._api_token_encrypted:
            try:
                return encryption_service.decrypt(self._api_token_encrypted)
            except Exception:
                return None
        return None

    @api_token.setter
    def api_token(self, value: Optional[str]):
        """Establecer token de API (encriptado automáticamente)"""
        if value:
            self._api_token_encrypted = encryption_service.encrypt(value)
        else:
            self._api_token_encrypted = None

    @hybrid_property
    def api_secret(self) -> Optional[str]:
        """Secret de API (desencriptado)"""
        if self._api_secret_encrypted:
            try:
                return encryption_service.decrypt(self._api_secret_encrypted)
            except Exception:
                return None
        return None

    @api_secret.setter
    def api_secret(self, value: Optional[str]):
        """Establecer secret de API (encriptado automáticamente)"""
        if value:
            self._api_secret_encrypted = encryption_service.encrypt(value)
        else:
            self._api_secret_encrypted = None

    @hybrid_property
    def bank_account(self) -> Optional[str]:
        """Cuenta bancaria (desencriptada)"""
        if self._bank_account_encrypted:
            try:
                return encryption_service.decrypt(self._bank_account_encrypted)
            except Exception:
                return None
        return None

    @bank_account.setter
    def bank_account(self, value: Optional[str]):
        """Establecer cuenta bancaria (encriptada automáticamente)"""
        if value:
            self._bank_account_encrypted = encryption_service.encrypt(value)
        else:
            self._bank_account_encrypted = None

    @hybrid_property
    def tax_id(self) -> Optional[str]:
        """ID fiscal adicional (desencriptado)"""
        if self._tax_id_encrypted:
            try:
                return encryption_service.decrypt(self._tax_id_encrypted)
            except Exception:
                return None
        return None

    @tax_id.setter
    def tax_id(self, value: Optional[str]):
        """Establecer ID fiscal (encriptado automáticamente)"""
        if value:
            self._tax_id_encrypted = encryption_service.encrypt(value)
        else:
            self._tax_id_encrypted = None

    @hybrid_property
    def legal_representative(self) -> Optional[str]:
        """Representante legal (desencriptado)"""
        if self._legal_representative_encrypted:
            try:
                return encryption_service.decrypt(self._legal_representative_encrypted)
            except Exception:
                return None
        return None

    @legal_representative.setter
    def legal_representative(self, value: Optional[str]):
        """Establecer representante legal (encriptado automáticamente)"""
        if value:
            self._legal_representative_encrypted = encryption_service.encrypt(value)
        else:
            self._legal_representative_encrypted = None

    @hybrid_property
    def economic_activity(self) -> Optional[str]:
        """Actividad económica (desencriptada)"""
        if self._economic_activity_encrypted:
            try:
                return encryption_service.decrypt(self._economic_activity_encrypted)
            except Exception:
                return None
        return None

    @economic_activity.setter
    def economic_activity(self, value: Optional[str]):
        """Establecer actividad económica (encriptada automáticamente)"""
        if value:
            self._economic_activity_encrypted = encryption_service.encrypt(value)
        else:
            self._economic_activity_encrypted = None

    # Métodos de utilidad para seguridad
    def has_certificates(self) -> bool:
        """Verificar si hay certificados configurados"""
        return bool(self.cert_path and self.cert_password)

    def has_api_credentials(self) -> bool:
        """Verificar si hay credenciales de API configuradas"""
        return bool(self.api_token or self.api_secret)

    def has_bank_info(self) -> bool:
        """Verificar si hay información bancaria configurada"""
        return bool(self.bank_account)

    def get_encryption_status(self) -> Dict[str, bool]:
        """Obtener estado de encriptación de todos los campos"""
        return {
            "has_certificates": self.has_certificates(),
            "has_api_credentials": self.has_api_credentials(),
            "has_bank_info": self.has_bank_info(),
            "has_tax_id": bool(self._tax_id_encrypted),
            "has_legal_representative": bool(self._legal_representative_encrypted),
            "has_economic_activity": bool(self._economic_activity_encrypted),
            "total_encrypted_fields": sum([
                bool(self._cert_path_encrypted),
                bool(self._cert_password_encrypted),
                bool(self._api_token_encrypted),
                bool(self._api_secret_encrypted),
                bool(self._bank_account_encrypted),
                bool(self._tax_id_encrypted),
                bool(self._legal_representative_encrypted),
                bool(self._economic_activity_encrypted)
            ])
        }

    def to_dict_safe(self) -> Dict[str, Any]:
        """Convertir a diccionario sin datos sensibles"""
        return {
            "id": self.id,
            "nit": self.nit,
            "company_name": self.company_name,
            "address": self.address,
            "phone": self.phone,
            "email": self.email,
            "city": self.city,
            "department": self.department,
            "country": self.country,
            "dian_resolution": self.dian_resolution,
            "resolution_number": self.resolution_number,
            "invoice_prefix": self.invoice_prefix,
            "provider": self.provider,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "encryption_status": self.get_encryption_status()
        }

    def to_dict_with_sensitive(self, include_sensitive: bool = False) -> Dict[str, Any]:
        """Convertir a diccionario con opción de incluir datos sensibles"""
        base_dict = self.to_dict_safe()
        
        if include_sensitive:
            base_dict.update({
                "cert_path": self.cert_path,
                "cert_password": self.cert_password,
                "api_token": self.api_token,
                "api_secret": self.api_secret,
                "bank_account": self.bank_account,
                "tax_id": self.tax_id,
                "legal_representative": self.legal_representative,
                "economic_activity": self.economic_activity
            })
        
        return base_dict

    def validate_dian_config(self) -> Dict[str, Any]:
        """Validar configuración DIAN"""
        errors = []
        warnings = []

        # Validaciones básicas
        if not self.nit:
            errors.append("NIT es requerido")
        if not self.company_name:
            errors.append("Nombre de empresa es requerido")
        if not self.dian_resolution:
            errors.append("Resolución DIAN es requerida")
        if not self.resolution_number:
            errors.append("Número de resolución es requerido")

        # Validaciones de formato
        if self.nit and not self._validate_nit_format(self.nit):
            errors.append("Formato de NIT inválido")
        
        if self.email and not self._validate_email_format(self.email):
            warnings.append("Formato de email puede ser inválido")

        # Validaciones para facturación electrónica
        if self.provider == 'siigo':
            if not self.has_api_credentials():
                errors.append("Credenciales de API requeridas para Siigo")
            if not self.has_certificates():
                warnings.append("Certificados recomendados para Siigo")

        return {
            "is_valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "completeness": self._calculate_completeness()
        }

    def _validate_nit_format(self, nit: str) -> bool:
        """Validar formato de NIT colombiano"""
        import re
        # Formato: 900123456-7 o 900123456
        pattern = r'^\d{9,12}-?\d?$'
        return bool(re.match(pattern, nit.replace(' ', '')))

    def _validate_email_format(self, email: str) -> bool:
        """Validar formato de email"""
        import re
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(pattern, email))

    def _calculate_completeness(self) -> float:
        """Calcular porcentaje de completitud de la configuración"""
        total_fields = 15  # Total de campos importantes
        completed_fields = 0

        # Campos básicos
        if self.nit: completed_fields += 1
        if self.company_name: completed_fields += 1
        if self.address: completed_fields += 1
        if self.phone: completed_fields += 1
        if self.email: completed_fields += 1
        if self.city: completed_fields += 1
        if self.department: completed_fields += 1
        if self.country: completed_fields += 1

        # Configuración DIAN
        if self.dian_resolution: completed_fields += 1
        if self.resolution_number: completed_fields += 1
        if self.invoice_prefix: completed_fields += 1
        if self.provider: completed_fields += 1

        # Campos sensibles importantes
        if self.has_api_credentials(): completed_fields += 1
        if self.has_certificates(): completed_fields += 1
        if self.legal_representative: completed_fields += 1

        return (completed_fields / total_fields) * 100

    @classmethod
    def create_with_encryption(cls, **kwargs):
        """Crear configuración con encriptación automática de campos sensibles"""
        # Separar campos sensibles de campos normales
        sensitive_fields = [
            'cert_path', 'cert_password', 'api_token', 'api_secret',
            'bank_account', 'tax_id', 'legal_representative', 'economic_activity'
        ]
        normal_fields = {}
        sensitive_data = {}

        for key, value in kwargs.items():
            if key in sensitive_fields:
                sensitive_data[key] = value
            else:
                normal_fields[key] = value

        # Crear instancia con campos normales
        config = cls(**normal_fields)

        # Establecer campos sensibles (se encriptarán automáticamente)
        for field, value in sensitive_data.items():
            setattr(config, field, value)

        return config

    def __repr__(self) -> str:
        """Representación segura sin datos sensibles"""
        return f"<SecureCompanyConfig(id={self.id}, nit={self.nit}, company={self.company_name})>"
