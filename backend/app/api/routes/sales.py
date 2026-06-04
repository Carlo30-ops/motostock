from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app import schemas, models
from app.database import get_db
from app.services.auth import (
    require_role, 
    get_current_active_user, 
    has_role_access,
    require_supervisor
)
from app.logging_config import audit_logger

router = APIRouter(dependencies=[Depends(require_role("cashier"))])

MONEY_TOLERANCE = 0.01


def _money(value: float) -> float:
    return round(value + 1e-9, 2)


def _volume_discount_multiplier(quantity: int) -> float:
    return 0.9 if quantity >= 5 else 1.0


def _assert_money_matches(label: str, expected: float, actual: float):
    if abs(_money(expected) - _money(actual)) > MONEY_TOLERANCE:
        raise HTTPException(
            status_code=400,
            detail=f"{label} no coincide con el calculo del servidor. Esperado: {_money(actual)}",
        )


@router.get("/", response_model=list[schemas.SaleOut])
def get_sales(
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    db: Session = Depends(get_db), 
    skip: int = 0, 
    limit: int = 100
):
    """
    Listar ventas.
    Mechanic: Prohibido.
    Accountant/Cashier/Supervisor: Solo su propia sucursal.
    Admin+: Todas las sucursales.
    """
    if current_user.role == "mechanic":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Los mecánicos no tienen permiso para ver ventas"
        )
        
    query = db.query(models.Sale).options(joinedload(models.Sale.items))
    
    if not has_role_access(current_user.role, "admin"):
        query = query.filter(models.Sale.branch_id == current_user.branch_id)
        
    return query.offset(skip).limit(limit).all()


@router.post("/", response_model=schemas.SaleOut, status_code=status.HTTP_201_CREATED)
def create_sale(
    sale: schemas.SaleCreate, 
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    db: Session = Depends(get_db)
):
    """
    Crear venta.
    Accountant/Mechanic: Prohibido.
    Cashier: Solo su propia sucursal, descuento limitado por max_discount.
    Supervisor+: Solo su propia sucursal (si no es admin), descuento libre.
    """
    if current_user.role in ["mechanic", "accountant"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Su rol no tiene permiso para crear ventas"
        )

    # Validar descuento máximo para Cajeros
    if current_user.role == "cashier":
        if sale.discount_pct > current_user.max_discount:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Descuento excedido. Su máximo permitido es {current_user.max_discount}%"
            )

    # Check for idempotency if offline_id is provided
    if sale.offline_id:
        existing_sale = db.query(models.Sale).filter(
            models.Sale.offline_id == sale.offline_id,
            models.Sale.branch_id == current_user.branch_id
        ).first()
        if existing_sale:
            return existing_sale

    if not sale.items:
        raise HTTPException(status_code=400, detail="La venta debe tener al menos un item")

    # Validar cupo de crédito si aplica
    db_client = None
    if sale.payment_method == "credit":
        if not sale.client_id:
            raise HTTPException(status_code=400, detail="Venta a crédito requiere un cliente")
        db_client = db.query(models.Client).filter(models.Client.id == sale.client_id).first()
        if not db_client:
            raise HTTPException(status_code=404, detail="Cliente no encontrado")

    db_sale = models.Sale(
        branch_id=current_user.branch_id,
        client_id=sale.client_id,
        cashier_id=current_user.id,
        date=sale.date or date.today(),
        payment_method=models.PaymentMethod(sale.payment_method),
        discount_pct=sale.discount_pct,
        offline_id=sale.offline_id,
        subtotal=0,
        total=0
    )
    
    db.add(db_sale)
    db.flush()

    total_subtotal = 0

    for item in sale.items:
        product = db.query(models.Product).filter(
            models.Product.id == item.product_id,
            models.Product.branch_id == current_user.branch_id
        ).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Producto {item.product_id} no encontrado")
        
        if product.stock < item.quantity:
            raise HTTPException(
                status_code=400, 
                detail=f"Stock insuficiente para {product.name}. Disponible: {product.stock}"
            )

        # Seguridad: Validar que el precio enviado no haya sido manipulado
        _assert_money_matches(f"Precio de {product.name}", item.unit_price, product.sale_price)

        # Aplicar descuento por volumen si aplica
        multiplier = _volume_discount_multiplier(item.quantity)
        actual_unit_price = _money(product.sale_price * multiplier)
        
        db_item = models.SaleItem(
            sale_id=db_sale.id,
            product_id=product.id,
            quantity=item.quantity,
            unit_price=actual_unit_price
        )
        db.add(db_item)
        
        # Descontar stock
        product.stock -= item.quantity
        
        # Registrar movimiento de inventario
        movement = models.InventoryMovement(
            product_id=product.id,
            branch_id=current_user.branch_id,
            user_id=current_user.id,
            movement_type=models.MovementType.sale,
            quantity=-item.quantity,
            previous_stock=product.stock + item.quantity,
            new_stock=product.stock,
            previous_cost=product.cost_price,
            new_cost=product.cost_price,
            unit_cost=product.cost_price,
            reference_type="sale",
            reference_id=str(db_sale.id)
        )
        db.add(movement)

        total_subtotal += actual_unit_price * item.quantity

    # Calcular total con descuento global
    calculated_total = _money(total_subtotal * (1 - (sale.discount_pct / 100)))
    
    # Seguridad: Validar contra expected_total si se proporciona
    if sale.expected_total is not None:
        _assert_money_matches("Total de venta", sale.expected_total, calculated_total)

    # Validar cupo de crédito
    if sale.payment_method == "credit" and db_client:
        if db_client.credit_balance < calculated_total:
            raise HTTPException(
                status_code=400,
                detail=f"Cupo insuficiente. Disponible: {db_client.credit_balance}"
            )
        db_client.credit_balance = _money(db_client.credit_balance - calculated_total)
        
        # Registrar movimiento en el ledger del cliente
        ledger_entry = models.CreditLedger(
            client_id=db_client.id,
            organization_id=current_user.organization_id,
            amount=-calculated_total,
            description=f"Venta #{db_sale.id}"
        )
        db.add(ledger_entry)

    db_sale.subtotal = _money(total_subtotal)
    db_sale.total = calculated_total
    
    db.commit()
    db.refresh(db_sale)
    
    audit_logger.log_action(
        actor_id=current_user.id,
        target_id=db_sale.id,
        action="create_sale",
        resource="sales",
        branch_id=current_user.branch_id,
        details={"total": calculated_total, "items_count": len(sale.items)}
    )
    
    return db_sale


@router.get("/{sale_id}", response_model=schemas.SaleOut)
def get_sale(
    sale_id: int,
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    db: Session = Depends(get_db)
):
    """Obtener detalle de una venta."""
    query = db.query(models.Sale).options(joinedload(models.Sale.items)).filter(models.Sale.id == sale_id)
    
    if not has_role_access(current_user.role, "admin"):
        query = query.filter(models.Sale.branch_id == current_user.branch_id)
        
    db_sale = query.first()
    if not db_sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
        
    return db_sale


@router.delete("/{sale_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sale(
    sale_id: int,
    current_user: Annotated[models.User, Depends(require_supervisor)],
    db: Session = Depends(get_db)
):
    """Anular venta (Solo Supervisor+)."""
    query = db.query(models.Sale).filter(models.Sale.id == sale_id)
    
    if not has_role_access(current_user.role, "admin"):
        query = query.filter(models.Sale.branch_id == current_user.branch_id)
        
    db_sale = query.first()
    if not db_sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

    # Si fue a crédito, devolver cupo
    if db_sale.payment_method == models.PaymentMethod.credit and db_sale.client_id:
        db_client = db.query(models.Client).filter(models.Client.id == db_sale.client_id).first()
        if db_client:
            db_client.credit_balance = _money(db_client.credit_balance + db_sale.total)

    # Devolver stock
    for item in db_sale.items:
        product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
        if product:
            product.stock += item.quantity
            
            # Registrar movimiento
            movement = models.InventoryMovement(
                product_id=product.id,
                branch_id=current_user.branch_id,
                user_id=current_user.id,
                movement_type=models.MovementType.adjustment,
                quantity=item.quantity,
                previous_stock=product.stock - item.quantity,
                new_stock=product.stock,
                previous_cost=product.cost_price,
                new_cost=product.cost_price,
                unit_cost=product.cost_price,
                reference_type="sale_void",
                reference_id=str(db_sale.id)
            )
            db.add(movement)

    db.delete(db_sale)
    db.commit()
    
    audit_logger.log_action(
        actor_id=current_user.id,
        target_id=sale_id,
        action="delete_sale",
        resource="sales",
        branch_id=current_user.branch_id
    )
    
    return None
