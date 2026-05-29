import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./lib/auth-rbac";

// Loading component
const PageLoader = () => (
  <div className="flex h-[50vh] w-full items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
  </div>
);

// Lazy Loaded Pages
const Dashboard = lazy(() => import("./pages/Dashboard").then(m => ({ default: m.Dashboard })));
const Inventory = lazy(() => import("./modules/inventory/pages/InventoryPage").then(m => ({ default: m.InventoryPage })));
const Sales = lazy(() => import("./modules/sales/pages/SalesPage").then(m => ({ default: m.SalesPage })));
const StoreCredit = lazy(() => import("./pages/StoreCredit").then(m => ({ default: m.StoreCredit })));
const Clients = lazy(() => import("./pages/Clients").then(m => ({ default: m.Clients })));
const Reports = lazy(() => import("./pages/Reports").then(m => ({ default: m.Reports })));
const AdminBackups = lazy(() => import("./pages/AdminBackups").then(m => ({ default: m.AdminBackups })));
const AdminDianConfig = lazy(() => import("./pages/AdminDianConfig").then(m => ({ default: m.AdminDianConfig })));
const InventoryLabels = lazy(() => import("./modules/inventory/InventoryLabels").then(m => ({ default: m.InventoryLabels })));
const Profile = lazy(() => import("./pages/Profile").then(m => ({ default: m.Profile })));
const Suppliers = lazy(() => import("./pages/Suppliers").then(m => ({ default: m.Suppliers })));
const Workshop = lazy(() => import("./pages/Workshop").then(m => ({ default: m.Workshop })));
const AdminUsers = lazy(() => import("./pages/AdminUsers").then(m => ({ default: m.AdminUsers })));
const Login = lazy(() => import("./pages/Login").then(m => ({ default: m.Login })));

// Purchasing Module
const PurchaseOrdersPage = lazy(() => import("./modules/purchasing/pages/PurchaseOrdersPage").then(m => ({ default: m.PurchaseOrdersPage })));
const PurchaseOrderDetailPage = lazy(() => import("./modules/purchasing/pages/PurchaseOrderDetailPage").then(m => ({ default: m.PurchaseOrderDetailPage })));
const PurchaseOrderCreatePage = lazy(() => import("./modules/purchasing/pages/PurchaseOrderCreatePage").then(m => ({ default: m.PurchaseOrderCreatePage })));

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <Layout />
    </ProtectedRoute>
  );
}

export const router = createBrowserRouter([
  { 
    path: "/login", 
    element: <SuspenseWrapper><Login /></SuspenseWrapper> 
  },
  {
    path: "/",
    Component: ProtectedLayout,
    children: [
      { 
        index: true, 
        element: <SuspenseWrapper><Dashboard /></SuspenseWrapper> 
      },
      { 
        path: "inventory", 
        element: <ProtectedRoute requiredPermission="inventory:view"><SuspenseWrapper><Inventory /></SuspenseWrapper></ProtectedRoute> 
      },
      { 
        path: "inventory/labels", 
        element: <ProtectedRoute requiredPermission="inventory:view"><SuspenseWrapper><InventoryLabels /></SuspenseWrapper></ProtectedRoute> 
      },
      { 
        path: "sales", 
        element: <ProtectedRoute requiredPermission="sales:view"><SuspenseWrapper><Sales /></SuspenseWrapper></ProtectedRoute> 
      },
      { 
        path: "credit", 
        element: <ProtectedRoute requiredPermission="sales:view"><SuspenseWrapper><StoreCredit /></SuspenseWrapper></ProtectedRoute> 
      },
      { 
        path: "clients", 
        element: <ProtectedRoute requiredPermission="sales:view"><SuspenseWrapper><Clients /></SuspenseWrapper></ProtectedRoute> 
      },
      { 
        path: "reports", 
        element: <ProtectedRoute requiredPermission="reports:view"><SuspenseWrapper><Reports /></SuspenseWrapper></ProtectedRoute> 
      },
      { 
        path: "purchase-orders", 
        children: [
          { 
            index: true, 
            element: <ProtectedRoute requiredPermission="orders:view"><SuspenseWrapper><PurchaseOrdersPage /></SuspenseWrapper></ProtectedRoute> 
          },
          { 
            path: "new", 
            element: <ProtectedRoute requiredPermission="orders:create"><SuspenseWrapper><PurchaseOrderCreatePage /></SuspenseWrapper></ProtectedRoute> 
          },
          { 
            path: ":id", 
            element: <ProtectedRoute requiredPermission="orders:view"><SuspenseWrapper><PurchaseOrderDetailPage /></SuspenseWrapper></ProtectedRoute> 
          },
        ]
      },
      { 
        path: "suppliers", 
        element: <ProtectedRoute requiredPermission="inventory:edit"><SuspenseWrapper><Suppliers /></SuspenseWrapper></ProtectedRoute> 
      },
      { 
        path: "workshop", 
        element: <ProtectedRoute requiredPermission="workshop:view"><SuspenseWrapper><Workshop /></SuspenseWrapper></ProtectedRoute> 
      },
      { 
        path: "admin/users", 
        element: <ProtectedRoute requiredPermission="users:manage"><SuspenseWrapper><AdminUsers /></SuspenseWrapper></ProtectedRoute> 
      },
      { 
        path: "admin/backups", 
        element: <ProtectedRoute requiredPermission="system:backups"><SuspenseWrapper><AdminBackups /></SuspenseWrapper></ProtectedRoute> 
      },
      { 
        path: "admin/dian-config", 
        element: <ProtectedRoute requiredPermission="settings:edit"><SuspenseWrapper><AdminDianConfig /></SuspenseWrapper></ProtectedRoute> 
      },
      { 
        path: "profile", 
        element: <SuspenseWrapper><Profile /></SuspenseWrapper> 
      },
    ],
  },
]);
