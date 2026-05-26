# MotoStock Architectural Baseline - Security & RBAC

## 1. Visión General
MotoStock utiliza un modelo de Seguridad por Capas (Defense in Depth) donde la autoridad reside en el Backend (FastAPI), y el Frontend (React) actúa como orquestador de UX consciente de permisos.

## 2. Estructura RBAC (Role-Based Access Control)

### Jerarquía de Roles (backend/app/services/auth.py)
1. **superadmin (50)**: Control total. Gestión de otros superadmins.
2. **admin (40)**: Gestión total multi-sucursal. No gestiona superadmins.
3. **supervisor (30)**: Operación de inventario y taller. Sin permisos de eliminación.
4. **accountant (25)**: Lectura financiera y exportación de reportes.
5. **mechanic (15)**: Gestión de órdenes de trabajo asignadas.
6. **cashier (10)**: Punto de venta y consulta de stock.

### Matriz de Permisos (frontend/src/app/lib/auth-rbac.tsx)
- **Inventory**: `view`, `viewCosts`, `edit`, `delete`, `adjustStock`.
- **Sales**: `view`, `create`, `void`, `applyDiscount`, `manageCombos`.
- **Workshop**: `view`, `createOrder`, `updateStatus`, `assignMechanic`.
- **Reports**: `view`, `export`, `financial`.
- **Users**: `view`, `manage`, `manageSuperadmin`.

## 3. Mecanismos de Protección

### Capa Backend
- **Dependencias Atómicas**: `require_admin`, `require_supervisor`, etc.
- **Aislamiento de Sucursal (Branch Isolation)**: Filtrado automático vía `.filter(branch_id == current_user.branch_id)` en todas las rutas críticas para roles < admin.
- **Concurrencia**: Bloqueo pesimista `with_for_update()` en transacciones de stock y dinero.
- **Hardening HTTP**:
  - Rate Limiting (SlowAPI): Protege login y endpoints sensibles.
  - Security Headers: CSP, HSTS, X-Frame-Options: DENY.

### Capa Frontend
- **ProtectedRoute**: Bloqueo de navegación basado en permisos o roles.
- **Componente <Can />**: Ocultamiento declarativo de elementos de la UI.
- **Hook useAuth**: Singleton de estado de autenticación y permisos.

## 4. Auditoría y Trazabilidad
- **AuditLogger**: Registra `actor_id`, `action`, `resource`, `branch_id` y `details` (JSON) para cada acción crítica.
- **Soft Delete**: Los usuarios nunca se eliminan físicamente; se desactivan (`is_active=False`) y se invalidan sus sesiones.

## 5. Reglas para Futuras Contribuciones
1. **Permiso Primero**: Cualquier nueva funcionalidad debe tener un permiso atómico definido en `auth-rbac.tsx`.
2. **Backend Authority**: Nunca confiar solo en la ocultación visual; el endpoint debe validar el permiso.
3. **Branch Awareness**: Los desarrolladores deben incluir explícitamente el filtro de `branch_id` en las queries.
4. **No Bypass**: No se permite el uso de `role === 'admin'` dentro de componentes; usar `hasPermission()` o `<Can />`.

## 6. Backlog Técnico Priorizado

### A. Deuda Técnica Urgente
- [ ] Ejecutar migración `20260526_01_add_rbac_fields_and_indexes.py` en entorno de producción.
- [ ] Implementar Smoke Tests automatizados para los 6 roles.

### B. Mejoras Recomendadas (Hardening Futuro)
- [ ] **Módulo de Alertas**: Notificar vía Telegram/Email ante múltiples errores 403.
- [ ] **Auditoría Visual**: Interfaz para que el Superadmin vea los logs de `audit_logger`.
- [ ] **Políticas de Descuento**: Hacer que `max_discount` sea configurable por rol/sucursal desde la UI.

### C. Roadmap Próxima Fase (Recomendación: Módulo de Compras Avanzado)
1. **Módulo de Compras (Impacto: ALTO / Complejidad: MEDIA)**: Ideal para aprovechar la infraestructura RBAC ya creada. Permite controlar márgenes y relación con proveedores.
2. **Dashboard Ejecutivo (Impacto: MEDIO / Complejidad: BAJA)**: Visualización de KPIs multi-sucursal para el Superadmin.
3. **App Móvil de Taller (Impacto: ALTO / Complejidad: ALTA)**: Específica para mecánicos, usando los permisos de `mechanic_id`.
