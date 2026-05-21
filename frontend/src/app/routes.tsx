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
import { Login } from "./pages/Login";
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
      { path: "inventory", Component: Inventory },
      { path: "inventory/labels", Component: InventoryLabels },
      { path: "sales", Component: Sales },
      { path: "credit", Component: StoreCredit },
      { path: "clients", Component: Clients },
      { path: "reports", Component: Reports },
      { path: "purchase-orders", Component: PurchaseOrders },
      { path: "suppliers", Component: Suppliers },
      { path: "workshop", Component: Workshop },
      { path: "admin/backups", Component: AdminBackups },
      { path: "admin/dian-config", Component: AdminDianConfig },
      { path: "profile", Component: Profile },
    ],
  },
]);
