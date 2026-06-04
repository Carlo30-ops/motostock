"""Fixtures pytest — configurado para SQLite local para independencia de base de datos."""

import os
import pytest

# Usar SQLite para pruebas locales para no depender de PostgreSQL en Docker
os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["ENVIRONMENT"] = "testing"
os.environ["SECRET_KEY"] = "test_secret"

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Interceptar e inicializar engine y SessionLocal de app.database para SQLite
import app.database
app.database.engine = create_engine(
    "sqlite:///./test.db",
    connect_args={"check_same_thread": False}
)
app.database.SessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=app.database.engine
)

from app.database import Base, engine, SessionLocal, get_db
from app.main import app
from app.middleware.rate_limiter import limiter
from fastapi.testclient import TestClient

# Desactivar limitador de rate limit para pruebas
limiter.enabled = False

# Permitir la colección de todos los tests
collect_ignore = []

@pytest.fixture(scope="session", autouse=True)
def setup_database():
    # Crear tablas
    Base.metadata.create_all(bind=engine)
    
    # Crear Organización por defecto en bypass
    from app.services.tenant import bypass_tenant_context
    from app import models
    session = SessionLocal()
    with bypass_tenant_context("Setup default org for testing", "system"):
        org = session.query(models.Organization).filter_by(id=1).first()
        if not org:
            org = models.Organization(
                id=1,
                uuid="default-org-uuid",
                name="Organizacion Demo Test",
                slug="demo-test",
                is_active=True,
                plan_tier="enterprise"
            )
            session.add(org)
            session.commit()
    session.close()

    yield
    # Limpiar tablas
    Base.metadata.drop_all(bind=engine)
    if os.path.exists("./test.db"):
        try:
            os.remove("./test.db")
        except Exception:
            pass

@pytest.fixture
def db():
    connection = engine.connect()
    transaction = connection.begin()
    session = SessionLocal(bind=connection)
    
    # Activar contexto de tenant por defecto para consultas directas de tests
    from app.services.tenant import set_current_tenant_id
    token = set_current_tenant_id(1)
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()
    
    set_current_tenant_id(None)

@pytest.fixture
def db_session(db):
    return db

@pytest.fixture(autouse=True)
def override_get_db(db):
    def _get_db_override():
        try:
            yield db
        finally:
            pass
    app.dependency_overrides[get_db] = _get_db_override
    yield
    app.dependency_overrides.pop(get_db, None)

@pytest.fixture(scope="session")
def client() -> TestClient:
    return TestClient(app)

@pytest.fixture(scope="session")
def admin_token(client: TestClient) -> str:
    # Para poder hacer login, necesitamos asegurar que el usuario admin inicial existe.
    # Como la base de datos se limpia entre pruebas, creamos un admin en una sesión corta de sesión/inicialización
    session = SessionLocal()
    from app.services.auth import get_password_hash
    from app import models
    from app.services.tenant import bypass_tenant_context
    
    with bypass_tenant_context("Setup admin fixture", "system"):
        branch = session.query(models.Branch).filter_by(name="Sucursal Demo conftest").first()
        if not branch:
            branch = models.Branch(name="Sucursal Demo conftest", is_active=True, organization_id=1)
            session.add(branch)
            session.flush()
            
        admin = session.query(models.User).filter_by(username="admin").first()
        if not admin:
            admin = models.User(
                username="admin",
                email="admin@democonftest.com",
                hashed_password=get_password_hash("admin123"),
                role="admin",
                branch_id=branch.id,
                organization_id=1
            )
            session.add(admin)
            
        session.commit()
    session.close()

    response = client.post(
        "/api/auth/token",
        data={"username": "admin", "password": "admin123"},
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]

@pytest.fixture(scope="session")
def auth_headers(admin_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {admin_token}"}
