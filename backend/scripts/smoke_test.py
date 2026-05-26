import os
import sys
from datetime import date

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.getcwd(), "backend"))

# Mocking the database to use SQLite for this smoke test
os.environ["DATABASE_URL"] = "sqlite:///./smoke_test.db"

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app import models, schemas
from app.services.purchase_orders import PurchaseOrderService
from app.services.auth import get_password_hash

# Initialize Engine
engine = create_engine("sqlite:///./smoke_test.db", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def run_smoke_test():
    print("🚀 Iniciando Smoke Test del Módulo de Compras...")
    
    # Create tables in SQLite
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        # 1. Setup Data
        print("--- 1. Preparando datos de prueba ---")
        branch = models.Branch(name="Sucursal Norte", is_active=True)
        db.add(branch)
        db.flush()
        
        admin = models.User(
            username="admin_smoke", email="admin@smoke.com",
            hashed_password=get_password_hash("admin123"),
            role="admin", branch_id=branch.id
        )
        supervisor = models.User(
            username="sup_smoke", email="sup@smoke.com",
            hashed_password=get_password_hash("sup123"),
            role="supervisor", branch_id=branch.id
        )
        db.add_all([admin, supervisor])
        
        p1 = models.Product(
            name="Llanta 17", code="LL-17", category="Llantas", brand="Pirelli",
            stock=10, cost_price=100.0, sale_price=150.0, branch_id=branch.id
        )
        db.add(p1)
        db.commit()
        print(f"✅ Datos listos. Producto: {p1.name}, Stock Inicial: {p1.stock}, Costo: {p1.cost_price}")

        # 2. Flow: Draft -> Approved -> Ordered
        print("\n--- 2. Flujo: Draft -> Approved -> Ordered ---")
        order_in = schemas.PurchaseOrderCreate(
            supplier="Distribuidora Pirelli", date=date.today(),
            items=[schemas.PurchaseOrderItemIn(product_id=p1.id, quantity=10, unit_cost=120.0)],
            notes="Orden de prueba SaaS prep"
        )
        order = PurchaseOrderService.create_order(db, order_in, supervisor)
        print(f"✅ Orden creada (DRAFT). ID: {order.id}, Total: {order.total}")
        
        order = PurchaseOrderService.submit_for_approval(db, order.id, supervisor)
        print(f"✅ Enviada para aprobación. Status: {order.status}")
        
        order = PurchaseOrderService.approve_order(db, order.id, admin)
        print(f"✅ Aprobada por Admin. Status: {order.status}")
        
        order = PurchaseOrderService.mark_as_ordered(db, order.id, supervisor)
        print(f"✅ Marcada como pedido (ORDERED). Status: {order.status}")

        # 3. Reception & WAC Calculation
        print("\n--- 3. Recepción Parcial e Integridad Financiera ---")
        # Recibimos 5 de 10. Costo unitario en orden: 120.0. Costo previo: 100.0. Stock previo: 10.
        # Nuevo Costo = ((10 * 100) + (5 * 120)) / 15 = 1600 / 15 = 106.666
        receipt = [schemas.PurchaseOrderReceiptItem(product_id=p1.id, quantity=5)]
        order = PurchaseOrderService.receive_items(db, order.id, receipt, supervisor)
        
        db.refresh(p1)
        print(f"✅ Recepción parcial registrada. Status Orden: {order.status}")
        print(f"📈 Nuevo Stock: {p1.stock} (Esperado: 15)")
        print(f"💰 Nuevo Costo WAC: {p1.cost_price:.2f} (Esperado: 106.67)")
        
        assert p1.stock == 15
        assert round(p1.cost_price, 2) == 106.67

        # 4. Ledger Validation
        print("\n--- 4. Validación de Ledger (InventoryMovement) ---")
        movement = db.query(models.InventoryMovement).filter_by(product_id=p1.id).first()
        print(f"📝 Movimiento registrado: Tipo={movement.movement_type}, Cant={movement.quantity}")
        print(f"📊 Snapshot: Stock {movement.previous_stock}->{movement.new_stock}, Costo {movement.previous_cost}->{movement.new_cost}")
        
        assert movement.movement_type == models.MovementType.purchase
        assert movement.quantity == 5
        assert movement.new_stock == 15

        # 5. Constraints Validation
        print("\n--- 5. Validación de Restricciones ---")
        try:
            # Intentar recibir más de lo pendiente (Faltan 5, intentamos 10)
            PurchaseOrderService.receive_items(db, order.id, [
                schemas.PurchaseOrderReceiptItem(product_id=p1.id, quantity=10)
            ], supervisor)
            print("❌ Error: Se permitió sobre-recepción")
        except Exception as e:
            print(f"✅ Bloqueo de sobre-recepción exitoso: {str(e)}")

        print("\n🔥 SMOKE TEST COMPLETADO CON ÉXITO 🔥")
        
    except Exception as e:
        print(f"\n❌ ERROR EN EL SMOKE TEST: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()
        if os.path.exists("./smoke_test.db"):
            os.remove("./smoke_test.db")

if __name__ == "__main__":
    run_smoke_test()
