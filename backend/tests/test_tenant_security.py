import pytest
from sqlalchemy import text, func
from sqlalchemy.orm import Session, joinedload, selectinload
from app import models
from app.services.tenant import (
    set_current_tenant_id,
    get_current_tenant_id,
    TenantSecurityError,
    TenantImmutableError,
    bypass_tenant_context,
    execute_safe_raw_sql
)

@pytest.fixture
def setup_tenants_data(db_session: Session):
    """Populate test database with isolated data for two distinct tenants (orgs 1 and 2)."""
    with bypass_tenant_context("Setup multi-tenant test data", "system"):
        # Ensure Org 2 exists
        org2 = db_session.query(models.Organization).filter_by(id=2).first()
        if not org2:
            org2 = models.Organization(
                id=2,
                uuid="tenant-2-uuid",
                name="Organizacion Tenant 2",
                slug="tenant-2",
                is_active=True,
                plan_tier="basic"
            )
            db_session.add(org2)
            db_session.flush()

        # Branch for Tenant 1
        branch1 = db_session.query(models.Branch).filter_by(name="Branch Tenant 1").first()
        if not branch1:
            branch1 = models.Branch(name="Branch Tenant 1", is_active=True, organization_id=1)
            db_session.add(branch1)
            db_session.flush()

        # Branch for Tenant 2
        branch2 = db_session.query(models.Branch).filter_by(name="Branch Tenant 2").first()
        if not branch2:
            branch2 = models.Branch(name="Branch Tenant 2", is_active=True, organization_id=2)
            db_session.add(branch2)
            db_session.flush()

        # Products for both tenants
        prod1 = models.Product(
            code="P1", name="Product Org 1", category="Cat A", brand="Brand X",
            stock=100, sale_price=10.0, cost_price=6.0, branch_id=branch1.id, organization_id=1
        )
        prod2 = models.Product(
            code="P2", name="Product Org 2", category="Cat A", brand="Brand Y",
            stock=200, sale_price=20.0, cost_price=12.0, branch_id=branch2.id, organization_id=2
        )
        db_session.add_all([prod1, prod2])
        db_session.flush()

        # Combos for both tenants
        combo1 = models.Combo(name="Combo Org 1", price=15.0, organization_id=1)
        combo2 = models.Combo(name="Combo Org 2", price=25.0, organization_id=2)
        db_session.add_all([combo1, combo2])
        db_session.flush()

        # Clients for both tenants
        client1 = models.Client(
            document_id="C1", name="Client Org 1", phone="123", motorcycle_model="Bike 1",
            credit_limit=1000.0, credit_balance=0.0, organization_id=1
        )
        client2 = models.Client(
            document_id="C2", name="Client Org 2", phone="456", motorcycle_model="Bike 2",
            credit_limit=2000.0, credit_balance=0.0, organization_id=2
        )
        db_session.add_all([client1, client2])
        db_session.flush()

        # Credit Ledger entries
        ledger1 = models.CreditLedger(client_id=client1.id, amount=-100.0, description="Ledger Org 1", organization_id=1)
        ledger2 = models.CreditLedger(client_id=client2.id, amount=-200.0, description="Ledger Org 2", organization_id=2)
        db_session.add_all([ledger1, ledger2])

        db_session.commit()

    return {
        "branch1_id": branch1.id,
        "branch2_id": branch2.id,
        "prod1_id": prod1.id,
        "prod2_id": prod2.id,
    }


def test_cross_tenant_reads(db_session: Session, setup_tenants_data):
    """Verify that a session under Tenant 2 context cannot read Tenant 1 data."""
    # Active Tenant: Org 2
    set_current_tenant_id(2)
    db_session.info["tenant_id"] = 2

    # Query Products
    products = db_session.query(models.Product).all()
    assert len(products) == 1
    assert products[0].code == "P2"
    assert products[0].organization_id == 2

    # Query Combos
    combos = db_session.query(models.Combo).all()
    assert len(combos) == 1
    assert combos[0].name == "Combo Org 2"

    # Query Credit Ledger
    ledgers = db_session.query(models.CreditLedger).all()
    assert len(ledgers) == 1
    assert ledgers[0].description == "Ledger Org 2"


def test_cross_tenant_write_tampering(db_session: Session, setup_tenants_data):
    """Verify that writing with a mismatched tenant ID is blocked."""
    set_current_tenant_id(2)
    db_session.info["tenant_id"] = 2

    # Attempt to write product with Org 1 organization_id
    new_product = models.Product(
        code="P3", name="Hacked Product", category="Cat A", brand="Brand Z",
        stock=50, sale_price=10.0, cost_price=5.0,
        branch_id=setup_tenants_data["branch2_id"],
        organization_id=1  # Tampering attempt
    )
    db_session.add(new_product)

    with pytest.raises(TenantSecurityError):
        db_session.flush()


def test_cross_tenant_mutation_tampering(db_session: Session, setup_tenants_data):
    """Verify that mutating organization_id of an existing object is blocked."""
    set_current_tenant_id(2)
    db_session.info["tenant_id"] = 2
    prod2 = db_session.query(models.Product).filter_by(code="P2").one()
    
    prod2.organization_id = 1  # Try to transfer to Tenant 1
    with pytest.raises(TenantImmutableError):
        db_session.flush()


def test_cross_tenant_bulk_modifications(db_session: Session, setup_tenants_data):
    """Verify that bulk updates and deletes are intercepted and scoped to the active tenant."""
    set_current_tenant_id(2)
    db_session.info["tenant_id"] = 2

    # Attempt bulk update on all products
    db_session.query(models.Product).update({"name": "Bulk Updated Product"})
    db_session.commit()

    # Verify only Org 2 product was updated, Org 1 remains untouched
    with bypass_tenant_context("Verify bulk update isolation", "system"):
        prod1 = db_session.query(models.Product).filter_by(code="P1").one()
        prod2 = db_session.query(models.Product).filter_by(code="P2").one()
        assert prod1.name == "Product Org 1"
        assert prod2.name == "Bulk Updated Product"

    # Attempt bulk delete
    set_current_tenant_id(2)
    db_session.info["tenant_id"] = 2
    db_session.query(models.Product).delete()
    db_session.commit()

    # Verify only Org 2 product was deleted
    with bypass_tenant_context("Verify bulk delete isolation", "system"):
        assert db_session.query(models.Product).filter_by(code="P1").count() == 1
        assert db_session.query(models.Product).filter_by(code="P2").count() == 0


def test_eager_loading_leakage(db_session: Session, setup_tenants_data):
    """Verify that relationship loading (joinedload / selectinload) is filtered correctly."""
    set_current_tenant_id(2)
    db_session.info["tenant_id"] = 2

    # Query branches with joinedload on products
    branches = db_session.query(models.Branch).options(joinedload(models.Branch.products)).all()
    assert len(branches) == 1
    assert branches[0].name == "Branch Tenant 2"
    assert len(branches[0].products) == 1
    assert branches[0].products[0].code == "P2"

    # Query branches with selectinload
    branches_selectin = db_session.query(models.Branch).options(selectinload(models.Branch.products)).all()
    assert len(branches_selectin) == 1
    assert len(branches_selectin[0].products) == 1


def test_aggregate_leakage(db_session: Session, setup_tenants_data):
    """Verify aggregate functions (COUNT, SUM, GROUP BY) are fully isolated."""
    set_current_tenant_id(2)
    db_session.info["tenant_id"] = 2

    # 1. COUNT
    count = db_session.query(func.count(models.Product.id)).scalar()
    assert count == 1

    # 2. SUM
    total_stock = db_session.query(func.sum(models.Product.stock)).scalar()
    assert total_stock == 200

    # 3. GROUP BY
    group_results = db_session.query(
        models.Product.category, func.count(models.Product.id)
    ).group_by(models.Product.category).all()
    assert len(group_results) == 1
    assert group_results[0] == ("Cat A", 1)


def test_raw_sql_protection(db_session: Session, setup_tenants_data):
    """Verify that direct raw SQL queries targeting tenant tables are blocked without explicit bypass."""
    set_current_tenant_id(2)
    db_session.info["tenant_id"] = 2

    # Querying raw SQL directly should trigger failure
    raw_query = text("SELECT * FROM products")
    with pytest.raises(TenantSecurityError):
        db_session.execute(raw_query)

    # Safe helper execution should succeed (with bypass)
    res = execute_safe_raw_sql(db_session, raw_query, reason="Safe test", actor="test")
    assert res is not None


def test_identity_map_and_lazy_loading_safety(db_session: Session, setup_tenants_data):
    """Verify SQLAlchemy Identity Map does not leak cached instances across tenant switches."""
    # 1. Load object in Tenant 1 context
    set_current_tenant_id(1)
    db_session.info["tenant_id"] = 1
    p1 = db_session.query(models.Product).filter_by(code="P1").one()
    p1_id = p1.id

    # 2. Switch context to Tenant 2
    set_current_tenant_id(2)
    db_session.info["tenant_id"] = 2

    # 3. Fetch by ID. Identity map must NOT bypass multi-tenant check.
    # Because of with_loader_criteria, the query must return None even if the session has p1 in memory.
    fetched_p1 = db_session.query(models.Product).filter_by(id=p1_id).first()
    assert fetched_p1 is None


def test_context_var_reset():
    """Verify ContextVar initialization and cleanup states."""
    set_current_tenant_id(5)
    assert get_current_tenant_id() == 5

    # Simulate reset
    set_current_tenant_id(None)
    assert get_current_tenant_id() is None
