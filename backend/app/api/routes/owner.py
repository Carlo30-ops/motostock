from datetime import date, datetime, timedelta
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, and_, or_
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.database import get_db
from app.services.auth import owner_required
from app.schemas.owner import (
    OwnerDashboardSummary, 
    FinancialAuditLogOut, 
    ProfitabilityReport, 
    ProfitabilityReportRow,
    InventoryMovementAuditOut,
    AnomalyAlert,
    SaleAuditOut
)

router = APIRouter(
    dependencies=[Depends(owner_required)],
    include_in_schema=False
)

@router.get("/dashboard", response_model=OwnerDashboardSummary)
def get_owner_dashboard(
    response: Response,
    db: Session = Depends(get_db)
):
    response.headers["Cache-Control"] = "no-store"
    
    today = date.today()
    yesterday = today - timedelta(days=1)
    month_start = today.replace(day=1)
    
    # Today's sales (including deleted/cancelled for audit)
    today_sales = db.query(models.Sale).filter(models.Sale.date == today).all()
    today_total = sum(s.total for s in today_sales)
    today_count = len(today_sales)
    
    # Yesterday's sales
    yesterday_sales = db.query(models.Sale).filter(models.Sale.date == yesterday).all()
    yesterday_total = sum(s.total for s in yesterday_sales)
    
    # Variation
    variation = 0.0
    if yesterday_total > 0:
        variation = ((today_total - yesterday_total) / yesterday_total) * 100
    
    # Gross Profit Month (Optimized)
    month_profit = db.query(
        func.sum((models.SaleItem.unit_price - models.Product.cost_price) * models.SaleItem.quantity)
    ).join(models.Sale).join(models.Product).filter(
        models.Sale.date >= month_start
    ).scalar() or 0.0
    
    today_profit = db.query(
        func.sum((models.SaleItem.unit_price - models.Product.cost_price) * models.SaleItem.quantity)
    ).join(models.Sale).join(models.Product).filter(
        models.Sale.date == today
    ).scalar() or 0.0
    
    # Expenses (Purchase orders received today)
    today_expenses = db.query(func.sum(models.PurchaseOrder.total)).filter(
        models.PurchaseOrder.status == models.PurchaseOrderStatus.received,
        func.date(models.PurchaseOrder.updated_at) == today
    ).scalar() or 0.0
    
    # Low stock
    low_stock = db.query(models.Product).filter(
        models.Product.stock <= models.Product.reorder_threshold
    ).all()
    low_stock_list = [
        {"id": p.id, "name": p.name, "stock": p.stock, "cost": p.cost_price} 
        for p in low_stock
    ]
    
    # Manual adjustments
    manual_adjustments = db.query(models.InventoryMovement).filter(
        models.InventoryMovement.movement_type == models.MovementType.adjustment,
        func.date(models.InventoryMovement.created_at) == today
    ).count()
    
    # Top Cashiers
    top_cashiers_query = db.query(
        models.User.username,
        func.sum(models.Sale.total).label("total_sales")
    ).join(models.Sale, models.User.id == models.Sale.cashier_id).filter(
        models.Sale.date == today
    ).group_by(models.User.username).order_by(func.sum(models.Sale.total).desc()).limit(5).all()
    
    top_cashiers = [{"username": r[0], "total": r[1]} for r in top_cashiers_query]

    # Suspicious discounts (> 20%)
    suspicious_discounts = db.query(models.Sale).filter(
        models.Sale.date == today,
        models.Sale.discount_pct > 20
    ).count()

    # Cancelled sales (soft deleted)
    cancelled_sales = 0
    if hasattr(models.Sale, "deleted_at"):
         # In a real scenario we'd need to bypass the soft delete filter if one was active
         cancelled_sales = db.query(models.Sale).filter(
             func.date(models.Sale.deleted_at) == today
         ).execution_options(include_deleted=True).count()

    return OwnerDashboardSummary(
        today_sales_count=today_count,
        today_total_amount=today_total,
        today_estimated_gross_profit=today_profit,
        today_expenses=today_expenses,
        yesterday_total_amount=yesterday_total,
        variation_percentage=variation,
        low_stock_products=low_stock_list,
        manual_adjustments_count=manual_adjustments,
        cancelled_sales_count=cancelled_sales,
        top_cashiers=top_cashiers,
        suspicious_discounts_count=suspicious_discounts,
        total_gross_profit_month=month_profit
    )

@router.get("/anomalies", response_model=List[AnomalyAlert])
def get_anomalies(
    response: Response,
    db: Session = Depends(get_db)
):
    response.headers["Cache-Control"] = "no-store"
    anomalies = []
    today = date.today()
    
    # 1. High Discounts
    high_discounts = db.query(models.Sale).filter(
        models.Sale.date == today,
        models.Sale.discount_pct >= 30
    ).all()
    for sale in high_discounts:
        anomalies.append(AnomalyAlert(
            type="high_discount",
            severity="high",
            description=f"Venta #{sale.id} con {sale.discount_pct}% de descuento",
            resource_id=str(sale.id),
            user_id=sale.cashier_id,
            username=sale.cashier.username if sale.cashier else "Unknown",
            timestamp=sale.created_at,
            data={"discount": sale.discount_pct, "total": sale.total}
        ))
        
    # 2. Large Inventory Adjustments
    large_adjustments = db.query(models.InventoryMovement).filter(
        models.InventoryMovement.movement_type == models.MovementType.adjustment,
        func.date(models.InventoryMovement.created_at) == today,
        or_(models.InventoryMovement.quantity > 50, models.InventoryMovement.quantity < -50)
    ).all()
    for mov in large_adjustments:
        anomalies.append(AnomalyAlert(
            type="large_adjustment",
            severity="medium",
            description=f"Ajuste manual de {mov.quantity} unidades en {mov.product.name}",
            resource_id=str(mov.id),
            user_id=mov.user_id,
            username=mov.user.username if mov.user else "Unknown",
            timestamp=mov.created_at,
            data={"quantity": mov.quantity, "product": mov.product.name}
        ))
        
    # 3. Sales below cost
    below_cost = db.query(models.SaleItem).join(models.Sale).join(models.Product).filter(
        models.Sale.date == today,
        models.SaleItem.unit_price < models.Product.cost_price
    ).all()
    for item in below_cost:
        anomalies.append(AnomalyAlert(
            type="below_cost",
            severity="high",
            description=f"Producto {item.product.name} vendido por debajo del costo en venta #{item.sale_id}",
            resource_id=str(item.sale_id),
            timestamp=item.sale.created_at,
            data={"price": item.unit_price, "cost": item.product.cost_price}
        ))

    # 4. Multiple cancellations by user on the same day
    cancellations_today = db.query(
        models.Sale.cashier_id,
        func.count(models.Sale.id).label("cancel_count")
    ).filter(
        models.Sale.deleted_at != None,
        func.date(models.Sale.deleted_at) == today
    ).group_by(
        models.Sale.cashier_id
    ).all()
    
    for cashier_id, count in cancellations_today:
        if count >= 3 and cashier_id is not None:
            cashier_user = db.query(models.User).filter(models.User.id == cashier_id).first()
            # Find the latest cancelled sale for timestamp
            latest_cancel = db.query(models.Sale).filter(
                models.Sale.cashier_id == cashier_id,
                models.Sale.deleted_at != None,
                func.date(models.Sale.deleted_at) == today
            ).order_by(models.Sale.deleted_at.desc()).first()
            
            anomalies.append(AnomalyAlert(
                type="multiple_cancellations",
                severity="high",
                description=f"El cajero {cashier_user.username if cashier_user else 'Unknown'} ha realizado {count} cancelaciones de ventas hoy",
                resource_id=str(cashier_id),
                user_id=cashier_id,
                username=cashier_user.username if cashier_user else "Unknown",
                timestamp=latest_cancel.deleted_at if latest_cancel else datetime.now(),
                data={"cancel_count": count}
            ))

    return sorted(anomalies, key=lambda x: x.timestamp, reverse=True)

@router.get("/financial-audit", response_model=List[FinancialAuditLogOut])
def get_financial_audit(
    response: Response,
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    user_id: Optional[int] = None,
    event_type: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    response.headers["Cache-Control"] = "no-store"
    
    query = db.query(models.FinancialAuditLog)
    
    if from_date:
        query = query.filter(func.date(models.FinancialAuditLog.created_at) >= from_date)
    if to_date:
        query = query.filter(func.date(models.FinancialAuditLog.created_at) <= to_date)
    if user_id:
        query = query.filter(models.FinancialAuditLog.user_id == user_id)
    if event_type:
        query = query.filter(models.FinancialAuditLog.event_type == event_type)
        
    offset = (page - 1) * limit
    results = query.order_by(models.FinancialAuditLog.created_at.desc()).offset(offset).limit(limit).all()
    
    # Add username to results
    output = []
    for log in results:
        log_out = FinancialAuditLogOut.model_validate(log)
        log_out.username = log.user.username if log.user else "Unknown"
        output.append(log_out)
        
    return output

@router.get("/sales-history", response_model=List[SaleAuditOut])
def get_sales_history(
    response: Response,
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    cashier_id: Optional[int] = None,
    payment_method: Optional[models.PaymentMethod] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    response.headers["Cache-Control"] = "no-store"
    
    query = db.query(models.Sale).options(
        joinedload(models.Sale.cashier)
    ).execution_options(include_deleted=True)

    if from_date:
        query = query.filter(models.Sale.date >= from_date)
    if to_date:
        query = query.filter(models.Sale.date <= to_date)
    if cashier_id:
        query = query.filter(models.Sale.cashier_id == cashier_id)
    if payment_method:
        query = query.filter(models.Sale.payment_method == payment_method)
        
    offset = (page - 1) * limit
    results = query.order_by(models.Sale.created_at.desc()).offset(offset).limit(limit).all()
    
    for sale in results:
        sale.cashier_username = sale.cashier.username if sale.cashier else "Unknown"
        
    return results

@router.get("/inventory-movements", response_model=List[InventoryMovementAuditOut])
def get_inventory_movements(
    response: Response,
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    product_id: Optional[int] = None,
    user_id: Optional[int] = None,
    movement_type: Optional[models.MovementType] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    response.headers["Cache-Control"] = "no-store"
    
    query = db.query(models.InventoryMovement).options(
        joinedload(models.InventoryMovement.product),
        joinedload(models.InventoryMovement.user),
        joinedload(models.InventoryMovement.branch)
    )
    
    if from_date:
        query = query.filter(func.date(models.InventoryMovement.created_at) >= from_date)
    if to_date:
        query = query.filter(func.date(models.InventoryMovement.created_at) <= to_date)
    if product_id:
        query = query.filter(models.InventoryMovement.product_id == product_id)
    if user_id:
        query = query.filter(models.InventoryMovement.user_id == user_id)
    if movement_type:
        query = query.filter(models.InventoryMovement.movement_type == movement_type)
        
    offset = (page - 1) * limit
    results = query.order_by(models.InventoryMovement.created_at.desc()).offset(offset).limit(limit).all()
    
    output = []
    for mov in results:
        mov_out = InventoryMovementAuditOut.model_validate(mov)
        mov_out.product_name = mov.product.name if mov.product else "Unknown"
        mov_out.username = mov.user.username if mov.user else "Unknown"
        mov_out.branch_name = mov.branch.name if mov.branch else "Unknown"
        output.append(mov_out)
        
    return output

@router.get("/profitability", response_model=ProfitabilityReport)
def get_profitability(
    response: Response,
    period: str = "daily",
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    db: Session = Depends(get_db)
):
    response.headers["Cache-Control"] = "no-store"
    
    if not from_date:
        if period == "daily":
            from_date = date.today()
        elif period == "weekly":
            from_date = date.today() - timedelta(days=7)
        elif period == "monthly":
            from_date = date.today() - timedelta(days=30)
        else:
            from_date = date.today()
            
    if not to_date:
        to_date = date.today()

    results = db.query(
        models.Product.id.label("product_id"),
        models.Product.name.label("product_name"),
        func.sum(models.SaleItem.quantity).label("quantity_sold"),
        func.sum(models.SaleItem.unit_price * models.SaleItem.quantity).label("total_revenue"),
        func.sum(models.Product.cost_price * models.SaleItem.quantity).label("total_cost"),
        func.sum((models.SaleItem.unit_price - models.Product.cost_price) * models.SaleItem.quantity).label("net_profit")
    ).join(
        models.SaleItem, models.Product.id == models.SaleItem.product_id
    ).join(
        models.Sale, models.Sale.id == models.SaleItem.sale_id
    ).filter(
        models.Sale.date >= from_date,
        models.Sale.date <= to_date,
        models.Sale.deleted_at == None
    ).group_by(
        models.Product.id, models.Product.name
    ).all()

    rows = [ProfitabilityReportRow(
        product_id=r.product_id,
        product_name=r.product_name,
        quantity_sold=r.quantity_sold,
        total_revenue=r.total_revenue,
        total_cost=r.total_cost,
        net_profit=r.net_profit
    ) for r in results]
    
    return ProfitabilityReport(
        period=period,
        date_from=from_date,
        date_to=to_date,
        rows=rows
    )
