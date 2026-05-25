from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import schemas, models
from app.database import get_db
from app.services.auth import require_minimum_role, get_current_active_user

router = APIRouter(dependencies=[Depends(require_minimum_role("supervisor"))])


@router.get("/", response_model=list[schemas.PurchaseOrderOut])
def get_orders(
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    db: Session = Depends(get_db), 
    skip: int = 0, 
    limit: int = 100
):
    return db.query(models.PurchaseOrder).filter(models.PurchaseOrder.branch_id == current_user.branch_id).offset(skip).limit(limit).all()


@router.post("/", response_model=schemas.PurchaseOrderOut, status_code=status.HTTP_201_CREATED)
def create_order(
    order: schemas.PurchaseOrderCreate, 
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    db: Session = Depends(get_db)
):
    total = sum(item.unit_cost * item.quantity for item in order.items)
    
    supplier_name = order.supplier
    if order.supplier_id:
        supplier_row = db.query(models.Supplier).filter(models.Supplier.id == order.supplier_id).first()
        if supplier_row:
            supplier_name = supplier_row.name

    db_order = models.PurchaseOrder(
        branch_id=current_user.branch_id,
        supplier_id=order.supplier_id,
        supplier=supplier_name,
        date=order.date,
        total=total,
        notes=order.notes,
        status=models.OrderStatus.pending,
    )
    db.add(db_order)
    db.flush()
    
    for item in order.items:
        db_item = models.PurchaseOrderItem(
            order_id=db_order.id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_cost=item.unit_cost
        )
        db.add(db_item)
        
    db.commit()
    db.refresh(db_order)
    return db_order


@router.patch("/{order_id}/status", response_model=schemas.PurchaseOrderOut)
def update_order_status(
    order_id: int, 
    status_update: schemas.PurchaseOrderStatusUpdate, 
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    db: Session = Depends(get_db)
):
    db_order = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.id == order_id,
        models.PurchaseOrder.branch_id == current_user.branch_id
    ).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    if status_update.status not in ["sent", "received"]:
        raise HTTPException(status_code=400, detail="Invalid status")
        
    # If marking as received, update stock
    if status_update.status == "received" and db_order.status != models.OrderStatus.received:
        for item in db_order.items:
            product = db.query(models.Product).filter(
                models.Product.id == item.product_id,
                models.Product.branch_id == current_user.branch_id
            ).first()
            if product:
                product.stock += item.quantity
                
    db_order.status = getattr(models.OrderStatus, status_update.status)
    db.commit()
    db.refresh(db_order)
    return db_order
