import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.services.auth import create_access_token, get_password_hash
from app import models
from app.services.tenant import bypass_tenant_context

@pytest.fixture
def owner_user(db_session: Session):
    with bypass_tenant_context("Create owner user", "system"):
        branch = db_session.query(models.Branch).filter_by(id=1).first()
        if not branch:
            branch = models.Branch(id=1, name="Main Branch", is_active=True, organization_id=1)
            db_session.add(branch)
            db_session.flush()
            
        user = models.User(
            username="owner_test",
            email="owner@test.com",
            hashed_password=get_password_hash("owner123"),
            role="owner",
            branch_id=branch.id,
            organization_id=1
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
    return user

@pytest.fixture
def admin_user(db_session: Session):
    with bypass_tenant_context("Create admin user", "system"):
        user = models.User(
            username="admin_test",
            email="admin@test.com",
            hashed_password=get_password_hash("admin123"),
            role="admin",
            branch_id=1,
            organization_id=1
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
    return user

def get_token(user: models.User):
    return create_access_token(data={"sub": user.username, "role": user.role, "branch_id": user.branch_id})

def test_owner_required_middleware_404(client: TestClient, admin_user: models.User):
    """Test que valida que /owner/dashboard con rol ADMIN devuelve 404"""
    token = get_token(admin_user)
    response = client.get("/api/owner/dashboard", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 404
    assert response.json()["error"]["message"] == "Not Found"

def test_owner_can_access_dashboard(client: TestClient, owner_user: models.User, db_session: Session):
    """Test de integración para GET /owner/dashboard con datos de prueba"""
    from app.config import settings
    token = get_token(owner_user)
    secret_path = settings.OWNER_SECRET_PATH
    
    # Agregar algunos datos de prueba
    with bypass_tenant_context("Seed test data", "system"):
        # Sale for today
        sale = models.Sale(
            branch_id=1,
            organization_id=1,
            date=models.func.current_date(),
            subtotal=100.0,
            total=100.0,
            payment_method=models.PaymentMethod.cash
        )
        db_session.add(sale)
        db_session.commit()

    response = client.get(f"/api/{secret_path}/dashboard", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert "today_total_amount" in data
    assert data["today_sales_count"] >= 1

def test_owner_secret_path_works(client: TestClient, owner_user: models.User):
    """Test que valida que el alias secreto funciona"""
    from app.config import settings
    token = get_token(owner_user)
    secret_path = settings.OWNER_SECRET_PATH
    
    response = client.get(f"/api/{secret_path}/dashboard", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200

def test_owner_financial_audit_paginated(client: TestClient, owner_user: models.User, db_session: Session):
    from app.config import settings
    token = get_token(owner_user)
    secret_path = settings.OWNER_SECRET_PATH
    
    # Crear un log de auditoría
    with bypass_tenant_context("Seed audit log", "system"):
        log = models.FinancialAuditLog(
            user_id=owner_user.id,
            branch_id=1,
            organization_id=1,
            event_type="test_event",
            resource="test_resource"
        )
        db_session.add(log)
        db_session.commit()
        
    response = client.get(f"/api/{secret_path}/financial-audit?page=1&limit=10", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["event_type"] == "test_event"
    assert "username" in data[0]
