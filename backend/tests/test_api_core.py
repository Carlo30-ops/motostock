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
