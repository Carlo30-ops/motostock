"""Manejadores de excepciones globales para consistencia de errores."""

from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from typing import Dict, Any, Optional
from datetime import datetime
import traceback

from app.logging_config import get_logger
from app.config import settings

logger = get_logger("error_handlers")

class MotoStockException(Exception):
    """Excepción base para errores de la aplicación."""
    
    def __init__(self, message: str, error_code: str = None, details: Dict[str, Any] = None):
        self.message = message
        self.error_code = error_code or "GENERAL_ERROR"
        self.details = details or {}
        super().__init__(self.message)

class ValidationException(MotoStockException):
    """Excepción para errores de validación de negocio."""
    
    def __init__(self, message: str, field: str = None, value: Any = None):
        details = {}
        if field:
            details["field"] = field
        if value is not None:
            details["value"] = value
        super().__init__(message, "VALIDATION_ERROR", details)

class ResourceNotFoundException(MotoStockException):
    """Excepción para recursos no encontrados."""
    
    def __init__(self, resource: str, identifier: Any):
        super().__init__(
            f"{resource} not found",
            "RESOURCE_NOT_FOUND",
            {"resource": resource, "identifier": identifier}
        )

class BusinessRuleException(MotoStockException):
    """Excepción para violación de reglas de negocio."""
    
    def __init__(self, message: str, rule: str = None):
        details = {}
        if rule:
            details["rule"] = rule
        super().__init__(message, "BUSINESS_RULE_VIOLATION", details)

class DatabaseException(MotoStockException):
    """Excepción para errores de base de datos."""
    
    def __init__(self, message: str, operation: str = None):
        details = {}
        if operation:
            details["operation"] = operation
        super().__init__(message, "DATABASE_ERROR", details)

class AuthenticationException(MotoStockException):
    """Excepción para errores de autenticación."""
    
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(message, "AUTHENTICATION_ERROR")

class AuthorizationException(MotoStockException):
    """Excepción para errores de autorización."""
    
    def __init__(self, message: str = "Access denied", resource: str = None, action: str = None):
        details = {}
        if resource:
            details["resource"] = resource
        if action:
            details["action"] = action
        super().__init__(message, "AUTHORIZATION_ERROR", details)

def create_error_response(
    status_code: int,
    error_code: str,
    message: str,
    details: Dict[str, Any] = None,
    request_id: str = None
) -> JSONResponse:
    """Crea una respuesta de error estandarizada."""
    
    error_response = {
        "error": {
            "code": error_code,
            "message": message,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "request_id": request_id
        }
    }
    
    if details:
        error_response["error"]["details"] = details
    
    return JSONResponse(
        status_code=status_code,
        content=error_response
    )

async def motostock_exception_handler(request: Request, exc: MotoStockException) -> JSONResponse:
    """Manejador para excepciones de la aplicación."""
    
    logger.error(
        "Application exception occurred",
        error_code=exc.error_code,
        message=exc.message,
        details=exc.details,
        path=request.url.path,
        method=request.method
    )
    
    # Mapear códigos de error a HTTP status codes
    status_map = {
        "VALIDATION_ERROR": status.HTTP_400_BAD_REQUEST,
        "RESOURCE_NOT_FOUND": status.HTTP_404_NOT_FOUND,
        "BUSINESS_RULE_VIOLATION": status.HTTP_422_UNPROCESSABLE_ENTITY,
        "DATABASE_ERROR": status.HTTP_500_INTERNAL_SERVER_ERROR,
        "AUTHENTICATION_ERROR": status.HTTP_401_UNAUTHORIZED,
        "AUTHORIZATION_ERROR": status.HTTP_403_FORBIDDEN,
        "GENERAL_ERROR": status.HTTP_500_INTERNAL_SERVER_ERROR,
    }
    
    status_code = status_map.get(exc.error_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    return create_error_response(
        status_code=status_code,
        error_code=exc.error_code,
        message=exc.message,
        details=exc.details,
        request_id=getattr(request.state, "request_id", None)
    )

async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Manejador para errores de validación de FastAPI."""
    
    logger.warning(
        "Validation error occurred",
        errors=exc.errors(),
        path=request.url.path,
        method=request.method
    )
    
    # Formatear errores de validación
    formatted_errors = []
    for error in exc.errors():
        formatted_errors.append({
            "field": ".".join(str(x) for x in error["loc"]),
            "message": error["msg"],
            "type": error["type"],
            "input": error.get("input")
        })
    
    return create_error_response(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        error_code="VALIDATION_ERROR",
        message="Validation failed",
        details={"errors": formatted_errors},
        request_id=getattr(request.state, "request_id", None)
    )

async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Manejador para excepciones HTTP de FastAPI."""
    
    logger.warning(
        "HTTP exception occurred",
        status_code=exc.status_code,
        detail=exc.detail,
        path=request.url.path,
        method=request.method
    )
    
    # Mapear status codes a códigos de error
    error_code_map = {
        400: "BAD_REQUEST",
        401: "AUTHENTICATION_ERROR",
        403: "AUTHORIZATION_ERROR",
        404: "RESOURCE_NOT_FOUND",
        405: "METHOD_NOT_ALLOWED",
        422: "VALIDATION_ERROR",
        429: "RATE_LIMIT_EXCEEDED",
        500: "INTERNAL_SERVER_ERROR",
    }
    
    error_code = error_code_map.get(exc.status_code, "HTTP_ERROR")
    
    return create_error_response(
        status_code=exc.status_code,
        error_code=error_code,
        message=exc.detail,
        request_id=getattr(request.state, "request_id", None)
    )

async def database_exception_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    """Manejador para errores de base de datos."""
    
    logger.error(
        "Database error occurred",
        error_type=type(exc).__name__,
        error_message=str(exc),
        path=request.url.path,
        method=request.method
    )
    
    # Manejar errores específicos de integridad
    if isinstance(exc, IntegrityError):
        if "unique" in str(exc).lower():
            message = "Resource already exists"
            error_code = "DUPLICATE_RESOURCE"
            status_code = status.HTTP_409_CONFLICT
        elif "foreign key" in str(exc).lower():
            message = "Referenced resource does not exist"
            error_code = "FOREIGN_KEY_VIOLATION"
            status_code = status.HTTP_400_BAD_REQUEST
        else:
            message = "Data integrity error"
            error_code = "INTEGRITY_ERROR"
            status_code = status.HTTP_400_BAD_REQUEST
    else:
        message = "Database operation failed"
        error_code = "DATABASE_ERROR"
        status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    
    return create_error_response(
        status_code=status_code,
        error_code=error_code,
        message=message,
        request_id=getattr(request.state, "request_id", None)
    )

async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Manejador para excepciones no capturadas."""
    
    logger.error(
        "Unhandled exception occurred",
        error_type=type(exc).__name__,
        error_message=str(exc),
        traceback=traceback.format_exc(),
        path=request.url.path,
        method=request.method
    )
    
    # En producción no exponer detalles del error
    if settings.ENVIRONMENT == "production":
        message = "Internal server error"
        details = None
    else:
        message = str(exc)
        details = {
            "error_type": type(exc).__name__,
            "traceback": traceback.format_exc()
        }
    
    return create_error_response(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        error_code="INTERNAL_SERVER_ERROR",
        message=message,
        details=details,
        request_id=getattr(request.state, "request_id", None)
    )

def setup_exception_handlers(app):
    """Registra todos los manejadores de excepciones en la aplicación FastAPI."""
    
    app.add_exception_handler(MotoStockException, motostock_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(SQLAlchemyError, database_exception_handler)
    app.add_exception_handler(Exception, general_exception_handler)
