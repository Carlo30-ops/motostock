# Arquitectura de Aislamiento Multi-Tenant

Este documento detalla la implementación técnica del aislamiento de datos por sucursal (tenant) en MotoStock.

## 1. Contexto y Seguridad (ContextVars)

Para evitar pasar el `tenant_id` manualmente a través de todas las funciones de servicio, utilizamos `contextvars` de Python. Esto garantiza que el ID del tenant sea local a la petición actual, incluso en entornos asíncronos.

```python
# backend/app/services/tenant.py
from contextvars import ContextVar

tenant_context: ContextVar[Optional[int]] = ContextVar("tenant_context", default=None)
```

## 2. TenantMixin

Todos los modelos que requieren aislamiento deben heredar de `TenantMixin`. Esto añade una columna `branch_id` y establece una relación con el modelo `Branch`.

```python
class TenantMixin:
    @declared_attr
    def branch_id(cls):
        return Column(Integer, ForeignKey("branches.id"), nullable=False, index=True)
```

## 3. Aislamiento Automático (do_orm_execute)

Utilizamos el evento `do_orm_execute` de SQLAlchemy para interceptar todas las consultas ORM. Si el contexto tiene un `tenant_id` establecido, se inyecta automáticamente una cláusula `WHERE branch_id = :val`.

```python
@event.listens_for(Engine, "do_orm_execute")
def _add_tenant_filter(execute_state):
    # Lógica para inyectar filtros automáticamente
```

## 4. Filosofía Fail-Closed

El sistema está diseñado para fallar de forma segura:
*   Si una petición intenta acceder a datos protegidos sin un `tenant_id` en el contexto, el sistema lanza una excepción de seguridad.
*   No se permite la creación de registros sin un `branch_id` válido.

## 5. Protección de SQL Raw

Aunque preferimos el ORM, para las consultas de SQL nativo (raw), el sistema incluye validadores que verifican la presencia de filtros de sucursal para evitar fugas de datos accidentales.

## 6. Bypass Auditado

Existen casos excepcionales (como reportes globales de Superadmin) donde se requiere saltar el aislamiento. Estos casos utilizan un contexto específico `with tenant_bypass():` que es registrado en los logs de auditoría del sistema.
