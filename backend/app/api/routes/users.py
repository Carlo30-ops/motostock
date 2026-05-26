from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import schemas, models
from app.database import get_db
from app.services.auth import (
    get_current_active_user,
    require_minimum_role,
    get_password_hash,
)

router = APIRouter(dependencies=[Depends(require_minimum_role("admin"))])


@router.get("/", response_model=list[schemas.UserOut])
def list_users(
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
):
    # Los admins pueden ver usuarios de su sucursal.
    # Los superadmins podrían ver todos, pero por ahora seguimos la lógica de sucursal.
    query = db.query(models.User)
    if current_user.role != "superadmin":
        query = query.filter(models.User.branch_id == current_user.branch_id)
    
    return query.offset(skip).limit(limit).all()


@router.post("/", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: schemas.UserCreate,
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    db: Session = Depends(get_db),
):
    # Regla: Admin no puede crear Superadmin. Solo Superadmin crea Superadmin.
    if payload.role == "superadmin" and current_user.role != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los superadmins pueden crear otros superadmins",
        )

    # Verificar si el usuario ya existe
    existing = db.query(models.User).filter(
        (models.User.username == payload.username) | (models.User.email == payload.email)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username or email already exists")

    db_user = models.User(
        username=payload.username,
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        role=payload.role,
        branch_id=current_user.branch_id, # Por defecto en la sucursal del creador
        is_active=True,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    db: Session = Depends(get_db),
):
    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Regla: Admin no puede borrar Superadmin.
    if target_user.role == "superadmin" and current_user.role != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para eliminar a un superadmin",
        )
    
    # No borrarse a sí mismo
    if target_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")

    db.delete(target_user)
    db.commit()
