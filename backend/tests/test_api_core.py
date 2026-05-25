"""Tests API núcleo: inventario, ventas (stock) y ledger de clientes."""

import uuid
from datetime import date

from fastapi.testclient import TestClient


def test_inventory_crud(client: TestClient, auth_headers: dict):
    suffix = uuid.uuid4().hex[:8]
    code = f"QA-{suffix}"

    created = client.post(
        "/api/inventory/",
        headers=auth_headers,
        json={
            "code": code,
            "name": f"Producto QA {suffix}",
            "category": "repuestos",
            "brand": "Test",
            "stock": 25,
            "sale_price": 50000,
            "cost_price": 30000,
            "reorder_threshold": 5,
        },
    )
    assert created.status_code == 201, created.text
    product_id = created.json()["id"]
    assert created.json()["stock"] == 25

    updated = client.put(
        f"/api/inventory/{product_id}",
        headers=auth_headers,
        json={"stock": 30},
    )
    assert updated.status_code == 200
    assert updated.json()["stock"] == 30

    listed = client.get("/api/inventory/", headers=auth_headers)
    assert listed.status_code == 200
    assert any(p["id"] == product_id for p in listed.json())

    deleted = client.delete(f"/api/inventory/{product_id}", headers=auth_headers)
    assert deleted.status_code == 204


def test_sale_reduces_stock(client: TestClient, auth_headers: dict):
    suffix = uuid.uuid4().hex[:8]
    product = client.post(
        "/api/inventory/",
        headers=auth_headers,
        json={
            "code": f"SALE-{suffix}",
            "name": f"Venta QA {suffix}",
            "category": "aceites",
            "brand": "Test",
            "stock": 10,
            "sale_price": 25000,
            "cost_price": 15000,
        },
    )
    assert product.status_code == 201
    product_id = product.json()["id"]
    initial_stock = product.json()["stock"]

    sale = client.post(
        "/api/sales/",
        headers=auth_headers,
        json={
            "date": str(date.today()),
            "items": [
                {
                    "product_id": product_id,
                    "quantity": 2,
                    "unit_price": 25000,
                }
            ],
            "discount_pct": 0,
            "payment_method": "cash",
        },
    )
    assert sale.status_code == 201, sale.text
    assert sale.json()["total"] == 50000

    refreshed = client.get("/api/inventory/", headers=auth_headers)
    row = next(p for p in refreshed.json() if p["id"] == product_id)
    assert row["stock"] == initial_stock - 2

    client.delete(f"/api/inventory/{product_id}", headers=auth_headers)


def test_sale_rejects_tampered_price(client: TestClient, auth_headers: dict):
    suffix = uuid.uuid4().hex[:8]
    product = client.post(
        "/api/inventory/",
        headers=auth_headers,
        json={
            "code": f"TAMPER-{suffix}",
            "name": f"Manipulado QA {suffix}",
            "category": "repuestos",
            "brand": "Test",
            "stock": 10,
            "sale_price": 30000,
            "cost_price": 15000,
        },
    )
    assert product.status_code == 201
    product_id = product.json()["id"]

    sale = client.post(
        "/api/sales/",
        headers=auth_headers,
        json={
            "date": str(date.today()),
            "items": [{"product_id": product_id, "quantity": 1, "unit_price": 1}],
            "discount_pct": 0,
            "payment_method": "cash",
            "expected_total": 1,
        },
    )
    assert sale.status_code == 400
    assert "Precio del producto" in sale.json()["detail"]

    client.delete(f"/api/inventory/{product_id}", headers=auth_headers)


def test_sale_rejects_tampered_total(client: TestClient, auth_headers: dict):
    suffix = uuid.uuid4().hex[:8]
    product = client.post(
        "/api/inventory/",
        headers=auth_headers,
        json={
            "code": f"TOTAL-{suffix}",
            "name": f"Total QA {suffix}",
            "category": "repuestos",
            "brand": "Test",
            "stock": 10,
            "sale_price": 20000,
            "cost_price": 10000,
        },
    )
    assert product.status_code == 201
    product_id = product.json()["id"]

    sale = client.post(
        "/api/sales/",
        headers=auth_headers,
        json={
            "date": str(date.today()),
            "items": [{"product_id": product_id, "quantity": 2, "unit_price": 20000}],
            "discount_pct": 0,
            "payment_method": "cash",
            "expected_total": 1,
        },
    )
    assert sale.status_code == 400
    assert "Total de la venta" in sale.json()["detail"]

    client.delete(f"/api/inventory/{product_id}", headers=auth_headers)


def test_credit_sale_deducts_available_credit(client: TestClient, auth_headers: dict):
    suffix = uuid.uuid4().hex[:8]
    created_client = client.post(
        "/api/clients/",
        headers=auth_headers,
        json={
            "name": f"Credito QA {suffix}",
            "phone": "3000000000",
            "motorcycle_model": "Test Bike",
            "credit_limit": 500000,
            "credit_balance": 50000,
        },
    )
    assert created_client.status_code == 201, created_client.text
    client_id = created_client.json()["id"]

    product = client.post(
        "/api/inventory/",
        headers=auth_headers,
        json={
            "code": f"CREDIT-{suffix}",
            "name": f"Credito producto {suffix}",
            "category": "repuestos",
            "brand": "Test",
            "stock": 10,
            "sale_price": 10000,
            "cost_price": 5000,
        },
    )
    assert product.status_code == 201
    product_id = product.json()["id"]

    sale = client.post(
        "/api/sales/",
        headers=auth_headers,
        json={
            "client_id": client_id,
            "date": str(date.today()),
            "items": [{"product_id": product_id, "quantity": 2, "unit_price": 10000}],
            "discount_pct": 0,
            "payment_method": "credit",
            "expected_total": 20000,
        },
    )
    assert sale.status_code == 201, sale.text
    assert sale.json()["total"] == 20000

    updated_clients = client.get("/api/clients/", headers=auth_headers)
    row = next(c for c in updated_clients.json() if c["id"] == client_id)
    assert row["credit_balance"] == 30000

    ledger = client.get(f"/api/clients/{client_id}/ledger", headers=auth_headers)
    assert any(e["amount"] == -20000 for e in ledger.json())

    client.delete(f"/api/inventory/{product_id}", headers=auth_headers)


def test_credit_sale_rejects_insufficient_available_credit(client: TestClient, auth_headers: dict):
    suffix = uuid.uuid4().hex[:8]
    created_client = client.post(
        "/api/clients/",
        headers=auth_headers,
        json={
            "name": f"Sin cupo QA {suffix}",
            "phone": "3000000000",
            "motorcycle_model": "Test Bike",
            "credit_limit": 500000,
            "credit_balance": 5000,
        },
    )
    assert created_client.status_code == 201, created_client.text
    client_id = created_client.json()["id"]

    product = client.post(
        "/api/inventory/",
        headers=auth_headers,
        json={
            "code": f"NO-CREDIT-{suffix}",
            "name": f"Sin cupo producto {suffix}",
            "category": "repuestos",
            "brand": "Test",
            "stock": 10,
            "sale_price": 10000,
            "cost_price": 5000,
        },
    )
    assert product.status_code == 201
    product_id = product.json()["id"]

    sale = client.post(
        "/api/sales/",
        headers=auth_headers,
        json={
            "client_id": client_id,
            "date": str(date.today()),
            "items": [{"product_id": product_id, "quantity": 1, "unit_price": 10000}],
            "discount_pct": 0,
            "payment_method": "credit",
            "expected_total": 10000,
        },
    )
    assert sale.status_code == 400
    assert "Cupo de credito insuficiente" in sale.json()["detail"]

    client.delete(f"/api/inventory/{product_id}", headers=auth_headers)


def test_client_ledger_adjustment(client: TestClient, auth_headers: dict):
    clients = client.get("/api/clients/", headers=auth_headers)
    assert clients.status_code == 200
    assert clients.json()

    client_id = clients.json()[0]["id"]
    before_balance = clients.json()[0]["credit_balance"]

    entry = client.post(
        f"/api/clients/{client_id}/ledger",
        headers=auth_headers,
        json={"amount": 15000, "description": "Ajuste test pytest"},
    )
    assert entry.status_code == 200, entry.text
    assert entry.json()["amount"] == 15000

    ledger = client.get(f"/api/clients/{client_id}/ledger", headers=auth_headers)
    assert ledger.status_code == 200
    assert any(e["description"] == "Ajuste test pytest" for e in ledger.json())

    updated_clients = client.get("/api/clients/", headers=auth_headers)
    row = next(c for c in updated_clients.json() if c["id"] == client_id)
    assert row["credit_balance"] == before_balance + 15000


def test_client_ledger_cannot_make_available_credit_negative(client: TestClient, auth_headers: dict):
    suffix = uuid.uuid4().hex[:8]
    created_client = client.post(
        "/api/clients/",
        headers=auth_headers,
        json={
            "name": f"Ajuste negativo QA {suffix}",
            "phone": "3000000000",
            "motorcycle_model": "Test Bike",
            "credit_limit": 500000,
            "credit_balance": 10000,
        },
    )
    assert created_client.status_code == 201, created_client.text
    client_id = created_client.json()["id"]

    entry = client.post(
        f"/api/clients/{client_id}/ledger",
        headers=auth_headers,
        json={"amount": -15000, "description": "Ajuste negativo test pytest"},
    )
    assert entry.status_code == 400
    assert "no puede quedar negativo" in entry.json()["detail"]


def test_client_ledger_cannot_exceed_credit_limit(client: TestClient, auth_headers: dict):
    suffix = uuid.uuid4().hex[:8]
    created_client = client.post(
        "/api/clients/",
        headers=auth_headers,
        json={
            "name": f"Ajuste maximo QA {suffix}",
            "phone": "3000000000",
            "motorcycle_model": "Test Bike",
            "credit_limit": 500000,
            "credit_balance": 490000,
        },
    )
    assert created_client.status_code == 201, created_client.text
    client_id = created_client.json()["id"]

    entry = client.post(
        f"/api/clients/{client_id}/ledger",
        headers=auth_headers,
        json={"amount": 20000, "description": "Ajuste sobre limite test pytest"},
    )
    assert entry.status_code == 400
    assert "cupo maximo" in entry.json()["detail"]
