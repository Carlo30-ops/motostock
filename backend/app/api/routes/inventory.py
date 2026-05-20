from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import schemas, models
from app.database import get_db

router = APIRouter()


@router.get("/", response_model=list[schemas.ProductOut])
def get_products(db: Session = Depends(get_db), skip: int = 0, limit: int = 100):
    return db.query(models.Product).offset(skip).limit(limit).all()


@router.post("/", response_model=schemas.ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(product: schemas.ProductCreate, db: Session = Depends(get_db)):
    db_product = db.query(models.Product).filter(models.Product.code == product.code).first()
    if db_product:
        raise HTTPException(status_code=400, detail="Product code already exists")
    
    db_product = models.Product(**product.model_dump())
    db.add(db_product)
    db.flush()
    if not db_product.barcode:
        db_product.barcode = _generate_ean13_from_id(db_product.id)
    
    db.commit()
    db.refresh(db_product)
    return db_product


@router.put("/{product_id}", response_model=schemas.ProductOut)
def update_product(product_id: int, product: schemas.ProductUpdate, db: Session = Depends(get_db)):
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = product.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_product, key, value)
        
    db.commit()
    db.refresh(db_product)
    return db_product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    db.delete(db_product)
    db.commit()


import io
from fastapi.responses import Response
import barcode
from barcode.writer import ImageWriter
import random

def _generate_ean13_from_id(product_id: int) -> str:
    # EAN-13 expects 12 digits (the 13th is a checksum calculated automatically)
    # We prefix with "200" (in-store item prefix) and pad the product_id to 9 digits
    base = f"200{str(product_id).zfill(9)}"
    # EAN13 class calculates the checksum automatically
    ean = barcode.get('ean13', base, writer=ImageWriter())
    return ean.get_fullcode()

@router.post("/{product_id}/generate-barcode", response_model=schemas.ProductOut)
def generate_barcode(product_id: int, db: Session = Depends(get_db)):
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    if db_product.barcode:
        return db_product # Already has one

    db_product.barcode = _generate_ean13_from_id(product_id)
    db.commit()
    db.refresh(db_product)
    return db_product

@router.get("/{product_id}/barcode-image")
def get_barcode_image(product_id: int, db: Session = Depends(get_db)):
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product or not db_product.barcode:
        raise HTTPException(status_code=404, detail="Barcode not found")
        
    ean = barcode.get('ean13', db_product.barcode[:12], writer=ImageWriter())
    buffer = io.BytesIO()
    ean.write(buffer)
    return Response(content=buffer.getvalue(), media_type="image/png")

@router.post("/bulk-generate-barcodes", response_model=list[schemas.ProductOut])
def bulk_generate_barcodes(db: Session = Depends(get_db)):
    products_without_barcode = db.query(models.Product).filter(models.Product.barcode == None).all()
    
    for p in products_without_barcode:
        p.barcode = _generate_ean13_from_id(p.id)
        
    db.commit()
    return products_without_barcode

