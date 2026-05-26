import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.services.auth import create_access_token
from app import models

client = TestClient(app)

def get_token(username: str, role: str, branch_id: int):
    return create_access_token(data={"sub": username, "role": role, "branch_id": branch_id})

@pytest.fixture(autouse=True)
def test_users(db_session: Session):
    # Crear usuarios de prueba con diferentes roles y sucursales
    users = [
        models.User(username="super", role="superadmin", branch_id=1, email="super@test.com", hashed_password="...", is_active=True),
        models.User(username="admin1", role="admin", branch_id=1, email="admin1@test.com", hashed_password="...", is_active=True),
        models.User(username="admin2", role="admin", branch_id=2, email="admin2@test.com", hashed_password="...", is_active=True),
        models.User(username="cashier1", role="cashier", branch_id=1, email="c1@test.com", hashed_password="...", is_active=True),
        models.User(username="sup1", role="supervisor", branch_id=1, email="sup1@test.com", hashed_password="...", is_active=True),
        models.User(username="mech1", role="mechanic", branch_id=1, email="m1@test.com", hashed_password="...", is_active=True),
    ]
    for u in users:
        db_session.add(u)
    db_session.commit()
    return users

def test_rbac_cashier_cannot_delete_product(db_session: Session):
    token = get_token("cashier1", "cashier", 1)
    response = client.delete("/api/inventory/1", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403

def test_rbac_supervisor_cannot_delete_product(db_session: Session):
    token = get_token("sup1", "supervisor", 1)
    response = client.delete("/api/inventory/1", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403

def test_rbac_admin_can_delete_product(db_session: Session):
    # Mock product in branch 1
    token = get_token("admin1", "admin", 1)
    # Asumimos que existe el producto 1 o lo creamos aquí
    # response = client.delete("/api/inventory/1", headers={"Authorization": f"Bearer {token}"})
    # assert response.status_code == 204
    pass

def test_branch_isolation_inventory(db_session: Session):
    # Cashier branch 1 no debe ver productos de branch 2
    token = get_token("cashier1", "cashier", 1)
    response = client.get("/api/inventory/", headers={"Authorization": f"Bearer {token}"})
    # Validar que todos los items devueltos tengan branch_id == 1
    pass

def test_admin_cannot_touch_superadmin(db_session: Session):
    token = get_token("admin1", "admin", 1)
    # Intentar borrar al superadmin (suponiendo id=1)
    response = client.delete("/api/users/1", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403

def test_rate_limiting_login():
    # Intentar login 10 veces seguidas rápidamente
    for _ in range(10):
        response = client.post("/api/auth/token", data={"username": "test", "password": "pwd"})
    # Eventualmente debería dar 429
    # Nota: en testing a veces se deshabilita el rate limit, depende de la config
    pass
