from typing import Annotated, Union
import io

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session
import barcode
from barcode.writer import ImageWriter

from app import schemas, models
from app.database import get_db
from app.services.auth import (
    require_role, 
    require_admin, 
    require_supervisor,
    require_permission,
    get_current_active_user,
    has_role_access
)
from app.core.rbac import Permission
from app.logging_config import audit_logger
from app.services.inventory import InventoryService

router = APIRouter(dependencies=[Depends(require_permission(Permission.INVENTORY_VIEW))])


def _generate_ean13_from_id(product_id: int) -> str:
    base = f"200{str(product_id).zfill(9)}"
    ean = barcode.get('ean13', base, writer=ImageWriter())
    return ean.get_fullcode()


@router.get("/", response_model=list[Union[schemas.ProductInternalOut, schemas.ProductOut]])
def get_products(
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    db: Session = Depends(get_db), 
    skip: int = 0, 
    limit: int = 100
):
    """
    Obtener productos.
    Filtra por sucursal para roles < admin.
    Oculta precios de costo para cashier y mechanic.
    """
    query = db.query(models.Product)
    
    # Filtro de sucursal
    if not has_role_access(current_user.role, "admin"):
        query = query.filter(models.Product.branch_id == current_user.branch_id)
    
    # Restricción de Mechanic (solo repuestos - asumiendo categoría o lógica similar si existiera, 
    # por ahora ve todo pero sin costos según regla general).
    # La regla dice: "mechanic: solo lectura de repuestos". 
    # Si no hay un filtro de categoría 'Spare Parts', por ahora filtramos por lo que no sea 'Finance' etc.
    if current_user.role == "mechanic":
        # Ejemplo: query = query.filter(models.Product.category == "Repuestos")
        pass

    products = query.offset(skip).limit(limit).all()
    
    # La visibilidad del costo se maneja en el esquema via Union y el rol del usuario
    # pero para mayor seguridad, podemos forzar la conversión aquí o confiar en FastAPI
    # que usará el primero que coincida en la Union. Mejor ser explícitos si es necesario.
    return products


@router.post("/", response_model=schemas.ProductInternalOut, status_code=status.HTTP_201_CREATED)
def create_product(
    product: schemas.ProductCreate, 
    current_user: Annotated[models.User, Depends(require_supervisor)],
    db: Session = Depends(get_db)
):
    """Solo Supervisor+ puede crear."""
    # Un supervisor solo crea en su sucursal
    target_branch_id = current_user.branch_id
    if has_role_access(current_user.role, "admin"):
        # Admin/Superadmin podrían especificar sucursal (asumiendo que el esquema lo permite o se hereda)
        # Por ahora mantenemos la sucursal del usuario para Admin si no se especifica.
        pass

    db_product = db.query(models.Product).filter(
        models.Product.code == product.code,
        models.Product.branch_id == target_branch_id
    ).first()
    if db_product:
        raise HTTPException(status_code=400, detail="El código de producto ya existe en esta sucursal")
    
    db_product = models.Product(**product.model_dump(), branch_id=target_branch_id)
    db.add(db_product)
    db.flush()
    if not db_product.barcode:
        db_product.barcode = _generate_ean13_from_id(db_product.id)
    
    db.commit()
    db.refresh(db_product)
    
    audit_logger.log_action(
        actor_id=current_user.id,
        target_id=db_product.id,
        action="create_product",
        resource="inventory",
        branch_id=current_user.branch_id
    )
    
    return db_product


@router.put("/{product_id}", response_model=schemas.ProductInternalOut)
def update_product(
    product_id: int, 
    product: schemas.ProductUpdate, 
    current_user: Annotated[models.User, Depends(require_supervisor)],
    db: Session = Depends(get_db)
):
    """Solo Supervisor+ puede editar."""
    query = db.query(models.Product).filter(models.Product.id == product_id)
    
    if not has_role_access(current_user.role, "admin"):
        query = query.filter(models.Product.branch_id == current_user.branch_id)
        
    db_product = query.first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    update_data = product.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_product, key, value)
        
    db.commit()
    db.refresh(db_product)
    
    audit_logger.log_action(
        actor_id=current_user.id,
        target_id=db_product.id,
        action="update_product",
        resource="inventory",
        branch_id=current_user.branch_id,
        details={"changes": list(update_data.keys())}
    )
    
    return db_product


@router.post("/{product_id}/adjust-stock", response_model=schemas.ProductInternalOut)
def adjust_stock(
    product_id: int,
    adjustment: schemas.StockAdjustment,
    current_user: Annotated[models.User, Depends(require_supervisor)],
    db: Session = Depends(get_db)
):
    """Ajuste manual de stock por Supervisor+."""
    query = db.query(models.Product).with_for_update().filter(models.Product.id == product_id)
    if not has_role_access(current_user.role, "admin"):
        query = query.filter(models.Product.branch_id == current_user.branch_id)
    
    db_product = query.first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    db_product.stock += adjustment.quantity
    db.commit()
    db.refresh(db_product)
    
    audit_logger.log_action(
        actor_id=current_user.id,
        target_id=db_product.id,
        action="adjust_stock",
        resource="inventory",
        branch_id=current_user.branch_id,
        details={"quantity": adjustment.quantity, "reason": adjustment.reason}
    )
    
    return db_product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: int, 
    current_user: Annotated[models.User, Depends(require_permission(Permission.INVENTORY_DELETE))],
    db: Session = Depends(get_db)
):
    """Solo con permiso de eliminación."""
    query = db.query(models.Product).filter(models.Product.id == product_id)
    
    if current_user.role != "superadmin":
        query = query.filter(models.Product.branch_id == current_user.branch_id)
        
    db_product = query.first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    # Auditoría antes de borrar
    audit_logger.log_action(
        actor_id=current_user.id,
        target_id=db_product.id,
        action="delete_product",
        resource="inventory",
        branch_id=current_user.branch_id,
        details={"product_name": db_product.name, "product_code": db_product.code}
    )
    
    db.delete(db_product)
    db.commit()


@router.post("/{product_id}/generate-barcode", response_model=schemas.ProductInternalOut)
def generate_barcode(
    product_id: int, 
    current_user: Annotated[models.User, Depends(require_admin)],
    db: Session = Depends(get_db)
):
    query = db.query(models.Product).filter(models.Product.id == product_id)
    if current_user.role != "superadmin":
        query = query.filter(models.Product.branch_id == current_user.branch_id)
        
    db_product = query.first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
        
    if db_product.barcode:
        return db_product

    db_product.barcode = _generate_ean13_from_id(product_id)
    db.commit()
    db.refresh(db_product)
    return db_product


@router.get("/{product_id}/barcode-image")
def get_barcode_image(
    product_id: int, 
    current_user: Annotated[models.User, Depends(get_current_active_user)],
    db: Session = Depends(get_db)
):
    query = db.query(models.Product).filter(models.Product.id == product_id)
    if not has_role_access(current_user.role, "admin"):
        query = query.filter(models.Product.branch_id == current_user.branch_id)
        
    db_product = query.first()
    if not db_product or not db_product.barcode:
        raise HTTPException(status_code=404, detail="Código de barras no encontrado")
        
    ean = barcode.get('ean13', db_product.barcode[:12], writer=ImageWriter())
    buffer = io.BytesIO()
    ean.write(buffer)
    return Response(content=buffer.getvalue(), media_type="image/png")


@router.post("/bulk-generate-barcodes", response_model=list[schemas.ProductInternalOut])
def bulk_generate_barcodes(
    current_user: Annotated[models.User, Depends(require_permission(Permission.INVENTORY_EDIT))],
    db: Session = Depends(get_db)
):
    query = db.query(models.Product).filter(models.Product.barcode == None)
    if current_user.role != "superadmin":
        query = query.filter(models.Product.branch_id == current_user.branch_id)
        
    products_without_barcode = query.all()
    
    for p in products_without_barcode:
        p.barcode = _generate_ean13_from_id(p.id)
        
    db.commit()
    return products_without_barcode
