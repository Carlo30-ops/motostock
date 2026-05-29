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
  LogOut,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useLanguage } from "../lib/i18n";
import { LanguageToggle } from "./LanguageToggle";
import { store } from "../lib/store";
import { useOfflineSyncStatus } from "../offline/useOfflineSyncStatus";
import { useAuth, Permission } from "../lib/auth-rbac";
import { SessionTimeout } from "./SessionTimeout";
import { OfflineStatusBar } from "./OfflineStatusBar";

export function Layout() {
  const tabletMode = store((state) => state.tabletMode);
  const location = useLocation();
  const { t } = useLanguage();
  const { logout, hasPermission } = useAuth();
  const [showQueueDetails, setShowQueueDetails] = useState(false);
  const { pendingCount, pendingItems, isOnline, isSyncing, syncNow, clearQueue, removePendingItem } = useOfflineSyncStatus();

  const navItems = [
    { path: "/", icon: LayoutDashboard, label: t("nav.dashboard") },
    { path: "/inventory", icon: Package, label: t("nav.inventory"), permission: "inventory:view" as Permission },
    { path: "/sales", icon: ShoppingCart, label: t("nav.sales"), permission: "sales:view" as Permission },
    { path: "/credit", icon: CreditCard, label: t("nav.credit"), permission: "sales:view" as Permission },
    { path: "/clients", icon: Users, label: t("nav.clients"), permission: "sales:view" as Permission },
    { path: "/workshop", icon: Wrench, label: t("nav.workshop"), permission: "workshop:view" as Permission },
    { path: "/reports", icon: FileText, label: t("nav.reports"), permission: "reports:view" as Permission },
    { path: "/purchase-orders", icon: Truck, label: t("nav.orders"), permission: "reports:view" as Permission },
    { path: "/suppliers", icon: Briefcase, label: t("nav.suppliers"), permission: "inventory:edit" as Permission },
    { path: "/admin/users", icon: Users, label: "Usuarios", permission: "users:manage" as Permission },
    { path: "/profile", icon: UserCircle, label: t("nav.profile") },
    { path: "/admin/dian-config", icon: Settings, label: "DIAN Config", permission: "settings:edit" as Permission },
  ].filter((item) => {
    if (!item.permission) return true;
    return hasPermission(item.permission);
  });

  const handleLogout = () => {
    void logout();
  };

  return (
    <div className="h-screen flex flex-col md:flex-row bg-background">
      <SessionTimeout />
      {tabletMode && (
        <button
          type="button"
          onClick={handleLogout}
          className="fixed top-4 left-4 z-20 inline-flex items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar px-3 py-2 text-sm text-sidebar-foreground shadow-md hover:bg-sidebar-accent"
        >
          <LogOut className="w-4 h-4" />
          Salir
        </button>
      )}
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
            <button
              type="button"
              onClick={handleLogout}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 border border-sidebar-border hover:bg-sidebar-accent text-sidebar-foreground"
            >
              <LogOut className="w-4 h-4" />
              Salir
            </button>
          </div>
        </aside>
      )}

      <main className="flex-1 overflow-auto pb-16 md:pb-0 flex flex-col">
        <OfflineStatusBar />
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
          <button
            type="button"
            onClick={handleLogout}
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg min-w-[60px] text-sidebar-foreground"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-[10px]">Salir</span>
          </button>
        </nav>
      )}
    </div>
  );
}
