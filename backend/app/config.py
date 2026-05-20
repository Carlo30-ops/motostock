import secrets
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = "postgresql://motostock:motostock_pass@localhost:5432/motostock"
    SECRET_KEY: str = secrets.token_urlsafe(32)  # Genera clave segura por defecto
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

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


settings = Settings()
