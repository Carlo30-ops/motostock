from typing import Annotated, List

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app import schemas, models
from app.database import get_db
from app.services.auth import (
    require_role, 
    get_current_active_user, 
    has_role_access
)
from app.services.purchase_orders import PurchaseOrderService

# Acceso base: accountant+
router = APIRouter(dependencies=[Depends(require_role("accountant"))])


@router.get("/", response_model=list[schemas.PurchaseOrderOut])
def get_orders(
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    db: Session = Depends(get_db), 
    skip: int = 0, 
    limit: int = 100
):
    """
    Listar órdenes de compra.
    Filtra por sucursal para roles < admin.
    """
    query = db.query(models.PurchaseOrder)
    
    if not has_role_access(current_user.role, "admin"):
        query = query.filter(models.PurchaseOrder.branch_id == current_user.branch_id)
        
    return query.offset(skip).limit(limit).all()


@router.get("/{order_id}", response_model=schemas.PurchaseOrderOut)
def get_order(
    order_id: int,
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    db: Session = Depends(get_db)
):
    """Obtener detalles de una orden específica."""
    return PurchaseOrderService.get_order(db, order_id, current_user.branch_id, current_user.role)


@router.post("/", response_model=schemas.PurchaseOrderOut, status_code=status.HTTP_201_CREATED)
def create_order(
    order: schemas.PurchaseOrderCreate, 
    current_user: Annotated[models.User, Depends(require_role("supervisor"))],
    db: Session = Depends(get_db)
):
    """
    Crear orden de compra en estado DRAFT.
    Solo Supervisor+ puede crear. Accountant es solo lectura.
    """
    return PurchaseOrderService.create_order(db, order, current_user)


@router.post("/{order_id}/submit", response_model=schemas.PurchaseOrderOut)
def submit_order(
    order_id: int,
    current_user: Annotated[models.User, Depends(require_role("supervisor"))],
    db: Session = Depends(get_db)
):
    """Envía la orden para aprobación."""
    return PurchaseOrderService.submit_for_approval(db, order_id, current_user)


@router.post("/{order_id}/approve", response_model=schemas.PurchaseOrderOut)
def approve_order(
    order_id: int,
    current_user: Annotated[models.User, Depends(require_role("admin"))],
    db: Session = Depends(get_db)
):
    """Aprueba la orden (Solo Admin+)."""
    return PurchaseOrderService.approve_order(db, order_id, current_user)


@router.post("/{order_id}/reject", response_model=schemas.PurchaseOrderOut)
def reject_order(
    order_id: int,
    status_update: schemas.PurchaseOrderStatusUpdate,
    current_user: Annotated[models.User, Depends(require_role("admin"))],
    db: Session = Depends(get_db)
):
    """Rechaza la orden (Solo Admin+)."""
    return PurchaseOrderService.reject_order(db, order_id, status_update.notes, current_user)


@router.post("/{order_id}/order", response_model=schemas.PurchaseOrderOut)
def mark_as_ordered(
    order_id: int,
    current_user: Annotated[models.User, Depends(require_role("supervisor"))],
    db: Session = Depends(get_db)
):
    """Marca la orden como pedida al proveedor."""
    return PurchaseOrderService.mark_as_ordered(db, order_id, current_user)


@router.post("/{order_id}/receive", response_model=schemas.PurchaseOrderOut)
def receive_items(
    order_id: int,
    receipt: schemas.PurchaseOrderReceipt,
    current_user: Annotated[models.User, Depends(require_role("supervisor"))],
    db: Session = Depends(get_db)
):
    """Registra la recepción de mercancía."""
    return PurchaseOrderService.receive_items(db, order_id, receipt.items, current_user)


@router.delete("/{order_id}", response_model=schemas.PurchaseOrderOut)
def cancel_order(
    order_id: int,
    current_user: Annotated[models.User, Depends(require_role("supervisor"))],
    db: Session = Depends(get_db)
):
    """Cancela una orden de compra."""
    return PurchaseOrderService.cancel_order(db, order_id, current_user)
