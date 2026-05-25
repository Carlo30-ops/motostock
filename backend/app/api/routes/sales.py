# Fase 1.1: ventas y combos protegidos con autenticación JWT (rol cashier o superior).
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import schemas, models
from app.database import get_db
from app.services.auth import require_minimum_role

router = APIRouter(dependencies=[Depends(require_minimum_role("cashier"))])

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
def get_sales(db: Session = Depends(get_db), skip: int = 0, limit: int = 100):
    return db.query(models.Sale).offset(skip).limit(limit).all()


@router.post("/", response_model=schemas.SaleOut, status_code=status.HTTP_201_CREATED)
def create_sale(sale: schemas.SaleCreate, db: Session = Depends(get_db)):
    # Check for idempotency if offline_id is provided
    if sale.offline_id:
        existing_sale = db.query(models.Sale).filter(models.Sale.offline_id == sale.offline_id).first()
        if existing_sale:
            return existing_sale

    if not sale.items:
        raise HTTPException(status_code=400, detail="La venta debe tener al menos un producto")

    calculated_items: list[tuple[schemas.SaleItemIn, models.Product, float]] = []
    subtotal = 0.0
    for item in sale.items:
        if item.quantity <= 0:
            raise HTTPException(status_code=400, detail="La cantidad debe ser mayor a cero")

        product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
        if product.stock < item.quantity:
            raise HTTPException(status_code=400, detail=f"Not enough stock for {product.name}")

        expected_unit_price = _money(product.sale_price * _volume_discount_multiplier(item.quantity))
        _assert_money_matches(
            f"Precio del producto {product.id}",
            item.unit_price,
            expected_unit_price,
        )
        subtotal += expected_unit_price * item.quantity
        calculated_items.append((item, product, expected_unit_price))

    subtotal = _money(subtotal)
    discount_amount = _money((subtotal * sale.discount_pct) / 100)
    total = _money(subtotal - discount_amount)

    if sale.expected_total is not None:
        _assert_money_matches("Total de la venta", sale.expected_total, total)

    client = None
    if sale.payment_method == "credit":
        if not sale.client_id:
            raise HTTPException(status_code=400, detail="Client ID required for credit payment")
        client = db.query(models.Client).filter(models.Client.id == sale.client_id).first()
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        if client.credit_balance < total:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Cupo de credito insuficiente. "
                    f"Disponible: {_money(client.credit_balance)}, requerido: {total}"
                ),
            )

    # Create sale record
    db_sale = models.Sale(
        offline_id=sale.offline_id,
        client_id=sale.client_id,
        date=sale.date,
        subtotal=subtotal,
        discount_pct=sale.discount_pct,
        total=total,
        payment_method=sale.payment_method
    )
    db.add(db_sale)
    db.flush() # Get ID for items

    # Create items and update stock
    for item, product, unit_price in calculated_items:
        product.stock -= item.quantity
        
        # Automation 1: Auto-generate draft purchase order if stock hits 0
        if product.stock <= 0:
            supplier = product.supplier or "Unknown Supplier"
            # Check if pending order already exists for this supplier
            existing_order = db.query(models.PurchaseOrder).filter(
                models.PurchaseOrder.supplier == supplier,
                models.PurchaseOrder.status == models.OrderStatus.pending
            ).first()
            
            if existing_order:
                # Add item to existing draft
                existing_item = db.query(models.PurchaseOrderItem).filter(
                    models.PurchaseOrderItem.order_id == existing_order.id,
                    models.PurchaseOrderItem.product_id == product.id
                ).first()
                if existing_item:
                    existing_item.quantity += product.reorder_threshold
                    existing_order.total += (product.cost_price * product.reorder_threshold)
                else:
                    new_order_item = models.PurchaseOrderItem(
                        order_id=existing_order.id,
                        product_id=product.id,
                        quantity=product.reorder_threshold,
                        unit_cost=product.cost_price
                    )
                    db.add(new_order_item)
                    existing_order.total += (product.cost_price * product.reorder_threshold)
            else:
                # Create new draft order
                new_order = models.PurchaseOrder(
                    supplier=supplier,
                    status=models.OrderStatus.pending,
                    date=sale.date,
                    total=product.cost_price * product.reorder_threshold,
                    notes="Auto-generated due to zero stock"
                )
                db.add(new_order)
                db.flush()
                new_order_item = models.PurchaseOrderItem(
                    order_id=new_order.id,
                    product_id=product.id,
                    quantity=product.reorder_threshold,
                    unit_cost=product.cost_price
                )
                db.add(new_order_item)

        # Automation 2: Update client's last service date if it's an oil change
        if product.category == "Oil & Lubricants" and sale.client_id:
            client_to_update = db.query(models.Client).filter(models.Client.id == sale.client_id).first()
            if client_to_update:
                client_to_update.last_service_date = sale.date

        db_item = models.SaleItem(
            sale_id=db_sale.id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=unit_price
        )
        db.add(db_item)

    # Handle store credit as available credit limit.
    if sale.payment_method == "credit":
        client.credit_balance = _money(client.credit_balance - total)
        
        ledger_entry = models.CreditLedger(
            client_id=client.id,
            amount=-total,
            description=f"Sale #{db_sale.id}"
        )
        db.add(ledger_entry)

    db.commit()
    db.refresh(db_sale)
    return db_sale


@router.get("/combos", response_model=list[schemas.ComboOut])
def get_combos(db: Session = Depends(get_db)):
    return db.query(models.Combo).all()


@router.post("/combos", response_model=schemas.ComboOut, status_code=status.HTTP_201_CREATED)
def create_combo(combo: schemas.ComboCreate, db: Session = Depends(get_db)):
    db_combo = models.Combo(name=combo.name, price=combo.price)
    db.add(db_combo)
    db.flush()
    
    for item in combo.items:
        db_item = models.ComboItem(
            combo_id=db_combo.id,
            product_id=item.product_id,
            quantity=item.quantity
        )
        db.add(db_item)
        
    db.commit()
    db.refresh(db_combo)
    return db_combo
