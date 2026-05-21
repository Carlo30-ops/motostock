# 🏍️ MotoStock — Sistema de Gestión para Taller y Repuestos de Motos

MotoStock es una solución full-stack robusta y de nivel empresarial diseñada específicamente para talleres y almacenes de repuestos de motocicletas (orientada al mercado de Colombia). Centraliza el punto de venta (POS), la facturación, el control de inventario con alertas de reorden, cuentas de crédito en tienda, reportes analíticos avanzados, administración de proveedores, órdenes de compra y un módulo de taller 100% operativo para el seguimiento de vehículos y órdenes de trabajo (OT).

---

## 🏗️ Arquitectura del Sistema

El sistema ha sido modernizado para asegurar la integridad de los datos y una óptima experiencia de usuario:

*   **Backend:** Python 3.11+, FastAPI (API REST ultrarrápida), PostgreSQL 15 (base de datos relacional y transaccional), SQLAlchemy 2 (ORM moderno), Alembic (control de versiones y migraciones de BD), Redis 7 (caché y control de flujo/rate limiting con SlowAPI), y seguridad avanzada (JWT + Refresh Tokens + cifrado Fernet + 2FA/TOTP).
*   **Frontend:** React 18, TypeScript, Vite 6, Tailwind CSS 4, Radix UI (componentes premium).
    *   *Nota de estado:* La comunicación de datos ha sido migrada por completo a **React Query** (fuente única de verdad del backend). **Zustand** se utiliza únicamente para el manejo de estado transitorio de la UI y el carrito del punto de venta (POS).
*   **Monitoreo e Infraestructura:** Docker y Docker Compose para orquestar la aplicación junto con Prometheus y Grafana para visualización de métricas en tiempo real, además de un agente automatizado de backups diarios.

---

## 🚀 Arranque Rápido con Docker

La forma más sencilla y recomendada de poner en marcha todo el stack es a través de Docker Compose.

### 1. Preparar las Variables de Entorno
Copia la plantilla de variables de entorno y ajusta las contraseñas base:
```bash
cp .env.example .env
```
*(Puedes dejar los valores predeterminados para desarrollo local).*

### 2. Levantar los Contenedores
Ejecuta el comando de construcción e inicialización de servicios:
```bash
docker compose up -d --build
```
Este comando descargará las imágenes, compilará los contenedores de frontend y backend, iniciará PostgreSQL y Redis, aplicará automáticamente todas las migraciones de Alembic e insertará los datos semilla.

### 🔑 Credenciales de Acceso Demo

El sistema se inicializa con los siguientes usuarios de demostración (cargados en la migración `seed_data`):

| Rol / Nivel | Usuario | Contraseña | PIN (Tablet) |
| :--- | :--- | :--- | :--- |
| **Administrador (Superadmin)** | `admin` | `admin123` | `1234` |
| **Cajero (Cashier)** | `cashier` | `cashier123` | `5678` |

### 🌐 Puertos y URLs de Servicios

Una vez iniciado el stack, los siguientes servicios estarán disponibles de forma local:

*   **Aplicación Web (Frontend):** [http://localhost:8080](http://localhost:8080) *(Puerto 8080 configurado para evitar colisiones con el puerto 80 en Windows)*.
*   **Documentación de la API (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)
*   **Servicio API (Backend):** [http://localhost:8000/api](http://localhost:8000/api)
*   **Métricas de Prometheus:** [http://localhost:9090](http://localhost:9090)
*   **Tableros de Grafana:** [http://localhost:3000](http://localhost:3000) *(Métricas y rendimiento de contenedores)*.

---

## 🛠️ Configuración de Desarrollo Local (Sin Docker)

Si deseas ejecutar los servicios de manera local para tareas de desarrollo o depuración de código:

### Requisitos Previos
*   Instalar Python 3.11+
*   Instalar Node.js 18+ (y npm o pnpm)
*   Tener una instancia activa de PostgreSQL 15 y Redis 7.

### 1. Servidor Backend
```bash
cd backend
python -m venv venv
# En Linux/macOS:
source venv/bin/activate
# En Windows (PowerShell):
.\venv\Scripts\Activate.ps1

# Instalar dependencias e iniciar
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### 2. Cliente Frontend
```bash
cd frontend
npm install
npm run dev
```
*El frontend de desarrollo se abrirá en [http://localhost:5173](http://localhost:5173) y apuntará automáticamente al backend en `http://localhost:8000`.*

> [!TIP]
> **Compatibilidad en Windows:** Si tienes problemas con el ejecutable global de `npm` en Windows, puedes utilizar el script local del proyecto `.\scripts\npm.ps1 install` y `npm.ps1 run dev` para autolocalizar las rutas de Node.js.

---

## 🧪 Ejecución de la Suite de Pruebas

El backend cuenta con una suite completa de pruebas de integración y seguridad que validan la API (autenticación JWT, refresh tokens, control de stock, ledger de clientes, proveedores y flujos de taller).

### Ejecutar Tests en Docker (Recomendado)
```bash
docker compose run --rm --no-deps backend pytest tests/ -v
```

### Ejecutar Tests en Entorno Local
Activa el entorno virtual del backend y ejecuta:
```bash
cd backend
pytest tests/ -v
```

---

## 💾 Gestión de Backups (Copias de Seguridad)

MotoStock incluye un contenedor automatizado (`motostock_backup`) que realiza copias de seguridad de la base de datos de manera programada:

*   **Frecuencia:** Cada 12 horas (configurable mediante `BACKUP_INTERVAL_HOURS`).
*   **Retención:** Almacena los archivos SQL comprimidos en `.gz` dentro de la carpeta local `./backups/` y elimina las copias que tengan más de 7 días.
*   **Copia Manual:** Si requieres generar un respaldo inmediato, puedes ejecutar:
    ```bash
    docker exec -t motostock_db pg_dump -U motostock motostock > ./backups/manual_backup_$(date +%Y%m%d_%H%M%S).sql
    ```

---

## 🔒 Buenas Prácticas de Seguridad para Producción

1.  **Rotación de Contraseñas:** Asegúrate de cambiar `SECRET_KEY`, `ENCRYPTION_KEY`, `POSTGRES_PASSWORD` y `REDIS_PASSWORD` en el archivo `.env` antes del despliegue en producción.
2.  **CORS Restrictivo:** Modifica la variable `CORS_ORIGINS` en el archivo `.env` para apuntar únicamente a los dominios autorizados de tu producción (ej. `CORS_ORIGINS=https://mi-taller.com`).
3.  **Firewall:** Configura las reglas de red en tu servidor para no exponer el puerto `5432` (PostgreSQL) ni el `6379` (Redis) públicamente. Solo los puertos del proxy Nginx (`80`/`443`) y el backend (`8000`) si es necesario, deben estar expuestos.
4.  **2FA:** Se recomienda activar el Doble Factor de Autenticación (2FA) en la pantalla de Perfil para todos los usuarios con roles administrativos.

Para detalles exhaustivos de despliegue, consulta la guía [DEPLOYMENT.md](file:///c:/Users/factu/OneDrive/Documentos%201/SCRIPS/GESTION-TALLER/motostock/DEPLOYMENT.md).
