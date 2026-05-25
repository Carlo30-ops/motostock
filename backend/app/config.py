from pydantic import ValidationError, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = "postgresql://motostock:motostock_pass@localhost:5432/motostock"
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    # String separado por comas (compatible con docker-compose: CORS_ORIGINS=http://a,http://b)
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("SECRET_KEY no puede estar vacia")
        return value

    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM_NUMBER: str = ""
    TWILIO_WHATSAPP_FROM: str = ""

    BACKUP_INTERVAL_HOURS: int = 12
    BACKUP_RETENTION_DAYS: int = 30
    BACKUP_EMAIL: str = "dueno@correo.com"
    REPORT_EMAIL: str = "dueno@correo.com"
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SENTRY_DSN: str = ""

    DIAN_ENV: str = "habilitacion"
    DIAN_PROVIDER: str = "siigo"
    DIAN_CERT_PATH: str = "./certs/cert.p12"
    
    # Redis configuration
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = ""
    REDIS_DB: int = 0
    DIAN_CERT_PASSWORD: str = ""
    DIAN_NIT: str = ""
    DIAN_RESOLUTION: str = ""
    DIAN_INVOICE_PREFIX: str = "FV"
    SIIGO_API_BASE_URL: str = "https://api.siigo.com"
    SIIGO_API_TOKEN: str = ""

    # Logging configuration
    LOG_LEVEL: str = "INFO"
    ENVIRONMENT: str = "development"


try:
    settings = Settings()
except ValidationError as exc:
    if any(error.get("loc") == ("SECRET_KEY",) for error in exc.errors()):
        raise RuntimeError(
            "Falta configurar SECRET_KEY en las variables de entorno. "
            "Genera un valor seguro con: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
        ) from exc
    raise
