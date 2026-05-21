"""Tests API Fase B: auth refresh, proveedores y taller."""

import uuid

from fastapi.testclient import TestClient


def test_login_returns_token(client: TestClient):
    response = client.post(
        "/api/auth/token",
        data={"username": "admin", "password": "admin123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["role"] == "admin"


def test_login_with_refresh_token(client: TestClient):
    response = client.post(
        "/api/auth/token-with-refresh",
        data={"username": "admin", "password": "admin123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["access_token"]
    assert data["refresh_token"]


def test_refresh_token_rotation(client: TestClient):
    login = client.post(
        "/api/auth/token-with-refresh",
        data={"username": "admin", "password": "admin123"},
    )
    assert login.status_code == 200
    refresh_token = login.json()["refresh_token"]

    refreshed = client.post(
        "/api/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert refreshed.status_code == 200
    body = refreshed.json()
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["refresh_token"] != refresh_token


def test_suppliers_crud(client: TestClient, auth_headers: dict):
    created = client.post(
        "/api/suppliers/",
        headers=auth_headers,
        json={
            "name": "Proveedor Test API",
            "contact_name": "Juan QA",
            "phone": "3001234567",
            "email": "qa@test.local",
            "address": "Calle 1",
            "rating": 4,
            "is_active": True,
        },
    )
    assert created.status_code == 201, created.text
    supplier_id = created.json()["id"]

    listed = client.get("/api/suppliers/", headers=auth_headers)
    assert listed.status_code == 200
    ids = [s["id"] for s in listed.json()]
    assert supplier_id in ids

    updated = client.put(
        f"/api/suppliers/{supplier_id}",
        headers=auth_headers,
        json={"rating": 5},
    )
    assert updated.status_code == 200
    assert updated.json()["rating"] == 5


def test_workshop_service_templates(client: TestClient, auth_headers: dict):
    response = client.get(
        "/api/workshop/service-templates",
        headers=auth_headers,
    )
    assert response.status_code == 200
    templates = response.json()
    assert len(templates) >= 1
    assert "name" in templates[0]


def test_workshop_vehicle_and_work_order(client: TestClient, auth_headers: dict):
    clients = client.get("/api/clients/", headers=auth_headers)
    assert clients.status_code == 200
    assert clients.json(), "Se requiere al menos un cliente en seed"

    client_id = clients.json()[0]["id"]

    plate = f"TST{uuid.uuid4().hex[:6].upper()}"
    vehicle = client.post(
        "/api/workshop/vehicles",
        headers=auth_headers,
        json={
            "client_id": client_id,
            "brand": "Yamaha",
            "model": "FZ",
            "year": 2022,
            "plate": plate,
        },
    )
    assert vehicle.status_code == 201, vehicle.text
    vehicle_id = vehicle.json()["id"]

    templates = client.get(
        "/api/workshop/service-templates",
        headers=auth_headers,
    ).json()
    service_id = templates[0]["id"]

    order = client.post(
        "/api/workshop/work-orders",
        headers=auth_headers,
        json={
            "vehicle_id": vehicle_id,
            "scheduled_date": "2026-05-25",
            "service_ids": [service_id],
            "notes": "Orden de prueba",
        },
    )
    assert order.status_code == 201, order.text
    order_id = order.json()["id"]
    assert order.json()["status"] == "scheduled"

    patched = client.patch(
        f"/api/workshop/work-orders/{order_id}/status",
        headers=auth_headers,
        json={"status": "in_progress"},
    )
    assert patched.status_code == 200
    assert patched.json()["status"] == "in_progress"


def test_2fa_status(client: TestClient, auth_headers: dict):
    response = client.get("/api/2fa/status", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "enabled" in data
    assert "backup_codes_remaining" in data
