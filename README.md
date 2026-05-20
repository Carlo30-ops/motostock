# MotoStock - Motorcycle Parts Management System

A full-stack application for managing a motorcycle parts store, including inventory, sales, clients, store credit, purchase orders, and reporting.

## Tech Stack

*   **Backend:** Python 3.11+, FastAPI, PostgreSQL 15, SQLAlchemy, Alembic, JWT Auth
*   **Frontend:** React 18, TypeScript, Vite, React Router, Zustand, React Query, TailwindCSS
*   **Infrastructure:** Docker, Docker Compose

## Quick Start (Docker)

The easiest way to run MotoStock is using Docker Compose.

1.  Make sure you have Docker and Docker Compose installed.
2.  Copy `.env.example` to `.env` and configure your environment variables (Twilio credentials for WhatsApp reminders are optional).
    ```bash
    cp .env.example .env
    ```
3.  Start the application:
    ```bash
    docker-compose up -d --build
    ```

The application will be available at:
*   **Frontend:** http://localhost:5173
*   **Backend API:** http://localhost:8000
*   **API Documentation (Swagger):** http://localhost:8000/docs

## Database Initialization & Seeding

When running `docker-compose up`, the PostgreSQL container automatically initializes the database and runs the `backend/sql/seed.sql` script to create tables and insert sample data (products, clients, combos, sales).

If you are running the backend manually without Docker:
1. Ensure PostgreSQL is running.
2. Run the seed script:
   ```bash
   psql -U motostock -d motostock -f backend/sql/seed.sql
   ```

## Development Setup

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
npm run typecheck
npm run lint
npm run build
```

En Windows, si en el terminal `npm` no se reconoce (PATH distinto al del sistema), desde `frontend` puedes usar `.\scripts\npm.ps1 install` (y lo mismo con `run dev`, `run typecheck`, etc.); el script localiza `npm.cmd` en rutas habituales (Node en `Program Files`, NVM, fnm, Volta, Scoop).

## Features Implemented

*   **Dashboard:** Real-time metrics and revenue charts.
*   **Inventory:** CRUD operations, low stock alerts, and auto-generated restock orders.
*   **Sales:** POS interface, shopping cart (managed via Zustand), combos, discounts, and multiple payment methods (Cash, Card, Store Credit).
*   **Store Credit:** Ledger system to track client balances and payments.
*   **Clients:** Client management with automated oil change reminders (via APScheduler and Twilio).
*   **Reports:** Date-range sales reports, stock value overview, and slow-moving items.
*   **Purchase Orders:** Track supplier orders with pending, sent, and received statuses.
*   **Offline Base (WIP):** Local queue with Dexie for pending mutations and auto-flush when connection returns.
*   **Billing DIAN (Scaffold):** Preview endpoint and submission contract ready for provider integration.

## Electronic Invoicing (DIAN / Siigo)

Backend now includes provider-based invoicing endpoints to support DIAN integrations via Siigo:

- `PUT /api/invoices/company-config` - configure NIT, resolution, prefix, certificate path and provider.
- `GET /api/invoices/company-config` - read current company config.
- `POST /api/invoices` - create and send invoice through configured provider (`DIAN_PROVIDER=siigo|mock`).
- `GET /api/invoices/{id}/status` - refresh and read DIAN/provider status.
- `GET /api/invoices/{id}/pdf` - download print-ready invoice PDF.
- `POST /api/sync` - batch offline sync endpoint (FIFO with LWW conflict handling).

### Environment variables for Siigo

Configure in `.env`:

- `DIAN_PROVIDER=siigo`
- `SIIGO_API_BASE_URL`
- `SIIGO_API_TOKEN`

Request examples are available in `siigo-invoices.http`.

### Admin UI

- DIAN/Siigo company configuration screen: `/admin/dian-config`
- `DIAN_NIT`
- `DIAN_RESOLUTION`
- `DIAN_INVOICE_PREFIX`
