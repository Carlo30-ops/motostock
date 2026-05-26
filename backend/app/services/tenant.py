import time
from contextvars import ContextVar
from contextlib import contextmanager
from typing import Optional, Callable
from fastapi import HTTPException, status
from sqlalchemy import event, inspect, TextClause
from sqlalchemy.orm import Session, with_loader_criteria
from sqlalchemy.orm.attributes import get_history
from app.logging_config import audit_logger, get_logger
from app.models.tenant_mixin import TenantMixin

logger = get_logger("tenant_service")

# Context variables for thread/async-safe isolation
_tenant_id_ctx: ContextVar[Optional[int]] = ContextVar("tenant_id", default=None)
_bypass_tenant_ctx: ContextVar[bool] = ContextVar("bypass_tenant", default=False)

# List of tenant-aware tables for SQL check
TENANT_TABLES = {
    "branches", "users", "products", "clients", "suppliers", "sales",
    "purchase_orders", "work_orders", "inventory_movements", "invoices",
    "company_config", "vehicles", "combos", "service_templates", "credit_ledger"
}

class TenantSecurityError(HTTPException):
    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail
        )

class TenantImmutableError(HTTPException):
    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )

# Base helpers and classes for backward compatibility
class TenantContext:
    def __init__(self, organization_id: int):
        self.organization_id = organization_id

def get_tenant_context() -> TenantContext:
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El usuario no tiene una organización asignada"
        )
    return TenantContext(organization_id=tenant_id)

def apply_tenant_filter(query, model, tenant: TenantContext):
    return query.filter(model.organization_id == tenant.organization_id)

def get_current_tenant_id() -> Optional[int]:
    return _tenant_id_ctx.get()

def set_current_tenant_id(tenant_id: Optional[int]):
    return _tenant_id_ctx.set(tenant_id)

def get_bypass_tenant() -> bool:
    return _bypass_tenant_ctx.get()

def get_session_tenant_id(session: Optional[Session]) -> Optional[int]:
    if session is not None and "tenant_id" in session.info:
        return session.info["tenant_id"]
    return get_current_tenant_id()

def get_session_bypass(session: Optional[Session]) -> bool:
    if session is not None and "bypass" in session.info:
        return session.info["bypass"]
    return get_bypass_tenant()

@contextmanager
def bypass_tenant_context(reason: str, actor: str):
    """
    Temporarily bypass the tenant isolation checks.
    Logs the activation and deactivation for audit logging (no sensitive data).
    """
    logger.info(
        "SaaS tenant bypass activated",
        extra={"audit": True, "reason": reason, "actor": actor}
    )
    audit_logger.log_action(
        actor_id=0,
        target_id=0,
        action="tenant_bypass_start",
        resource="system",
        branch_id=0,
        details={"reason": reason, "actor": actor}
    )
    
    token = _bypass_tenant_ctx.set(True)
    try:
        yield
    finally:
        _bypass_tenant_ctx.reset(token)
        logger.info(
            "SaaS tenant bypass deactivated",
            extra={"audit": True, "reason": reason, "actor": actor}
        )
        audit_logger.log_action(
            actor_id=0,
            target_id=0,
            action="tenant_bypass_end",
            resource="system",
            branch_id=0,
            details={"reason": reason, "actor": actor}
        )

def with_tenant_context(tenant_id: int, func: Callable, *args, **kwargs):
    """Run a synchronous function under a specific tenant context."""
    token = _tenant_id_ctx.set(tenant_id)
    try:
        return func(*args, **kwargs)
    finally:
        _tenant_id_ctx.reset(token)

async def with_tenant_context_async(tenant_id: int, func: Callable, *args, **kwargs):
    """Run an asynchronous function under a specific tenant context."""
    token = _tenant_id_ctx.set(tenant_id)
    try:
        return await func(*args, **kwargs)
    finally:
        _tenant_id_ctx.reset(token)

def execute_safe_raw_sql(session: Session, statement, params: dict = None, reason: str = "Raw SQL Safe Exec", actor: str = "system"):
    """
    Safe helper function to execute raw SQL queries on tenant-aware tables.
    Wraps the database call inside an audited bypass block.
    """
    with bypass_tenant_context(reason, actor):
        return session.execute(statement, params or {})

# Event Listeners

@event.listens_for(Session, "before_flush")
def _before_flush(session: Session, flush_context, instances):
    tenant_id = get_session_tenant_id(session)
    bypass = get_session_bypass(session)
    
    if bypass:
        return
        
    for obj in session.new | session.dirty:
        if isinstance(obj, TenantMixin):
            # Check if this is a modification of organization_id (immutability)
            state = inspect(obj)
            if not state.transient and not state.pending:
                history = get_history(obj, "organization_id")
                if history.has_changes():
                    logger.error(
                        "SaaS security error: Attempted to mutate organization_id",
                        extra={
                            "audit": True,
                            "tenant_id": tenant_id,
                            "model": obj.__class__.__name__,
                            "operation": "mutate"
                        }
                    )
                    raise TenantImmutableError(
                        "El organization_id es inmutable y no se puede modificar (fail-closed)."
                    )
            
            # Enforce matching organization_id
            if obj.organization_id is None:
                if tenant_id is not None:
                    obj.organization_id = tenant_id
                else:
                    logger.error(
                        "SaaS security error: Save attempted without active tenant context",
                        extra={
                            "audit": True,
                            "model": obj.__class__.__name__,
                            "operation": "write",
                            "reason": "missing_tenant_context"
                        }
                    )
                    raise TenantSecurityError(
                        "No se puede guardar un objeto multi-tenant sin un contexto de organización activo (fail-closed)."
                    )
            elif tenant_id is not None and obj.organization_id != tenant_id:
                logger.error(
                    "SaaS security error: Cross-tenant data tampering attempt detected",
                    extra={
                        "audit": True,
                        "tenant_id": tenant_id,
                        "obj_tenant_id": obj.organization_id,
                        "model": obj.__class__.__name__,
                        "operation": "write",
                        "reason": "tampering_attempt"
                    }
                )
                raise TenantSecurityError(
                    "Violación de seguridad multi-tenant: intento de guardar datos de otra organización (fail-closed)."
                )

@event.listens_for(Session, "do_orm_execute")
def _do_orm_execute(orm_execute_state):
    session = orm_execute_state.session
    tenant_id = get_session_tenant_id(session)
    bypass = get_session_bypass(session)
    
    start_time = time.time()
    
    # 1. Protection for textual SQL (raw text execution)
    if isinstance(orm_execute_state.statement, TextClause):
        sql_str = str(orm_execute_state.statement.text).lower()
        targeted_tables = [table for table in TENANT_TABLES if table in sql_str]
        if targeted_tables and not bypass:
            logger.error(
                "SaaS security error: Raw SQL on tenant-aware table blocked",
                extra={
                    "audit": True,
                    "operation": "raw_sql",
                    "tables": targeted_tables,
                    "reason": "missing_bypass"
                }
            )
            raise TenantSecurityError(
                "Consulta SQL textual sobre tablas multi-tenant bloqueada sin bypass explícito (fail-closed)."
            )
        return

    # 2. Protection for ORM UPDATE / DELETE bulk statements
    if getattr(orm_execute_state, "is_update", False) or getattr(orm_execute_state, "is_delete", False):
        is_tenant_modify = False
        target_mapper = None
        for mapper in orm_execute_state.all_mappers:
            if issubclass(mapper.class_, TenantMixin):
                is_tenant_modify = True
                target_mapper = mapper
                break
                
        if is_tenant_modify and target_mapper:
            if not bypass:
                if tenant_id is None:
                    logger.error(
                        "SaaS security error: Bulk modify rejected due to missing active context",
                        extra={
                            "audit": True,
                            "operation": "bulk_modify",
                            "model": target_mapper.class_.__name__,
                            "reason": "missing_tenant_context"
                        }
                    )
                    raise TenantSecurityError(
                        "Actualización/eliminación masiva rechazada: no hay un contexto de organización activo (fail-closed)."
                    )
                
                # Check for explicit organization_id condition in whereclause
                whereclause_str = str(orm_execute_state.statement.whereclause).lower() if orm_execute_state.statement.whereclause is not None else ""
                has_tenant_filter = "organization_id" in whereclause_str
                
                if not has_tenant_filter:
                    logger.warning(
                        "SaaS security warning: Bulk modify did not contain an explicit tenant condition. Injecting automatically.",
                        extra={
                            "audit": True,
                            "tenant_id": tenant_id,
                            "model": target_mapper.class_.__name__,
                            "operation": "update" if orm_execute_state.is_update else "delete",
                            "reason": "missing_explicit_filter"
                        }
                    )
                
                # Append organization_id == tenant_id to the query
                orm_execute_state.statement = orm_execute_state.statement.where(
                    target_mapper.class_.organization_id == tenant_id
                )
            return

    # 3. Protection for standard ORM SELECT queries
    is_tenant_query = False
    
    # First check from all_mappers
    for mapper in orm_execute_state.all_mappers:
        if issubclass(mapper.class_, TenantMixin):
            is_tenant_query = True
            break
            
    # Then check traversing the statement tree (e.g. for subqueries or column-only queries)
    if not is_tenant_query and getattr(orm_execute_state, "is_select", False):
        from sqlalchemy.sql.visitors import iterate
        for elem in iterate(orm_execute_state.statement):
            entity = getattr(elem, "entity_namespace", None)
            if entity and isinstance(entity, type) and issubclass(entity, TenantMixin):
                is_tenant_query = True
                break
            if hasattr(elem, "class_") and issubclass(elem.class_, TenantMixin):
                is_tenant_query = True
                break
            
    if is_tenant_query:
        if not bypass and tenant_id is None:
            logger.error(
                "SaaS security error: Multi-tenant query rejected due to missing active context",
                extra={
                    "audit": True,
                    "operation": "select",
                    "reason": "missing_tenant_context"
                }
            )
            raise TenantSecurityError(
                "Consulta multi-tenant rechazada: no hay un contexto de organización activo y no se ha especificado bypass (fail-closed)."
            )
            
        if not bypass and tenant_id is not None:
            # Apply automatic loader criteria filter for TenantMixin
            orm_execute_state.statement = orm_execute_state.statement.options(
                with_loader_criteria(
                    TenantMixin,
                    lambda cls: cls.organization_id == tenant_id,
                    include_aliases=True,
                    propagate_to_loaders=True
                )
            )
            
    # Measure query execution times per tenant for SaaS observability
    if tenant_id is not None:
        elapsed = (time.time() - start_time) * 1000
        logger.debug(
            f"Tenant query executed",
            extra={"tenant_id": tenant_id, "elapsed_ms": elapsed}
        )
