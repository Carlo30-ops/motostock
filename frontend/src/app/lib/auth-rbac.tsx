import React, { useMemo } from "react";
import { Navigate, useLocation } from "react-router";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { getAccessToken } from "../api/client";

// --- 1. Definiciones de Tipos ---

export type UserRole = 
  | "superadmin" 
  | "admin" 
  | "supervisor" 
  | "accountant" 
  | "mechanic" 
  | "cashier";

export type Permission =
  // Inventario
  | "inventory:view"
  | "inventory:viewCosts"
  | "inventory:edit"
  | "inventory:delete"
  | "inventory:adjustStock"
  // Ventas
  | "sales:view"
  | "sales:create"
  | "sales:void"
  | "sales:applyDiscount"
  | "sales:manageCombos"
  // Reportes
  | "reports:view"
  | "reports:export"
  | "reports:financial"
  // Órdenes de Compra
  | "orders:view"
  | "orders:create"
  | "orders:edit"
  | "orders:approve"
  | "orders:receive"
  | "orders:viewCosts"
  | "orders:cancel"
  // Taller
  | "workshop:view"
  | "workshop:edit"
  | "workshop:createOrder"
  | "workshop:updateStatus"
  | "workshop:assignMechanic"
  // Usuarios y Sistema
  | "users:view"
  | "users:manage"
  | "users:manageSuperadmin"
  | "settings:view"
  | "settings:edit"
  | "system:backups"
  | "system:logs";

export type FeatureFlag = 
  | "enableAdvancedReports"
  | "enableWorkshopModule"
  | "enableFinancialDashboard";

// --- 2. Matriz de Permisos (Atomic & Compound Logic) ---

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  superadmin: [
    "inventory:view", "inventory:viewCosts", "inventory:edit", "inventory:delete", "inventory:adjustStock",
    "sales:view", "sales:create", "sales:void", "sales:applyDiscount", "sales:manageCombos",
    "reports:view", "reports:export", "reports:financial",
    "orders:view", "orders:create", "orders:edit", "orders:approve", "orders:receive", "orders:viewCosts", "orders:cancel",
    "workshop:view", "workshop:edit", "workshop:createOrder", "workshop:updateStatus", "workshop:assignMechanic",
    "users:view", "users:manage", "users:manageSuperadmin",
    "settings:view", "settings:edit", "system:backups", "system:logs"
  ],
  admin: [
    "inventory:view", "inventory:viewCosts", "inventory:edit", "inventory:delete", "inventory:adjustStock",
    "sales:view", "sales:create", "sales:void", "sales:applyDiscount", "sales:manageCombos",
    "reports:view", "reports:export", "reports:financial",
    "orders:view", "orders:create", "orders:edit", "orders:approve", "orders:receive", "orders:viewCosts", "orders:cancel",
    "workshop:view", "workshop:edit", "workshop:createOrder", "workshop:updateStatus", "workshop:assignMechanic",
    "users:view", "users:manage",
    "settings:view", "settings:edit", "system:backups", "system:logs"
  ],
  supervisor: [
    "inventory:view", "inventory:viewCosts", "inventory:edit", "inventory:adjustStock",
    "sales:view", "sales:create", "sales:manageCombos",
    "reports:view", "reports:export",
    "orders:view", "orders:create", "orders:edit", "orders:receive", "orders:viewCosts", "orders:cancel",
    "workshop:view", "workshop:edit", "workshop:createOrder", "workshop:updateStatus", "workshop:assignMechanic",
    "users:view", "settings:view"
  ],
  accountant: [
    "inventory:view", "inventory:viewCosts",
    "sales:view",
    "reports:view", "reports:export", "reports:financial",
    "orders:view", "orders:viewCosts",
    "workshop:view", "settings:view"
  ],
  mechanic: [
    "inventory:view",
    "workshop:view", "workshop:updateStatus"
  ],
  cashier: [
    "inventory:view",
    "sales:view", "sales:create", "sales:applyDiscount",
    "workshop:view", "workshop:createOrder"
  ]
};

// --- 3. Feature Flags Config ---
const FEATURE_FLAGS: Record<FeatureFlag, boolean> = {
  enableAdvancedReports: true,
  enableWorkshopModule: true,
  enableFinancialDashboard: true
};

// --- 4. Helpers y Lógica de Negocio ---

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  branch_id: number;
  max_discount: number;
  is_active: boolean;
  created_at: string;
}

export interface AuthState {
  user: User | null;
  role: UserRole | null;
  permissions: Permission[];
  branch_id: number | null;
  isAuthenticated: boolean;
}

export function useAuth() {
  const { data: currentUser, isLoading } = useCurrentUser();

  const state: AuthState = useMemo(() => {
    const user = currentUser as unknown as User;
    const role = user?.role;
    return {
      user: user || null,
      role: role || null,
      permissions: role ? ROLE_PERMISSIONS[role] || [] : [],
      branch_id: user?.branch_id || null,
      isAuthenticated: !!getAccessToken() && !!user,
    };
  }, [currentUser]);

  const hasPermission = (permission: Permission): boolean => {
    return state.permissions.includes(permission);
  };

  const hasAnyPermission = (perms: Permission[]): boolean => {
    return perms.some(p => state.permissions.includes(p));
  };

  const isFeatureEnabled = (flag: FeatureFlag): boolean => {
    return FEATURE_FLAGS[flag] || false;
  };

  // Branch-aware logic
  const canAccessBranch = (targetBranchId: number): boolean => {
    if (state.role === "superadmin" || state.role === "admin") return true;
    return state.branch_id === targetBranchId;
  };

  const canViewFinancialData = (): boolean => {
    return hasAnyPermission(["reports:financial", "inventory:viewCosts"]);
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/login";
  };

  return {
    ...state,
    isLoading,
    hasPermission,
    hasAnyPermission,
    isFeatureEnabled,
    canAccessBranch,
    canViewFinancialData,
    logout,
    debug: process.env.NODE_ENV === "development" ? {
      ...state,
      missingPermissions: (required: Permission[]) => required.filter(p => !state.permissions.includes(p))
    } : null
  };
}

// --- 5. Componentes Guardias (UI Guards) ---

interface CanProps {
  permission?: Permission;
  permissions?: Permission[];
  any?: boolean;
  feature?: FeatureFlag;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function Can({ 
  permission, 
  permissions, 
  any = false, 
  feature, 
  fallback = null, 
  children 
}: CanProps) {
  const { hasPermission, hasAnyPermission, isFeatureEnabled } = useAuth();

  if (feature && !isFeatureEnabled(feature)) return <>{fallback}</>;

  if (permission && !hasPermission(permission)) return <>{fallback}</>;

  if (permissions) {
    const hasAccess = any ? hasAnyPermission(permissions) : permissions.every(p => hasPermission(p));
    if (!hasAccess) return <>{fallback}</>;
  }

  return <>{children}</>;
}

// --- 6. Route Guards ---

export interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: Permission;
  requiredRole?: UserRole;
  fallback?: React.ReactNode;
}

export function ProtectedRoute({
  children,
  requiredPermission,
  requiredRole,
  fallback = <div className="p-8 text-center text-red-600 font-bold">403 - Acceso Denegado</div>,
}: ProtectedRouteProps) {
  const location = useLocation();
  const { isAuthenticated, isLoading, role, hasPermission } = useAuth();

  if (isLoading) return <div className="p-8 text-center">Cargando...</div>;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && role !== requiredRole && role !== "superadmin") {
    return <>{fallback}</>;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
