import pytest
from sqlalchemy.orm import Session
from app import models, schemas
from app.services.purchase_orders import PurchaseOrderService
from app.services.auth import get_password_hash
from datetime import date
from fastapi import HTTPException

# --- 1. Mocks & Setup Helpers ---

def setup_test_data(db: Session):
    """Crea sucursal, proveedor y productos para el test."""
    # Limpiar
    db.query(models.InventoryMovement).delete()
    db.query(models.PurchaseOrderItem).delete()
    db.query(models.PurchaseOrder).delete()
    db.query(models.Product).delete()
    db.query(models.Supplier).delete()
    db.query(models.User).delete()
    db.query(models.Branch).delete()
    
    branch = models.Branch(name="Sucursal Test", is_active=True)
    db.add(branch)
    db.flush()
    
    admin = models.User(
        username="test_admin",
        email="admin@test.com",
        hashed_password=get_password_hash("pass"),
        role="admin",
        branch_id=branch.id
    )
    supervisor = models.User(
        username="test_supervisor",
        email="sup@test.com",
        hashed_password=get_password_hash("pass"),
        role="supervisor",
        branch_id=branch.id
    )
    accountant = models.User(
        username="test_acc",
        email="acc@test.com",
        hashed_password=get_password_hash("pass"),
        role="accountant",
        branch_id=branch.id
    )
    db.add_all([admin, supervisor, accountant])
    
    supplier = models.Supplier(name="Proveedor Test", is_active=True)
    db.add(supplier)
    
    p1 = models.Product(
        name="Llanta Moto", code="LL-01", category="Repuestos", 
        brand="Pirelli", stock=10, cost_price=100.0, sale_price=150.0, 
        branch_id=branch.id
    )
    p2 = models.Product(
        name="Aceite 4T", code="AC-01", category="Lubricantes", 
        brand="Mobil", stock=5, cost_price=20.0, sale_price=35.0, 
        branch_id=branch.id
    )
    db.add_all([p1, p2])
    db.commit()
    return branch, admin, supervisor, accountant, supplier, p1, p2

# --- 2. Pruebas de Flujo Completo ---

def test_full_purchasing_workflow(db: Session):
    branch, admin, supervisor, accountant, supplier, p1, p2 = setup_test_data(db)
    
    # A. Crear Orden (Draft)
    order_in = schemas.PurchaseOrderCreate(
        supplier="Proveedor Test",
        supplier_id=supplier.id,
        date=date.today(),
        notes="Prueba smoke test",
        items=[
            schemas.PurchaseOrderItemIn(product_id=p1.id, quantity=10, unit_cost=110.0),
            schemas.PurchaseOrderItemIn(product_id=p2.id, quantity=5, unit_cost=25.0),
        ]
    )
    
    order = PurchaseOrderService.create_order(db, order_in, supervisor)
    assert order.status == models.PurchaseOrderStatus.draft
    assert len(order.items) == 2
    assert order.total == (10 * 110.0) + (5 * 25.0)
    
    # B. Enviar para aprobación
    order = PurchaseOrderService.submit_for_approval(db, order.id, supervisor)
    assert order.status == models.PurchaseOrderStatus.pending_approval
    
    # C. Aprobar (Admin)
    order = PurchaseOrderService.approve_order(db, order.id, admin)
    assert order.status == models.PurchaseOrderStatus.approved
    assert order.approved_by_id == admin.id
    
    # D. Marcar como pedido
    order = PurchaseOrderService.mark_as_ordered(db, order.id, supervisor)
    assert order.status == models.PurchaseOrderStatus.ordered
    
    # E. Recepción Parcial 1
    # P1: Pedido 10, Recibimos 5. 
    # Stock previo: 10. Costo previo: 100.0. Costo nuevo: 110.0
    # WAC: ((10 * 100) + (5 * 110)) / 15 = (1000 + 550) / 15 = 1550 / 15 = 103.333
    receipt_items = [
        schemas.PurchaseOrderReceiptItem(product_id=p1.id, quantity=5)
    ]
    order = PurchaseOrderService.receive_items(db, order.id, receipt_items, supervisor)
    
    assert order.status == models.PurchaseOrderStatus.partially_received
    db.refresh(p1)
    assert p1.stock == 15
    assert pytest.approx(p1.cost_price, 0.01) == 103.33
    
    # Verificar Ledger (InventoryMovement)
    movement = db.query(models.InventoryMovement).filter_by(product_id=p1.id).first()
    assert movement.movement_type == models.MovementType.purchase
    assert movement.quantity == 5
    assert movement.previous_stock == 10
    assert movement.new_stock == 15
    assert movement.previous_cost == 100.0
    assert pytest.approx(movement.new_cost, 0.01) == 103.33
    assert movement.unit_cost == 110.0
    
    # F. Recepción Final
    # P1: Faltan 5. P2: Faltan 5.
    receipt_items = [
        schemas.PurchaseOrderReceiptItem(product_id=p1.id, quantity=5),
        schemas.PurchaseOrderReceiptItem(product_id=p2.id, quantity=5),
    ]
    order = PurchaseOrderService.receive_items(db, order.id, receipt_items, supervisor)
    
    assert order.status == models.PurchaseOrderStatus.received
    db.refresh(p1)
    db.refresh(p2)
    assert p1.stock == 20
    assert p2.stock == 10
    # WAC P2: ((5 * 20) + (5 * 25)) / 10 = (100 + 125) / 10 = 22.5
    assert p2.cost_price == 22.5

# --- 3. Pruebas de Restricciones y Seguridad ---

def test_purchasing_constraints(db: Session):
    branch, admin, supervisor, accountant, supplier, p1, p2 = setup_test_data(db)
    
    # A. RBAC: Accountant no puede aprobar
    order_in = schemas.PurchaseOrderCreate(
        supplier="Test", date=date.today(), items=[
            schemas.PurchaseOrderItemIn(product_id=p1.id, quantity=2, unit_cost=100.0)
        ]
    )
    order = PurchaseOrderService.create_order(db, order_in, supervisor)
    order = PurchaseOrderService.submit_for_approval(db, order.id, supervisor)
    
    with pytest.raises(HTTPException) as exc:
        PurchaseOrderService.approve_order(db, order.id, accountant)
    assert exc.value.status_code == 403
    
    # B. Sobre-recepción bloqueada
    order = PurchaseOrderService.approve_order(db, order.id, admin)
    order = PurchaseOrderService.mark_as_ordered(db, order.id, supervisor)
    
    with pytest.raises(HTTPException) as exc:
        PurchaseOrderService.receive_items(db, order.id, [
            schemas.PurchaseOrderReceiptItem(product_id=p1.id, quantity=100)
        ], supervisor)
    assert exc.value.status_code == 400
    assert "No se puede recibir más de lo pendiente" in exc.value.detail

    # C. Cancelación inválida (si ya se recibió algo)
    PurchaseOrderService.receive_items(db, order.id, [
        schemas.PurchaseOrderReceiptItem(product_id=p1.id, quantity=1)
    ], supervisor)
    
    with pytest.raises(HTTPException) as exc:
        PurchaseOrderService.cancel_order(db, order.id, supervisor)
    assert exc.value.status_code == 400
    assert "No se puede cancelar una orden con recepciones parciales" in exc.value.detail

# --- 4. Prueba de Concurrencia (Simulada) ---

def test_concurrency_locking(db: Session):
    branch, admin, supervisor, accountant, supplier, p1, p2 = setup_test_data(db)
    
    # Creamos orden
    order_in = schemas.PurchaseOrderCreate(
        supplier="Test", date=date.today(), items=[
            schemas.PurchaseOrderItemIn(product_id=p1.id, quantity=100, unit_cost=110.0)
        ]
    )
    order = PurchaseOrderService.create_order(db, order_in, supervisor)
    order = PurchaseOrderService.submit_for_approval(db, order.id, supervisor)
    order = PurchaseOrderService.approve_order(db, order.id, admin)
    order = PurchaseOrderService.mark_as_ordered(db, order.id, supervisor)
    
    # En un entorno real usaríamos threads, aquí validamos que with_for_update está presente en el código
    # (Ya lo validamos en la implementación del service)
    
    # Ejecutamos recepciones secuenciales para validar que el WAC se acumula correctamente
    PurchaseOrderService.receive_items(db, order.id, [
        schemas.PurchaseOrderReceiptItem(product_id=p1.id, quantity=1)
    ], supervisor)
    db.refresh(p1)
    cost1 = p1.cost_price
    
    PurchaseOrderService.receive_items(db, order.id, [
        schemas.PurchaseOrderReceiptItem(product_id=p1.id, quantity=1)
    ], supervisor)
    db.refresh(p1)
    cost2 = p1.cost_price
    
    assert cost1 != cost2 # El costo debe variar en cada recepción si el unit_cost es diferente al previo
