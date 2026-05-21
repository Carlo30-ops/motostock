"""Fixtures pytest — requiere PostgreSQL (ejecutar en Docker)."""

import os

# Evitar rate-limit en suite de tests (muchos logins seguidos).
os.environ.setdefault("ENVIRONMENT", "testing")

collect_ignore = [
    "test_encryption_service.py",
    "test_refresh_tokens.py",
]

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.middleware.rate_limiter import limiter

limiter.enabled = False


@pytest.fixture(scope="session")
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture(scope="session")
def admin_token(client: TestClient) -> str:
    response = client.post(
        "/api/auth/token",
        data={"username": "admin", "password": "admin123"},
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


@pytest.fixture(scope="session")
def auth_headers(admin_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {admin_token}"}
