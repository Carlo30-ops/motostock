from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import schemas, models
from app.database import get_db
from app.services.auth import (
    require_role, 
    get_current_active_user, 
    has_role_access
)
from app.logging_config import audit_logger

# Acceso mínimo supervisor o accountant
router = APIRouter(dependencies=[Depends(require_role("accountant"))])


@router.get("/sales", response_model=schemas.SalesReport)
def get_sales_report(
    date_from: date, 
    date_to: date, 
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    db: Session = Depends(get_db)
):
    """
    Reporte de ventas.
    Filtrado por branch_id para roles < admin.
    """
    if current_user.role in ["cashier", "mechanic"]:
        raise HTTPException(status_code=403, detail="No tiene permiso para ver reportes")

    query = db.query(models.Sale).filter(
        models.Sale.date >= date_from,
        models.Sale.date <= date_to
    )
    
    if not has_role_access(current_user.role, "admin"):
        query = query.filter(models.Sale.branch_id == current_user.branch_id)
        
    sales = query.all()
    
    total_revenue = sum(sale.total for sale in sales)
    total_transactions = len(sales)
    average_ticket = total_revenue / total_transactions if total_transactions > 0 else 0
    
    # Calculate costs and profits
    total_cost = 0
    product_stats = {}
    
    for sale in sales:
        for item in sale.items:
            # Asegurar que consultamos productos de la misma sucursal si no somos admin
            p_query = db.query(models.Product).filter(models.Product.id == item.product_id)
            if not has_role_access(current_user.role, "admin"):
                p_query = p_query.filter(models.Product.branch_id == current_user.branch_id)
            
            product = p_query.first()
            if product:
                cost = product.cost_price * item.quantity
                revenue = item.unit_price * item.quantity
                profit = revenue - cost
                
                total_cost += cost
                
                if product.id not in product_stats:
                    product_stats[product.id] = {
                        "product_id": product.id,
                        "product_name": product.name,
                        "category": product.category,
                        "quantity_sold": 0,
                        "revenue": 0.0,
                        "cost": 0.0,
                        "profit": 0.0
                    }
                
                stats = product_stats[product.id]
                stats["quantity_sold"] += item.quantity
                stats["revenue"] += revenue
                stats["cost"] += cost
                stats["profit"] += profit

    total_profit = total_revenue - total_cost
    
    rows = [schemas.SalesReportRow(**stat) for stat in product_stats.values()]
    rows.sort(key=lambda x: x.revenue, reverse=True)

    audit_logger.log_action(
        actor_id=current_user.id,
        target_id=None,
        action="view_sales_report",
        resource="reports",
        branch_id=current_user.branch_id,
        details={"date_from": str(date_from), "date_to": str(date_to)}
    )

    return schemas.SalesReport(
        date_from=date_from,
        date_to=date_to,
        total_revenue=total_revenue,
        total_cost=total_cost,
        total_profit=total_profit,
        total_transactions=total_transactions,
        average_ticket=average_ticket,
        rows=rows
    )


@router.get("/inventory", response_model=schemas.InventoryReport)
def get_inventory_report(
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    db: Session = Depends(get_db)
):
    """
    Reporte de inventario.
    Filtrado por branch_id para roles < admin.
    """
    if current_user.role in ["cashier", "mechanic"]:
        raise HTTPException(status_code=403, detail="No tiene permiso para ver reportes")

    query = db.query(models.Product)
    if not has_role_access(current_user.role, "admin"):
        query = query.filter(models.Product.branch_id == current_user.branch_id)
        
    products = query.all()
    
    total_products = len(products)
    total_units = sum(p.stock for p in products)
    total_stock_value = sum(p.stock * p.cost_price for p in products)
    
    rows = []
    for p in products:
        status_label = "Good"
        if p.stock == 0:
            status_label = "Out of Stock"
        elif p.stock <= p.reorder_threshold:
            status_label = "Low Stock"
            
        rows.append(schemas.InventoryReportRow(
            product_id=p.id,
            product_name=p.name,
            category=p.category,
            brand=p.brand,
            stock=p.stock,
            cost_price=p.cost_price,
            stock_value=p.stock * p.cost_price,
            status=status_label
        ))
    
    audit_logger.log_action(
        actor_id=current_user.id,
        target_id=None,
        action="view_inventory_report",
        resource="reports",
        branch_id=current_user.branch_id
    )
        
    return schemas.InventoryReport(
        total_products=total_products,
        total_units=total_units,
        total_stock_value=total_stock_value,
        rows=rows
    )
