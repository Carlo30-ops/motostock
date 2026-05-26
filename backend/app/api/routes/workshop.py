from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.database import get_db
from app.services.auth import (
    require_role, 
    get_current_active_user, 
    has_role_access,
    require_cashier
)
from app.logging_config import audit_logger

# Acceso base: mechanic+
router = APIRouter(dependencies=[Depends(require_role("mechanic"))])


def _work_order_out(order: models.WorkOrder) -> schemas.WorkOrderOut:
    return schemas.WorkOrderOut(
        id=order.id,
        branch_id=order.branch_id,
        vehicle_id=order.vehicle_id,
        mechanic_id=order.mechanic_id,
        status=order.status.value if hasattr(order.status, "value") else str(order.status),
        scheduled_date=order.scheduled_date,
        notes=order.notes,
        service_ids=[link.service_template_id for link in order.services],
        created_at=order.created_at,
        updated_at=order.updated_at,
    )


@router.get("/service-templates", response_model=list[schemas.ServiceTemplateOut])
def list_service_templates(db: Session = Depends(get_db)):
    """Mecánicos y superiores pueden ver servicios."""
    return (
        db.query(models.ServiceTemplate)
        .filter(models.ServiceTemplate.is_active.is_(True))
        .order_by(models.ServiceTemplate.name)
        .all()
    )


@router.get("/vehicles", response_model=list[schemas.VehicleOut])
def list_vehicles(
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    db: Session = Depends(get_db), 
    client_id: int | None = None
):
    """Listar vehículos filtrados por sucursal."""
    query = db.query(models.Vehicle)
    
    if not has_role_access(current_user.role, "admin"):
        query = query.filter(models.Vehicle.branch_id == current_user.branch_id)
        
    if client_id is not None:
        query = query.filter(models.Vehicle.client_id == client_id)
        
    return query.order_by(models.Vehicle.plate).all()


@router.post("/vehicles", response_model=schemas.VehicleOut, status_code=status.HTTP_201_CREATED)
def create_vehicle(
    payload: schemas.VehicleCreate, 
    current_user: Annotated[models.User, Depends(require_cashier)],
    db: Session = Depends(get_db)
):
    """Solo Cajero+ puede registrar vehículos."""
    client = db.query(models.Client).filter(models.Client.id == payload.client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
        
    db_vehicle = models.Vehicle(**payload.model_dump(), branch_id=current_user.branch_id)
    db.add(db_vehicle)
    db.commit()
    db.refresh(db_vehicle)
    
    audit_logger.log_action(
        actor_id=current_user.id,
        target_id=db_vehicle.id,
        action="create_vehicle",
        resource="workshop",
        branch_id=current_user.branch_id
    )
    
    return db_vehicle


@router.put("/vehicles/{vehicle_id}", response_model=schemas.VehicleOut)
def update_vehicle(
    vehicle_id: int,
    payload: schemas.VehicleUpdate,
    current_user: Annotated[models.User, Depends(require_cashier)],
    db: Session = Depends(get_db),
):
    """Solo Cajero+ puede editar vehículos."""
    query = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id)
    if not has_role_access(current_user.role, "admin"):
        query = query.filter(models.Vehicle.branch_id == current_user.branch_id)
        
    db_vehicle = query.first()
    if not db_vehicle:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")
        
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(db_vehicle, key, value)
        
    db.commit()
    db.refresh(db_vehicle)
    
    audit_logger.log_action(
        actor_id=current_user.id,
        target_id=db_vehicle.id,
        action="update_vehicle",
        resource="workshop",
        branch_id=current_user.branch_id
    )
    
    return db_vehicle


@router.get("/work-orders", response_model=list[schemas.WorkOrderOut])
def list_work_orders(
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    db: Session = Depends(get_db)
):
    """
    Listar órdenes de trabajo.
    Mechanic: Solo las asignadas a él en su sucursal.
    Others: Todas las de su sucursal (Admin+ ve todas).
    """
    query = db.query(models.WorkOrder).options(joinedload(models.WorkOrder.services))
    
    if current_user.role == "mechanic":
        query = query.filter(
            models.WorkOrder.mechanic_id == current_user.id,
            models.WorkOrder.branch_id == current_user.branch_id
        )
    elif not has_role_access(current_user.role, "admin"):
        query = query.filter(models.WorkOrder.branch_id == current_user.branch_id)
        
    orders = query.order_by(models.WorkOrder.scheduled_date.desc()).all()
    return [_work_order_out(o) for o in orders]


@router.post("/work-orders", response_model=schemas.WorkOrderOut, status_code=status.HTTP_201_CREATED)
def create_work_order(
    payload: schemas.WorkOrderCreate, 
    current_user: Annotated[models.User, Depends(require_cashier)],
    db: Session = Depends(get_db)
):
    """Solo Cajero+ puede crear órdenes de trabajo."""
    vehicle = db.query(models.Vehicle).filter(
        models.Vehicle.id == payload.vehicle_id,
        models.Vehicle.branch_id == current_user.branch_id
    ).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado en esta sucursal")

    # Si se asigna un mecánico, debe existir y estar activo
    if payload.mechanic_id:
        mechanic = db.query(models.User).filter(
            models.User.id == payload.mechanic_id,
            models.User.role == "mechanic",
            models.User.is_active == True
        ).first()
        if not mechanic:
             raise HTTPException(status_code=400, detail="Mecánico inválido o inactivo")

    db_order = models.WorkOrder(
        branch_id=current_user.branch_id,
        vehicle_id=payload.vehicle_id,
        mechanic_id=payload.mechanic_id,
        scheduled_date=payload.scheduled_date,
        notes=payload.notes,
        status=models.WorkOrderStatus.scheduled,
    )
    db.add(db_order)
    db.flush()

    for service_id in payload.service_ids:
        template = (
            db.query(models.ServiceTemplate)
            .filter(models.ServiceTemplate.id == service_id)
            .first()
        )
        if not template:
            raise HTTPException(status_code=404, detail=f"Servicio {service_id} no encontrado")
        db.add(
            models.WorkOrderService(
                work_order_id=db_order.id,
                service_template_id=service_id,
            )
        )

    db.commit()
    db.refresh(db_order)
    
    audit_logger.log_action(
        actor_id=current_user.id,
        target_id=db_order.id,
        action="create_work_order",
        resource="workshop",
        branch_id=current_user.branch_id
    )
    
    return _work_order_out(db_order)


@router.patch("/work-orders/{order_id}/status", response_model=schemas.WorkOrderOut)
def update_work_order_status(
    order_id: int,
    payload: schemas.WorkOrderStatusUpdate,
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    db: Session = Depends(get_db),
):
    """
    Actualizar estado de orden de trabajo.
    Mechanic: Solo si es la suya.
    Supervisor+: Cualquier orden de su sucursal.
    """
    query = db.query(models.WorkOrder).options(joinedload(models.WorkOrder.services)).filter(
        models.WorkOrder.id == order_id
    )
    
    if current_user.role == "mechanic":
        query = query.filter(models.WorkOrder.mechanic_id == current_user.id)
    elif not has_role_access(current_user.role, "admin"):
        query = query.filter(models.WorkOrder.branch_id == current_user.branch_id)
        
    db_order = query.first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Orden de trabajo no encontrada o no asignada")

    allowed = {s.value for s in models.WorkOrderStatus}
    if payload.status not in allowed:
        raise HTTPException(status_code=400, detail="Estado inválido")

    old_status = db_order.status
    db_order.status = models.WorkOrderStatus(payload.status)
    db.commit()
    db.refresh(db_order)
    
    audit_logger.log_action(
        actor_id=current_user.id,
        target_id=db_order.id,
        action="update_work_order_status",
        resource="workshop",
        branch_id=current_user.branch_id,
        details={"old_status": str(old_status), "new_status": payload.status}
    )
    
    return _work_order_out(db_order)
