"""Configuración de logging estructurado para MotoStock."""

import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Any
from contextvars import ContextVar

import structlog
from pythonjsonlogger import jsonlogger

from app.config import settings

log_context: ContextVar[Dict[str, Any]] = ContextVar("log_context", default={})


def add_log_context(logger: Any, method_name: str, event_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Procesador para structlog que añade el contexto actual."""
    ctx = log_context.get()
    if ctx:
        event_dict.update(ctx)
    return event_dict


def setup_logging() -> None:
    """Configura logging estructurado con JSON para producción."""
    
    # Crear directorio de logs si no existe
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)
    
    # Configurar structlog
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            add_log_context,
            structlog.processors.JSONRenderer()
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )
    
    # Configurar logging estándar
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, settings.LOG_LEVEL.upper(), "INFO"))
    
    # Eliminar handlers existentes
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Handler para consola
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    
    # JSON formatter para consola
    console_formatter = jsonlogger.JsonFormatter(
        '%(asctime)s %(name)s %(levelname)s %(message)s'
    )
    console_handler.setFormatter(console_formatter)
    root_logger.addHandler(console_handler)
    
    # Handler para archivo (solo en producción)
    if settings.ENVIRONMENT == "production":
        file_handler = logging.FileHandler(
            f"logs/motostock-{datetime.now().strftime('%Y-%m-%d')}.log"
        )
        file_handler.setLevel(logging.DEBUG)
        file_formatter = jsonlogger.JsonFormatter(
            '%(asctime)s %(name)s %(levelname)s %(message)s'
        )
        file_handler.setFormatter(file_formatter)
        root_logger.addHandler(file_handler)


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """Obtiene un logger estructurado."""
    return structlog.get_logger(name)


class RequestLogger:
    """Middleware para logging de requests HTTP."""
    
    def __init__(self):
        self.logger = get_logger("http.requests")
    
    def log_request(self, method: str, path: str, status_code: int, 
                   response_time_ms: float, user_id: int = None, 
                   ip_address: str = None) -> None:
        """Log de request HTTP con métricas."""
        self.logger.info(
            "HTTP request completed",
            method=method,
            path=path,
            status_code=status_code,
            response_time_ms=response_time_ms,
            user_id=user_id,
            ip_address=ip_address
        )
    
    def log_error(self, method: str, path: str, error: str, 
                  user_id: int = None, ip_address: str = None) -> None:
        """Log de error en request HTTP."""
        self.logger.error(
            "HTTP request failed",
            method=method,
            path=path,
            error=error,
            user_id=user_id,
            ip_address=ip_address
        )


class DatabaseLogger:
    """Logger para operaciones de base de datos."""
    
    def __init__(self):
        self.logger = get_logger("database.operations")
    
    def log_query(self, query: str, duration_ms: float, rows_affected: int = 0) -> None:
        """Log de consulta a base de datos."""
        self.logger.info(
            "Database query executed",
            query=query[:100] + "..." if len(query) > 100 else query,
            duration_ms=duration_ms,
            rows_affected=rows_affected
        )
    
    def log_error(self, operation: str, error: str) -> None:
        """Log de error en base de datos."""
        self.logger.error(
            "Database operation failed",
            operation=operation,
            error=error
        )


class SecurityLogger:
    """Logger para eventos de seguridad."""
    
    def __init__(self):
        self.logger = get_logger("security.events")
    
    def log_login_attempt(self, username: str, success: bool, ip_address: str) -> None:
        """Log de intento de login."""
        self.logger.info(
            "Login attempt",
            username=username,
            success=success,
            ip_address=ip_address
        )
    
    def log_permission_denied(self, user_id: int, resource: str, action: str) -> None:
        """Log de acceso denegado."""
        self.logger.warning(
            "Permission denied",
            user_id=user_id,
            resource=resource,
            action=action
        )
    
    def log_suspicious_activity(self, description: str, ip_address: str, user_id: int = None) -> None:
        """Log de actividad sospechosa."""
        self.logger.warning(
            "Suspicious activity detected",
            description=description,
            ip_address=ip_address,
            user_id=user_id
        )


class AuditLogger:
    """Logger para auditoría de acciones de usuarios."""
    
    def __init__(self):
        self.logger = get_logger("audit.actions")
    
    def log_action(self, actor_id: int, target_id: Any, action: str, 
                   resource: str, branch_id: int, details: Dict[str, Any] = None) -> None:
        """Registra una acción de auditoría."""
        self.logger.info(
            "Audit action recorded",
            actor_id=actor_id,
            target_id=target_id,
            action=action,
            resource=resource,
            branch_id=branch_id,
            details=details or {}
        )


# Instancias globales para uso fácil
request_logger = RequestLogger()
db_logger = DatabaseLogger()
security_logger = SecurityLogger()
audit_logger = AuditLogger()
