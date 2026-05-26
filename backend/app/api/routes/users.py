from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import func

from app import schemas, models
from app.database import get_db
from app.services.auth import (
    get_current_active_user,
    require_admin,
    get_password_hash,
    verify_password,
    has_role_access,
)
from app.logging_config import audit_logger
from app.middleware.rate_limiter import limiter

router = APIRouter(dependencies=[Depends(require_admin)])


@router.get("/", response_model=list[schemas.UserOut])
def list_users(
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
):
    """
    Listar usuarios. 
    Superadmin ve todos. 
    Admin ve todos para reasignación (según reglas de negocio).
    """
    query = db.query(models.User)
    users = query.offset(skip).limit(limit).all()
    
    # Si el admin ve usuarios de otra sucursal, nos aseguramos de que solo vea lo básico
    # El esquema schemas.UserOut ya filtra hashed_password y otros campos sensibles.
    return users


@router.post("/", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def create_user(
    request: Request,
    payload: schemas.UserCreate,
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    db: Session = Depends(get_db),
):
    """
    Crear usuario.
    Superadmin: cualquier sucursal/rol.
    Admin: solo su propia sucursal, no puede crear superadmins.
    """
    # Restricción de rol
    if payload.role == "superadmin" and current_user.role != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los superadmins pueden crear otros superadmins",
        )

    # Restricción de sucursal para Admin
    target_branch_id = payload.branch_id
    if current_user.role != "superadmin":
        if target_branch_id and target_branch_id != current_user.branch_id:
             raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Un admin solo puede crear usuarios en su propia sucursal",
            )
        target_branch_id = current_user.branch_id
    elif not target_branch_id:
        target_branch_id = current_user.branch_id

    # Verificar si el usuario ya existe
    existing = db.query(models.User).filter(
        (models.User.username == payload.username) | (models.User.email == payload.email)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="El nombre de usuario o email ya existe")

    db_user = models.User(
        username=payload.username,
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        role=payload.role,
        branch_id=target_branch_id,
        is_active=True,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    audit_logger.log_action(
        actor_id=current_user.id,
        target_id=db_user.id,
        action="create_user",
        resource="users",
        branch_id=current_user.branch_id,
        details={"username": db_user.username, "role": db_user.role, "target_branch": db_user.branch_id}
    )

    return db_user


@router.put("/{user_id}", response_model=schemas.UserOut)
def update_user(
    user_id: int,
    payload: schemas.UserUpdate,
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    db: Session = Depends(get_db),
):
    """
    Actualizar usuario.
    Admin solo puede editar usuarios de su sucursal y no puede tocar superadmins.
    """
    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Reglas para Admin
    if current_user.role != "superadmin":
        if target_user.branch_id != current_user.branch_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para editar usuarios de otras sucursales",
            )
        if target_user.role == "superadmin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para editar a un superadmin",
            )
        if payload.role == "superadmin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo un superadmin puede asignar el rol superadmin",
            )
        # No permitir que un admin modifique a otro admin si no es superadmin (Escalamiento horizontal)
        if target_user.role == "admin" and target_user.id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No puedes modificar a otro administrador del mismo nivel",
            )

    update_data = payload.model_dump(exclude_unset=True)
    
    # Si se desactiva, invalidar sesiones
    if update_data.get("is_active") is False and target_user.is_active:
        db.query(models.RefreshToken).filter(models.RefreshToken.user_id == target_user.id).update(
            {"is_active": False, "revoked_at": func.now()}
        )

    for key, value in update_data.items():
        setattr(target_user, key, value)

    db.commit()
    db.refresh(target_user)

    audit_logger.log_action(
        actor_id=current_user.id,
        target_id=target_user.id,
        action="update_user",
        resource="users",
        branch_id=current_user.branch_id,
        details={"changes": list(update_data.keys())}
    )

    return target_user


@router.post("/{user_id}/change-password")
@limiter.limit("5/minute")
def change_password(
    request: Request,
    user_id: int,
    payload: schemas.PasswordChange,
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    db: Session = Depends(get_db),
):
    """
    Cambio de contraseña. 
    Un usuario puede cambiar la suya propia (con contraseña actual).
    Admin+ puede cambiar la de otros (sin contraseña actual, pero con restricciones).
    """
    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Cambio propio
    if current_user.id == target_user.id:
        if not payload.current_password or not verify_password(payload.current_password, target_user.hashed_password):
            raise HTTPException(status_code=400, detail="Contraseña actual incorrecta")
    else:
        # Cambio ajeno: requiere Admin+
        if not has_role_access(current_user.role, "admin"):
            raise HTTPException(status_code=403, detail="No tienes permiso para cambiar contraseñas ajenas")
        
        if current_user.role != "superadmin":
            if target_user.role == "superadmin" or target_user.branch_id != current_user.branch_id:
                raise HTTPException(status_code=403, detail="No tienes permiso sobre este usuario")
            # Un admin no puede resetear el password de otro admin
            if target_user.role == "admin":
                raise HTTPException(status_code=403, detail="No puedes cambiar la contraseña de otro administrador")

    target_user.hashed_password = get_password_hash(payload.new_password)
    
    # Invalidar todas las sesiones al cambiar password
    db.query(models.RefreshToken).filter(models.RefreshToken.user_id == target_user.id).update(
        {"is_active": False, "revoked_at": func.now()}
    )
    
    db.commit()

    audit_logger.log_action(
        actor_id=current_user.id,
        target_id=target_user.id,
        action="change_password",
        resource="users",
        branch_id=current_user.branch_id
    )

    return {"message": "Contraseña actualizada correctamente"}


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    db: Session = Depends(get_db),
):
    """
    Eliminar usuario (Soft Delete).
    Admin solo puede desactivar usuarios de su propia sucursal y no superadmins.
    """
    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if current_user.role != "superadmin":
        if target_user.role == "superadmin" or target_user.branch_id != current_user.branch_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para eliminar este usuario",
            )
        # Admin no puede eliminar a otro admin
        if target_user.role == "admin" and target_user.id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No puedes eliminar a otro administrador",
            )
    
    if target_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")

    # Soft delete
    target_user.is_active = False
    
    # Invalidar refresh tokens
    db.query(models.RefreshToken).filter(models.RefreshToken.user_id == target_user.id).update(
        {"is_active": False, "revoked_at": func.now()}
    )
    
    db.commit()

    audit_logger.log_action(
        actor_id=current_user.id,
        target_id=target_user.id,
        action="soft_delete_user",
        resource="users",
        branch_id=current_user.branch_id
    )
