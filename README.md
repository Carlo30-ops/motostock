# MotoStock - Enterprise Management System

MotoStock is a professional-grade business management system designed for motorcycle workshops, inventory control, and billing management. Built with a modern tech stack focusing on scalability, security, and developer experience.

## 🚀 Key Features

- **Inventory Management:** Advanced stock tracking with automated reorder suggestions and multi-branch support.
- **Point of Sale (POS):** Professional sales interface optimized for desktop and tablet, including barcode scanner support and thermal receipt generation.
- **Workshop Management:** Service templates, vehicle history, and work order tracking.
- **RBAC Security:** Granular Role-Based Access Control for superadmins, admins, supervisors, accountants, mechanics, and cashiers.
- **Multi-Tenant Architecture:** Secure data isolation for multiple branches/organizations.
- **Offline Sync:** Robust synchronization logic for distributed environments.
- **Professional Reporting:** Financial dashboards and inventory audit logs.

## 🛠️ Tech Stack

### Frontend
- **Framework:** React 18 with TypeScript
- **Tooling:** Vite 6
- **Styling:** Tailwind CSS 4
- **State Management:** Zustand & React Query
- **Routing:** React Router 7 (with Lazy Loading)
- **Validation:** Zod & React Hook Form
- **UI Components:** Radix UI (Shadcn UI base)

### Backend
- **Framework:** FastAPI (Python)
- **Database:** PostgreSQL with SQLAlchemy 2.0
- **Migrations:** Alembic
- **Task Scheduling:** APScheduler
- **Security:** JWT Auth, TOTP (2FA), and Rate Limiting
- **Monitoring:** Sentry & Prometheus

## 📁 Project Architecture

### Frontend (@src/app)
Following a **Modular Architecture**:
- `modules/`: Feature-based modules (Sales, Inventory, Purchasing). Each contains its own `components`, `hooks`, `pages`, `services`, and `types`.
- `shared/`: Reusable UI components and utilities.
- `lib/`: Core logic (Auth, RBAC, i18n).
- `api/`: Centralized API clients and hooks.

### Backend (@app)
- `api/routes/`: Organized by domain (Auth, Inventory, Sales, etc.).
- `models/`: Database entities with multi-tenant mixins.
- `schemas/`: Pydantic V2 models split by domain for maintainability.
- `services/`: Encapsulated business logic.
- `middleware/`: Modular security, logging, and tenant context handlers.

## 🔧 Getting Started

### Prerequisites
- Node.js >= 18.0.0
- Python >= 3.10
- PostgreSQL

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/motostock.git
   cd motostock
   ```

2. **Frontend Setup:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Backend Setup:**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate # or venv\Scripts\activate on Windows
   pip install -r requirements.txt
   # Setup .env file
   uvicorn app.main:app --reload
   ```

## 📜 Professional Standards

- **Path Aliases:** Use `@/*` for internal imports and `@shared/*` for UI components.
- **Clean Code:** Adherence to SOLID, DRY, and KISS principles.
- **Strict Typing:** Minimal use of `any`; comprehensive interface definitions.
- **Performance:** Routes are lazy-loaded to optimize initial bundle size.
- **Security:** CSRF protection, secure headers, and encrypted sensitive data.

## 📄 License

Proprietary Software - All Rights Reserved.
