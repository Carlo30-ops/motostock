"""JWT authentication utilities."""

from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User
from app.core.rbac import Permission, has_permission

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

ROLE_HIERARCHY: dict[str, int] = {
    "cashier": 10,
    "mechanic": 15,
    "accountant": 25,
    "supervisor": 30,
    "admin": 40,
    "superadmin": 50,
}


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except (ValueError, TypeError):
        return False


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    from app.services.tenant import bypass_tenant_context
    with bypass_tenant_context("Authenticate user by username", "system"):
        user = db.query(User).filter(User.username == username).first()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def authenticate_user_by_pin(db: Session, pin: str) -> Optional[User]:
    from app.services.tenant import bypass_tenant_context
    with bypass_tenant_context("Authenticate user by PIN", "system"):
        user = db.query(User).filter(User.pin_code == pin).first()
    if not user or not user.is_active:
        return None
    return user


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    # Incluimos rol, branch_id y organization_id para aislamiento rápido
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    from app.services.tenant import bypass_tenant_context, set_current_tenant_id
    with bypass_tenant_context("Resolve user during JWT authentication", "system"):
        user = db.query(User).filter(User.username == username).first()
    
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    
    # Automated Multi-tenant Context Injection
    # This token remains active for the duration of the request/thread
    set_current_tenant_id(user.organization_id)
    
    return user

def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    return current_user

def require_permission(permission: Permission):
    """
    Dependencia para exigir un permiso específico.
    Uso: Annotated[User, Depends(require_permission(Permission.SALES_CREATE))]
    """
    def _permission_dependency(current_user: User = Depends(get_current_active_user)) -> User:
        if not has_permission(current_user.role, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail=f"Permiso insuficiente: {permission.value}"
            )
        return current_user
    return _permission_dependency

def has_role_access(user_role: str, minimum_role: str) -> bool:
    user_level = ROLE_HIERARCHY.get(user_role, 0)
    required_level = ROLE_HIERARCHY.get(minimum_role, 10**9)
    return user_level >= required_level

def require_role(minimum_role: str):
    """
    Dependencia para exigir un rol mínimo.
    Uso: Annotated[User, Depends(require_role("supervisor"))]
    """
    def _role_dependency(current_user: User = Depends(get_current_active_user)) -> User:
        if not has_role_access(current_user.role, minimum_role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail=f"Permisos insuficientes. Se requiere nivel {minimum_role}"
            )
        return current_user
    return _role_dependency

# Alias útiles para legibilidad
require_admin = require_role("admin")
require_superadmin = require_role("superadmin")
require_cashier = require_role("cashier")
require_minimum_role = require_role
require_supervisor = require_role("supervisor")

def get_current_admin_user(current_user: User = Depends(get_current_active_user)) -> User:
    """Legacy helper, prefer use require_admin"""
    if not has_role_access(current_user.role, "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough privileges")
    return current_user
