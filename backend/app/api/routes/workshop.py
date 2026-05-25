from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.database import get_db
from app.services.auth import require_minimum_role, get_current_active_user

router = APIRouter(dependencies=[Depends(require_minimum_role("cashier"))])


def _work_order_out(order: models.WorkOrder) -> schemas.WorkOrderOut:
    return schemas.WorkOrderOut(
        id=order.id,
        branch_id=order.branch_id,
        vehicle_id=order.vehicle_id,
        status=order.status.value if hasattr(order.status, "value") else str(order.status),
        scheduled_date=order.scheduled_date,
        notes=order.notes,
        service_ids=[link.service_template_id for link in order.services],
        created_at=order.created_at,
        updated_at=order.updated_at,
    )


@router.get("/service-templates", response_model=list[schemas.ServiceTemplateOut])
def list_service_templates(db: Session = Depends(get_db)):
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
    query = db.query(models.Vehicle).filter(models.Vehicle.branch_id == current_user.branch_id)
    if client_id is not None:
        query = query.filter(models.Vehicle.client_id == client_id)
    return query.order_by(models.Vehicle.plate).all()


@router.post("/vehicles", response_model=schemas.VehicleOut, status_code=status.HTTP_201_CREATED)
def create_vehicle(
    payload: schemas.VehicleCreate, 
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    db: Session = Depends(get_db)
):
    client = db.query(models.Client).filter(models.Client.id == payload.client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    db_vehicle = models.Vehicle(**payload.model_dump(), branch_id=current_user.branch_id)
    db.add(db_vehicle)
    db.commit()
    db.refresh(db_vehicle)
    return db_vehicle


@router.put("/vehicles/{vehicle_id}", response_model=schemas.VehicleOut)
def update_vehicle(
    vehicle_id: int,
    payload: schemas.VehicleUpdate,
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    db: Session = Depends(get_db),
):
    db_vehicle = db.query(models.Vehicle).filter(
        models.Vehicle.id == vehicle_id,
        models.Vehicle.branch_id == current_user.branch_id
    ).first()
    if not db_vehicle:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(db_vehicle, key, value)
    db.commit()
    db.refresh(db_vehicle)
    return db_vehicle


@router.get("/work-orders", response_model=list[schemas.WorkOrderOut])
def list_work_orders(
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    db: Session = Depends(get_db)
):
    orders = (
        db.query(models.WorkOrder)
        .filter(models.WorkOrder.branch_id == current_user.branch_id)
        .options(joinedload(models.WorkOrder.services))
        .order_by(models.WorkOrder.scheduled_date.desc())
        .all()
    )
    return [_work_order_out(o) for o in orders]


@router.post("/work-orders", response_model=schemas.WorkOrderOut, status_code=status.HTTP_201_CREATED)
def create_work_order(
    payload: schemas.WorkOrderCreate, 
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    db: Session = Depends(get_db)
):
    vehicle = db.query(models.Vehicle).filter(
        models.Vehicle.id == payload.vehicle_id,
        models.Vehicle.branch_id == current_user.branch_id
    ).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")

    db_order = models.WorkOrder(
        branch_id=current_user.branch_id,
        vehicle_id=payload.vehicle_id,
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
    db_order = (
        db.query(models.WorkOrder)
        .options(joinedload(models.WorkOrder.services))
        .filter(models.WorkOrder.id == db_order.id)
        .first()
    )
    return _work_order_out(db_order)


@router.patch("/work-orders/{order_id}/status", response_model=schemas.WorkOrderOut)
def update_work_order_status(
    order_id: int,
    payload: schemas.WorkOrderStatusUpdate,
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    db: Session = Depends(get_db),
):
    db_order = (
        db.query(models.WorkOrder)
        .options(joinedload(models.WorkOrder.services))
        .filter(
            models.WorkOrder.id == order_id,
            models.WorkOrder.branch_id == current_user.branch_id
        )
        .first()
    )
    if not db_order:
        raise HTTPException(status_code=404, detail="Orden de trabajo no encontrada")

    allowed = {s.value for s in models.WorkOrderStatus}
    if payload.status not in allowed:
        raise HTTPException(status_code=400, detail="Estado inválido")

    db_order.status = models.WorkOrderStatus(payload.status)
    db.commit()
    db.refresh(db_order)
    return _work_order_out(db_order)
