from datetime import datetime
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.logging_config import audit_logger
from app.services.auth import has_role_access


class PurchaseOrderService:
    @staticmethod
    def get_order(db: Session, order_id: int, branch_id: int, role: str) -> models.PurchaseOrder:
        query = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == order_id)
        
        # Filtro de sucursal para roles no-admin
        if not has_role_access(role, "admin"):
            query = query.filter(models.PurchaseOrder.branch_id == branch_id)
            
        order = query.first()
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="Orden de compra no encontrada"
            )
        return order

    @staticmethod
    def create_order(db: Session, order_in: schemas.PurchaseOrderCreate, user: models.User) -> models.PurchaseOrder:
        """Crea una orden en estado DRAFT."""
        total = 0
        items = []
        
        for item_in in order_in.items:
            # Validar que el producto existe y pertenece a la sucursal
            product = db.query(models.Product).filter(
                models.Product.id == item_in.product_id,
                models.Product.branch_id == user.branch_id
            ).first()
            
            if not product:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Producto {item_in.product_id} no válido para esta sucursal"
                )
            
            if item_in.unit_cost <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"El costo unitario para el producto {item_in.product_id} debe ser mayor a cero"
                )

            total += item_in.unit_cost * item_in.quantity
            items.append(models.PurchaseOrderItem(
                product_id=item_in.product_id,
                quantity=item_in.quantity,
                unit_cost=item_in.unit_cost
            ))

        supplier_name = order_in.supplier
        if order_in.supplier_id:
            supplier_row = db.query(models.Supplier).filter(models.Supplier.id == order_in.supplier_id).first()
            if supplier_row:
                supplier_name = supplier_row.name

        db_order = models.PurchaseOrder(
            branch_id=user.branch_id,
            supplier_id=order_in.supplier_id,
            supplier=supplier_name,
            date=order_in.date,
            total=total,
            notes=order_in.notes,
            status=models.PurchaseOrderStatus.draft
        )
        db_order.items = items
        
        db.add(db_order)
        db.commit()
        db.refresh(db_order)
        
        audit_logger.log_action(
            actor_id=user.id,
            target_id=db_order.id,
            action="create_purchase_order",
            resource="orders",
            branch_id=user.branch_id,
            details={"total": total, "supplier": supplier_name, "status": db_order.status}
        )
        return db_order

    @staticmethod
    def submit_for_approval(db: Session, order_id: int, user: models.User) -> models.PurchaseOrder:
        """Pasa la orden de DRAFT a PENDING_APPROVAL."""
        order = PurchaseOrderService.get_order(db, order_id, user.branch_id, user.role)
        
        if order.status != models.PurchaseOrderStatus.draft:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Solo se pueden enviar para aprobación órdenes en estado draft. Estado actual: {order.status}"
            )
            
        order.status = models.PurchaseOrderStatus.pending_approval
        db.commit()
        db.refresh(order)
        
        audit_logger.log_action(
            actor_id=user.id,
            target_id=order.id,
            action="submit_purchase_order",
            resource="orders",
            branch_id=user.branch_id,
            details={"new_status": order.status}
        )
        return order

    @staticmethod
    def approve_order(db: Session, order_id: int, user: models.User) -> models.PurchaseOrder:
        """Aprueba la orden (Solo Admin+)."""
        if not has_role_access(user.role, "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo administradores pueden aprobar órdenes de compra"
            )
            
        order = PurchaseOrderService.get_order(db, order_id, user.branch_id, user.role)
        
        if order.status != models.PurchaseOrderStatus.pending_approval:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Solo se pueden aprobar órdenes en estado pending_approval. Estado actual: {order.status}"
            )
            
        order.status = models.PurchaseOrderStatus.approved
        order.approved_by_id = user.id
        order.approved_at = datetime.now()
        
        db.commit()
        db.refresh(order)
        
        audit_logger.log_action(
            actor_id=user.id,
            target_id=order.id,
            action="approve_purchase_order",
            resource="orders",
            branch_id=user.branch_id,
            details={"approved_by": user.username}
        )
        return order

    @staticmethod
    def reject_order(db: Session, order_id: int, notes: str, user: models.User) -> models.PurchaseOrder:
        """Rechaza la orden (Solo Admin+)."""
        if not has_role_access(user.role, "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo administradores pueden rechazar órdenes de compra"
            )
            
        order = PurchaseOrderService.get_order(db, order_id, user.branch_id, user.role)
        
        if order.status != models.PurchaseOrderStatus.pending_approval:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Solo se pueden rechazar órdenes en estado pending_approval. Estado actual: {order.status}"
            )
            
        order.status = models.PurchaseOrderStatus.rejected
        if notes:
            order.notes = (order.notes or "") + f"\nRechazo: {notes}"
            
        db.commit()
        db.refresh(order)
        
        audit_logger.log_action(
            actor_id=user.id,
            target_id=order.id,
            action="reject_purchase_order",
            resource="orders",
            branch_id=user.branch_id,
            details={"reason": notes}
        )
        return order

    @staticmethod
    def mark_as_ordered(db: Session, order_id: int, user: models.User) -> models.PurchaseOrder:
        """Marca la orden como enviada al proveedor."""
        order = PurchaseOrderService.get_order(db, order_id, user.branch_id, user.role)
        
        if order.status != models.PurchaseOrderStatus.approved:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Solo se pueden marcar como pedidas órdenes aprobadas. Estado actual: {order.status}"
            )
            
        order.status = models.PurchaseOrderStatus.ordered
        db.commit()
        db.refresh(order)
        
        audit_logger.log_action(
            actor_id=user.id,
            target_id=order.id,
            action="mark_as_ordered",
            resource="orders",
            branch_id=user.branch_id
        )
        return order

    @staticmethod
    def receive_items(db: Session, order_id: int, items_received: List[schemas.PurchaseOrderReceiptItem], user: models.User) -> models.PurchaseOrder:
        """
        Registra la recepción de mercancía (parcial o total).
        Usa locking y transaccionalidad.
        """
        # 1. Obtener orden con lock si es posible o simplemente en transacción
        order = PurchaseOrderService.get_order(db, order_id, user.branch_id, user.role)
        
        if order.status not in [models.PurchaseOrderStatus.ordered, models.PurchaseOrderStatus.partially_received]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No se puede recibir mercancía en estado {order.status}"
            )

        received_data = {item.product_id: item.quantity for item in items_received}
        
        for item in order.items:
            if item.product_id in received_data:
                qty_to_receive = received_data[item.product_id]
                
                if qty_to_receive <= 0:
                    continue
                    
                # Validación: No recibir más de lo pedido
                remaining = item.quantity - item.received_quantity
                if qty_to_receive > remaining:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"No se puede recibir más de lo pendiente para el producto {item.product_id}. Pendiente: {remaining}"
                    )

                # 2. Locking de producto para actualizar stock y costo
                product = db.query(models.Product).with_for_update().filter(
                    models.Product.id == item.product_id
                ).first()
                
                if product.branch_id != user.branch_id:
                     raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Conflicto de sucursal para el producto {product.id}"
                    )

                # Snapshot financiero previo
                prev_stock = product.stock
                prev_cost = product.cost_price
                reception_cost = item.unit_cost
                
                # --- Motor Financiero: Costo Promedio Ponderado (WAC) ---
                # Formula: ((StockActual * CostoActual) + (CantRecibida * CostoRecepción)) / (StockActual + CantRecibida)
                if prev_stock <= 0:
                    # Si no hay stock previo o es negativo (ajuste), el costo nuevo es el de la recepción
                    new_cost = reception_cost
                else:
                    total_value_before = prev_stock * prev_cost
                    reception_value = qty_to_receive * reception_cost
                    new_total_qty = prev_stock + qty_to_receive
                    new_cost = (total_value_before + reception_value) / new_total_qty
                
                # Round to 2 decimals for financial consistency if needed, but keeping precision is usually better
                # new_cost = round(new_cost, 2)
                
                # Actualizar Producto
                product.stock += qty_to_receive
                product.cost_price = new_cost
                
                # Actualizar Item de la Orden
                item.received_quantity += qty_to_receive
                
                # 3. Registrar InventoryMovement (Ledger Integrity)
                movement = models.InventoryMovement(
                    product_id=product.id,
                    branch_id=user.branch_id,
                    user_id=user.id,
                    movement_type=models.MovementType.purchase,
                    quantity=qty_to_receive,
                    previous_stock=prev_stock,
                    new_stock=product.stock,
                    previous_cost=prev_cost,
                    new_cost=new_cost,
                    unit_cost=reception_cost,
                    reference_type="purchase_order",
                    reference_id=str(order.id)
                )
                db.add(movement)

        # 4. Actualizar estado de la orden
        all_received = all(item.received_quantity >= item.quantity for item in order.items)
        if all_received:
            order.status = models.PurchaseOrderStatus.received
        else:
            order.status = models.PurchaseOrderStatus.partially_received
            
        db.commit()
        db.refresh(order)
        
        audit_logger.log_action(
            actor_id=user.id,
            target_id=order.id,
            action="receive_purchase_order_items",
            resource="orders",
            branch_id=user.branch_id,
            details={"new_status": order.status, "items_received": received_data}
        )
        return order

    @staticmethod
    def cancel_order(db: Session, order_id: int, user: models.User) -> models.PurchaseOrder:
        """Cancela la orden."""
        order = PurchaseOrderService.get_order(db, order_id, user.branch_id, user.role)
        
        # Reglas de cancelación
        if order.status in [models.PurchaseOrderStatus.received, models.PurchaseOrderStatus.cancelled]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No se puede cancelar una orden en estado {order.status}"
            )
            
        # Si ya se recibió algo, no se puede cancelar simplemente (requiere nota de crédito o ajuste manual)
        if order.status == models.PurchaseOrderStatus.partially_received:
             raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede cancelar una orden con recepciones parciales. Use devoluciones."
            )

        order.status = models.PurchaseOrderStatus.cancelled
        db.commit()
        db.refresh(order)
        
        audit_logger.log_action(
            actor_id=user.id,
            target_id=order.id,
            action="cancel_purchase_order",
            resource="orders",
            branch_id=user.branch_id
        )
        return order
