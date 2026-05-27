from sqlalchemy.orm import Session
from app import models, schemas
from app.exceptions.handlers import ResourceNotFoundException
from typing import Optional

class InventoryService:
    @staticmethod
    def get_products(db: Session, branch_id: int, include_deleted: bool = False):
        query = db.query(models.Product).filter(models.Product.branch_id == branch_id)
        if not include_deleted:
            query = query.filter(models.Product.deleted_at == None)
        return query.all()

    @staticmethod
    def get_product(db: Session, product_id: int, branch_id: Optional[int] = None) -> models.Product:
        query = db.query(models.Product).filter(models.Product.id == product_id)
        if branch_id:
            query = query.filter(models.Product.branch_id == branch_id)
        
        product = query.first()
        if not product or product.deleted_at:
            raise ResourceNotFoundException("Product", product_id)
        return product

    @staticmethod
    def soft_delete_product(db: Session, product_id: int, branch_id: Optional[int] = None):
        product = InventoryService.get_product(db, product_id, branch_id)
        product.delete()
        db.commit()
        return product
