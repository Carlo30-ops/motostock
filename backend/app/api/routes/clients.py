from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import schemas, models
from app.database import get_db

router = APIRouter()


@router.get("/", response_model=list[schemas.ClientOut])
def get_clients(db: Session = Depends(get_db), skip: int = 0, limit: int = 100):
    return db.query(models.Client).offset(skip).limit(limit).all()


@router.post("/", response_model=schemas.ClientOut, status_code=status.HTTP_201_CREATED)
def create_client(client: schemas.ClientCreate, db: Session = Depends(get_db)):
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
        
    # Update balance
    client.credit_balance += adjustment.amount
    
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
