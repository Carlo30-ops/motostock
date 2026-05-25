# Fase 1.1: clientes y ledger de crédito requieren sesión autenticada (cashier+).
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import schemas, models
from app.database import get_db
from app.services.auth import require_minimum_role

router = APIRouter(dependencies=[Depends(require_minimum_role("cashier"))])


@router.get("/", response_model=list[schemas.ClientOut])
def get_clients(db: Session = Depends(get_db), skip: int = 0, limit: int = 100):
    return db.query(models.Client).offset(skip).limit(limit).all()


@router.post("/", response_model=schemas.ClientOut, status_code=status.HTTP_201_CREATED)
def create_client(client: schemas.ClientCreate, db: Session = Depends(get_db)):
    if client.credit_balance > client.credit_limit:
        raise HTTPException(status_code=400, detail="El cupo disponible no puede superar el cupo maximo")
    db_client = models.Client(**client.model_dump())
    db.add(db_client)
    db.commit()
    db.refresh(db_client)
    return db_client


@router.put("/{client_id}", response_model=schemas.ClientOut)
def update_client(client_id: int, client: schemas.ClientUpdate, db: Session = Depends(get_db)):
    db_client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not db_client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    update_data = client.model_dump(exclude_unset=True)
    next_credit_limit = update_data.get("credit_limit", db_client.credit_limit)
    next_credit_balance = update_data.get("credit_balance", db_client.credit_balance)
    if next_credit_balance > next_credit_limit:
        raise HTTPException(status_code=400, detail="El cupo disponible no puede superar el cupo maximo")
    for key, value in update_data.items():
        setattr(db_client, key, value)
        
    db.commit()
    db.refresh(db_client)
    return db_client


@router.get("/{client_id}/ledger", response_model=list[schemas.CreditLedgerOut])
def get_client_ledger(client_id: int, db: Session = Depends(get_db)):
    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return db.query(models.CreditLedger).filter(models.CreditLedger.client_id == client_id).all()


@router.post("/{client_id}/ledger", response_model=schemas.CreditLedgerOut)
def adjust_client_credit(client_id: int, adjustment: schemas.CreditAdjust, db: Session = Depends(get_db)):
    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    new_balance = round(client.credit_balance + adjustment.amount, 2)
    if new_balance < 0:
        raise HTTPException(
            status_code=400,
            detail="El cupo disponible no puede quedar negativo",
        )
    if new_balance > client.credit_limit:
        raise HTTPException(
            status_code=400,
            detail="El cupo disponible no puede superar el cupo maximo",
        )

    # credit_balance representa cupo disponible: positivo recarga, negativo descuenta.
    client.credit_balance = new_balance
    
    # Add ledger entry
    ledger_entry = models.CreditLedger(
        client_id=client_id,
        amount=adjustment.amount,
        description=adjustment.description
    )
    db.add(ledger_entry)
    db.commit()
    db.refresh(ledger_entry)
    return ledger_entry
