# 🏍️ MotoStock — Sistema de Gestión para Taller y Repuestos de Motos

MotoStock es una solución full-stack robusta y de nivel empresarial diseñada específicamente para talleres y almacenes de repuestos de motocicletas (orientada al mercado de Colombia). Centraliza el punto de venta (POS), la facturación, el control de inventario con alertas de reorden, cuentas de crédito en tienda, reportes analíticos avanzados, administración de proveedores, órdenes de compra y un módulo de taller 100% operativo para el seguimiento de vehículos y órdenes de trabajo (OT).

---

## 🏗️ Arquitectura del Sistema

El sistema utiliza una arquitectura **Multi-Tenant (Aislamiento de Datos)** y un modelo de seguridad **Fail-Closed**.

### 🛠️ Tech Stack
*   **Backend:** Python 3.11+, FastAPI, PostgreSQL 15, SQLAlchemy 2 (ORM), Alembic, Redis 7 (Rate Limiting).
*   **Frontend:** React 18, TypeScript, Vite 6, Tailwind CSS 4, React Query (Estado del Servidor), Zustand (Estado UI).
*   **Infraestructura:** Docker Compose, Nginx (Proxy/WAF), Prometheus & Grafana (Monitoreo).

### 🔒 Seguridad Multi-tenant e Isolation
El sistema implementa un aislamiento estricto por sucursal/tenant:
*   **ContextVars:** Seguimiento seguro del `tenant_id` durante el ciclo de vida de la petición.
*   **Aislamiento en Base de Datos:** Uso de `TenantMixin` y ganchos (hooks) de SQLAlchemy (`do_orm_execute`) para inyectar automáticamente filtros de tenant en todas las consultas, previniendo fugas de datos.
*   **Seguridad Fail-Closed:** Si un usuario no tiene un `tenant_id` válido en su sesión, el sistema bloquea cualquier acceso a datos de forma predeterminada.

### 🛡️ Control de Acceso Basado en Roles (RBAC)
Jerarquía de permisos granular:
*   **Superadmin:** Gestión global, creación de sucursales y auditoría.
*   **Admin de Sucursal:** Control total sobre su propia sede, reportes financieros y gestión de personal.
*   **Supervisor:** Gestión de inventario, aprobación de órdenes de compra y supervisión de taller.
*   **Vendedor/Cajero:** Operaciones de POS, facturación y registro de clientes.
*   **Mecánico:** Acceso limitado al módulo de taller y órdenes de trabajo.

---

## 🚀 Arranque Rápido con Docker

La forma más sencilla y recomendada de poner en marcha todo el stack:

1.  **Preparar Entorno:** `cp .env.example .env`
2.  **Levantar:** `docker compose up -d --build`

### 🔑 Credenciales Demo
| Rol | Usuario | Password | PIN |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `admin123` | `1234` |
| **Cajero** | `cashier` | `cashier123` | `5678` |

---

## 🛠️ Configuración de Desarrollo Local

### Requisitos
*   Python 3.11+, Node.js 18+, PostgreSQL 15, Redis 7.

### 1. Backend
```bash
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1 # Windows
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## 🗺️ Roadmap de Desarrollo

- [x] **Fase 1:** Core POS e Inventario.
- [x] **Fase 2:** Módulo de Taller y Ordenes de Trabajo.
- [x] **Fase 3:** Multi-sucursal y Aislamiento de Datos.
- [ ] **Fase 4:** Facturación Electrónica DIAN (Integración Siigo).
- [ ] **Fase 5:** App Móvil PWA para Mecánicos.
- [ ] **Fase 6:** Analítica Predictiva de Stock.

---

## 🧪 Pruebas y Calidad
*   **Backend:** Suite completa con `pytest` incluyendo pruebas de concurrencia y seguridad.
*   **Frontend:** Tipado estricto y validación de componentes.
*   **CI/CD:** GitHub Actions configurado para validación automática en cada commit.

Para detalles exhaustivos, consulta la guía [DEPLOYMENT.md](docs/DEPLOYMENT.md).
