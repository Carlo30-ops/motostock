import { Outlet, Link, useLocation } from "react-router";
import { useState } from "react";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  CreditCard,
  Users,
  FileText,
  Truck,
  Settings,
  CloudOff,
  RefreshCw,
  ChevronDown,
  Trash2,
  UserCircle,
  Briefcase,
  Wrench,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useLanguage } from "../lib/i18n";
import { LanguageToggle } from "./LanguageToggle";
import { store } from "../lib/store";
import { useOfflineSyncStatus } from "../offline/useOfflineSyncStatus";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { hasRoleAccess } from "../lib/rbac";
import { SessionTimeout } from "./SessionTimeout";

export function Layout() {
  const tabletMode = store((state) => state.tabletMode);
  const location = useLocation();
  const { t } = useLanguage();
  const { data: currentUser } = useCurrentUser();
  const role = currentUser?.role;
  const [showQueueDetails, setShowQueueDetails] = useState(false);
  const { pendingCount, pendingItems, isOnline, isSyncing, syncNow, clearQueue, removePendingItem } = useOfflineSyncStatus();

  const navItems = [
    { path: "/", icon: LayoutDashboard, label: t("nav.dashboard"), minRole: "cashier" },
    { path: "/inventory", icon: Package, label: t("nav.inventory"), minRole: "seller" },
    { path: "/sales", icon: ShoppingCart, label: t("nav.sales"), minRole: "cashier" },
    { path: "/credit", icon: CreditCard, label: t("nav.credit"), minRole: "supervisor" },
    { path: "/clients", icon: Users, label: t("nav.clients"), minRole: "seller" },
    { path: "/workshop", icon: Wrench, label: "Taller de Servicio", minRole: "seller" },
    { path: "/reports", icon: FileText, label: t("nav.reports"), minRole: "supervisor" },
    { path: "/purchase-orders", icon: Truck, label: t("nav.orders"), minRole: "supervisor" },
    { path: "/suppliers", icon: Briefcase, label: "Proveedores", minRole: "supervisor" },
    { path: "/profile", icon: UserCircle, label: "Perfil y Seguridad", minRole: "cashier" },
    { path: "/admin/dian-config", icon: Settings, label: "DIAN Config", minRole: "admin" },
  ].filter((item) => hasRoleAccess(role, item.minRole));

  return (
    <div className="h-screen flex flex-col md:flex-row bg-background">
      <SessionTimeout />
      {!tabletMode && (
        <aside className="hidden md:flex md:flex-col md:w-64 bg-sidebar border-r border-sidebar-border">
          <div className="p-6 flex items-center justify-between">
            <h1 className="text-sidebar-foreground">MotoStock</h1>
            <LanguageToggle />
          </div>
          <nav className="flex-1 px-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="p-3 border-t border-sidebar-border">
            <div className="rounded-lg border border-sidebar-border p-3 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CloudOff className="w-4 h-4" />
                  <span>Sync offline</span>
                </div>
                <span className={cn("font-medium", isOnline ? "text-success" : "text-warning")}>
                  {isOnline ? "Online" : "Offline"}
                </span>
              </div>
              <p className="text-sidebar-foreground/80">
                Pendientes: <span className="font-medium">{pendingCount}</span>
              </p>
              <button
                type="button"
                disabled={!isOnline || isSyncing || pendingCount === 0}
                onClick={() => {
                  void syncNow();
                }}
                className={cn(
                  "w-full inline-flex items-center justify-center gap-2 rounded-md px-2 py-1.5 border text-xs",
                  "border-sidebar-border",
                  !isOnline || isSyncing || pendingCount === 0
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-sidebar-accent"
                )}
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isSyncing && "animate-spin")} />
                {isSyncing ? "Sincronizando..." : "Sincronizar ahora"}
              </button>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowQueueDetails((prev) => !prev)}
                  className="w-full inline-flex items-center justify-between rounded-md px-2 py-1.5 border border-sidebar-border hover:bg-sidebar-accent"
                >
                  <span>Ver cola</span>
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showQueueDetails && "rotate-180")} />
                </button>
                {showQueueDetails && (
                  <div className="rounded-md border border-sidebar-border p-2 space-y-2 max-h-40 overflow-y-auto">
                    {pendingItems.length === 0 ? (
                      <p className="text-sidebar-foreground/70">Sin operaciones pendientes.</p>
                    ) : (
                      pendingItems.map((item) => (
                        <div key={`${item.createdAt}-${item.endpoint}`} className="text-[11px] border-b border-sidebar-border/50 pb-1">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium">
                                {item.method} {item.endpoint}
                              </p>
                              <p className="text-sidebar-foreground/70">{new Date(item.createdAt).toLocaleString()}</p>
                            </div>
                            {item.id !== undefined && (
                              <button
                                type="button"
                                onClick={() => {
                                  void removePendingItem(item.id!);
                                }}
                                className="inline-flex items-center justify-center rounded p-1 hover:bg-sidebar-accent"
                                aria-label="Eliminar operacion pendiente"
                                title="Eliminar operacion"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
                <button
                  type="button"
                  disabled={pendingCount === 0}
                  onClick={() => {
                    if (window.confirm(`Se eliminaran ${pendingCount} operaciones pendientes. Deseas continuar?`)) {
                      void clearQueue();
                    }
                  }}
                  className={cn(
                    "w-full inline-flex items-center justify-center gap-2 rounded-md px-2 py-1.5 border border-sidebar-border",
                    pendingCount === 0 ? "opacity-50 cursor-not-allowed" : "hover:bg-sidebar-accent"
                  )}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Limpiar cola
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}

      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        <div className="md:hidden px-3 pt-3">
          <div className="rounded-lg border border-border bg-card p-2 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CloudOff className="w-4 h-4" />
              <span>{isOnline ? "Online" : "Offline"}</span>
              <span className="text-muted-foreground">Pendientes: {pendingCount}</span>
            </div>
            <button
              type="button"
              disabled={!isOnline || isSyncing || pendingCount === 0}
              onClick={() => {
                void syncNow();
              }}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-1 border border-border",
                !isOnline || isSyncing || pendingCount === 0 ? "opacity-50 cursor-not-allowed" : "hover:bg-muted"
              )}
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isSyncing && "animate-spin")} />
              Sync
            </button>
          </div>
        </div>
        <Outlet />
      </main>

      {!tabletMode && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-sidebar border-t border-sidebar-border flex justify-around px-2 py-2 z-10">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-lg min-w-[60px]",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px]">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
