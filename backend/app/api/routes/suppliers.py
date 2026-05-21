from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.services.auth import require_minimum_role

router = APIRouter(dependencies=[Depends(require_minimum_role("supervisor"))])


@router.get("/", response_model=list[schemas.SupplierOut])
def list_suppliers(db: Session = Depends(get_db), skip: int = 0, limit: int = 200):
    return db.query(models.Supplier).order_by(models.Supplier.name).offset(skip).limit(limit).all()


@router.post("/", response_model=schemas.SupplierOut, status_code=status.HTTP_201_CREATED)
def create_supplier(payload: schemas.SupplierCreate, db: Session = Depends(get_db)):
    db_supplier = models.Supplier(**payload.model_dump())
    db.add(db_supplier)
    db.commit()
    db.refresh(db_supplier)
    return db_supplier


@router.put("/{supplier_id}", response_model=schemas.SupplierOut)
def update_supplier(
    supplier_id: int,
    payload: schemas.SupplierUpdate,
    db: Session = Depends(get_db),
):
    db_supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
    if not db_supplier:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(db_supplier, key, value)
    db.commit()
    db.refresh(db_supplier)
    return db_supplier
