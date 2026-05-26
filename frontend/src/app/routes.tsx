/**
 * Fase 1.2: ruta pública /login y rutas de negocio detrás de ProtectedRoute.
 */
import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Inventory } from "./pages/Inventory";
import { Sales } from "./pages/Sales";
import { StoreCredit } from "./pages/StoreCredit";
import { Clients } from "./pages/Clients";
import { Reports } from "./pages/Reports";
import { PurchaseOrders } from "./pages/PurchaseOrders";
import { AdminBackups } from "./pages/AdminBackups";
import { AdminDianConfig } from "./pages/AdminDianConfig";
import { InventoryLabels } from "./pages/InventoryLabels";
import { Profile } from "./pages/Profile";
import { Suppliers } from "./pages/Suppliers";
import { Workshop } from "./pages/Workshop";
import { AdminUsers } from "./pages/AdminUsers";
import { Login } from "./pages/Login";

// Purchasing Module
import { PurchaseOrdersPage } from "./modules/purchasing/pages/PurchaseOrdersPage";
import { PurchaseOrderDetailPage } from "./modules/purchasing/pages/PurchaseOrderDetailPage";
import { PurchaseOrderCreatePage } from "./modules/purchasing/pages/PurchaseOrderCreatePage";

import { ProtectedRoute } from "./lib/auth-rbac";

function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <Layout />
    </ProtectedRoute>
  );
}

export const router = createBrowserRouter([
  { path: "/login", Component: Login },
  {
    path: "/",
    Component: ProtectedLayout,
    children: [
      { index: true, Component: Dashboard },
      { 
        path: "inventory", 
        element: <ProtectedRoute requiredPermission="inventory:view"><Inventory /></ProtectedRoute> 
      },
      { 
        path: "inventory/labels", 
        element: <ProtectedRoute requiredPermission="inventory:view"><InventoryLabels /></ProtectedRoute> 
      },
      { 
        path: "sales", 
        element: <ProtectedRoute requiredPermission="sales:view"><Sales /></ProtectedRoute> 
      },
      { 
        path: "credit", 
        element: <ProtectedRoute requiredPermission="sales:view"><StoreCredit /></ProtectedRoute> 
      },
      { 
        path: "clients", 
        element: <ProtectedRoute requiredPermission="sales:view"><Clients /></ProtectedRoute> 
      },
      { 
        path: "reports", 
        element: <ProtectedRoute requiredPermission="reports:view"><Reports /></ProtectedRoute> 
      },
      { 
        path: "purchase-orders", 
        children: [
          { 
            index: true, 
            element: <ProtectedRoute requiredPermission="orders:view"><PurchaseOrdersPage /></ProtectedRoute> 
          },
          { 
            path: "new", 
            element: <ProtectedRoute requiredPermission="orders:create"><PurchaseOrderCreatePage /></ProtectedRoute> 
          },
          { 
            path: ":id", 
            element: <ProtectedRoute requiredPermission="orders:view"><PurchaseOrderDetailPage /></ProtectedRoute> 
          },
        ]
      },
      { 
        path: "suppliers", 
        element: <ProtectedRoute requiredPermission="inventory:edit"><Suppliers /></ProtectedRoute> 
      },
      { 
        path: "workshop", 
        element: <ProtectedRoute requiredPermission="workshop:view"><Workshop /></ProtectedRoute> 
      },
      { 
        path: "admin/users", 
        element: <ProtectedRoute requiredPermission="users:manage"><AdminUsers /></ProtectedRoute> 
      },
      { 
        path: "admin/backups", 
        element: <ProtectedRoute requiredPermission="system:backups"><AdminBackups /></ProtectedRoute> 
      },
      { 
        path: "admin/dian-config", 
        element: <ProtectedRoute requiredPermission="settings:edit"><AdminDianConfig /></ProtectedRoute> 
      },
      { path: "profile", Component: Profile },
    ],
  },
]);
