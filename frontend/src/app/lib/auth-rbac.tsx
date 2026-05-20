// Sistema de RBAC (Role-Based Access Control) para MotoStock
// Basado en el diseño del proyecto Figma

export type Permission = 
  | "canViewDashboard"
  | "canViewInventory"
  | "canEditInventory"
  | "canDeleteInventory"
  | "canViewSales"
  | "canCreateSales"
  | "canVoidSales"
  | "canViewReports"
  | "canCreateReports"
  | "canViewClients"
  | "canEditClients"
  | "canDeleteClients"
  | "canViewOrders"
  | "canCreateOrders"
  | "canApproveOrders"
  | "canViewAuditLogs"
  | "canManageBackups"
  | "canManageUsers"
  | "canManageSettings";

export type UserRole = "admin" | "manager" | "cashier" | "viewer";

export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
}

// Definición de permisos por rol
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    // Dashboard
    "canViewDashboard",
    // Inventario
    "canViewInventory",
    "canEditInventory", 
    "canDeleteInventory",
    // Ventas
    "canViewSales",
    "canCreateSales",
    "canVoidSales",
    // Reportes
    "canViewReports",
    "canCreateReports",
    // Clientes
    "canViewClients",
    "canEditClients",
    "canDeleteClients",
    // Órdenes
    "canViewOrders",
    "canCreateOrders",
    "canApproveOrders",
    // Sistema
    "canViewAuditLogs",
    "canManageBackups",
    "canManageUsers",
    "canManageSettings"
  ],
  manager: [
    // Dashboard
    "canViewDashboard",
    // Inventario
    "canViewInventory",
    "canEditInventory",
    // Ventas
    "canViewSales",
    "canCreateSales",
    "canVoidSales",
    // Reportes
    "canViewReports",
    "canCreateReports",
    // Clientes
    "canViewClients",
    "canEditClients",
    // Órdenes
    "canViewOrders",
    "canCreateOrders",
    "canApproveOrders",
    // Sistema
    "canViewAuditLogs",
    "canManageBackups"
  ],
  cashier: [
    // Dashboard
    "canViewDashboard",
    // Inventario
    "canViewInventory",
    // Ventas
    "canViewSales",
    "canCreateSales",
    // Clientes
    "canViewClients",
    // Órdenes
    "canViewOrders"
  ],
  viewer: [
    // Dashboard
    "canViewDashboard",
    // Inventario
    "canViewInventory",
    // Ventas
    "canViewSales",
    // Clientes
    "canViewClients",
    // Reportes
    "canViewReports",
    // Órdenes
    "canViewOrders"
  ]
};

// Hook de autenticación y permisos
export function useAuth() {
  // Mock user para desarrollo
  const mockUser: User = {
    id: "1",
    username: "admin",
    fullName: "Administrador del Sistema",
    email: "admin@motostock.com",
    role: "admin",
    permissions: ROLE_PERMISSIONS.admin,
    isActive: true,
    lastLogin: new Date().toISOString(),
    createdAt: "2024-01-01T00:00:00Z"
  };

  const user = mockUser; // En producción, esto vendría del contexto de autenticación

  const hasPermission = (permission: Permission): boolean => {
    if (!user || !user.isActive) return false;
    return user.permissions.includes(permission);
  };

  const hasAnyPermission = (permissions: Permission[]): boolean => {
    if (!user || !user.isActive) return false;
    return permissions.some(permission => user.permissions.includes(permission));
  };

  const hasAllPermissions = (permissions: Permission[]): boolean => {
    if (!user || !user.isActive) return false;
    return permissions.every(permission => user.permissions.includes(permission));
  };

  const canAccessRoute = (path: string): boolean => {
    const routePermissions: Record<string, Permission[]> = {
      "/": ["canViewDashboard"],
      "/inventory": ["canViewInventory"],
      "/sales": ["canViewSales"],
      "/clients": ["canViewClients"],
      "/reports": ["canViewReports"],
      "/purchase-orders": ["canViewOrders"],
      "/audit-logs": ["canViewAuditLogs"],
      "/backups": ["canManageBackups"],
      "/users": ["canManageUsers"]
    };

    const requiredPermissions = routePermissions[path];
    if (!requiredPermissions) return true;
    return hasAnyPermission(requiredPermissions);
  };

  const getRoleDisplayName = (role: UserRole): string => {
    const roleNames: Record<UserRole, string> = {
      admin: "Administrador",
      manager: "Gerente",
      cashier: "Cajero",
      viewer: "Visualizador"
    };
    return roleNames[role];
  };

  const getRoleColor = (role: UserRole): string => {
    const roleColors: Record<UserRole, string> = {
      admin: "bg-purple-100 text-purple-800",
      manager: "bg-blue-100 text-blue-800",
      cashier: "bg-green-100 text-green-800",
      viewer: "bg-gray-100 text-gray-800"
    };
    return roleColors[role];
  };

  return {
    user,
    isAuthenticated: !!user,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessRoute,
    getRoleDisplayName,
    getRoleColor,
    logout: () => {
      // Implementar logout
      console.log("Logout implementation needed");
    }
  };
}

// Componente ProtectedRoute
export interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermissions?: Permission[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
}

export function ProtectedRoute({ 
  children, 
  requiredPermissions = [], 
  requireAll = false,
  fallback = <div>Access Denied</div>
}: ProtectedRouteProps) {
  const { hasAnyPermission, hasAllPermissions } = useAuth();

  if (requiredPermissions.length === 0) {
    return <>{children}</>;
  }

  const hasAccess = requireAll 
    ? hasAllPermissions(requiredPermissions)
    : hasAnyPermission(requiredPermissions);

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}

// Hook para verificar permisos específicos de módulos
export function useModulePermissions() {
  const { hasPermission } = useAuth();

  return {
    // Dashboard
    canViewDashboard: hasPermission("canViewDashboard"),
    
    // Inventario
    canViewInventory: hasPermission("canViewInventory"),
    canEditInventory: hasPermission("canEditInventory"),
    canDeleteInventory: hasPermission("canDeleteInventory"),
    
    // Ventas
    canViewSales: hasPermission("canViewSales"),
    canCreateSales: hasPermission("canCreateSales"),
    canVoidSales: hasPermission("canVoidSales"),
    
    // Reportes
    canViewReports: hasPermission("canViewReports"),
    canCreateReports: hasPermission("canCreateReports"),
    
    // Clientes
    canViewClients: hasPermission("canViewClients"),
    canEditClients: hasPermission("canEditClients"),
    canDeleteClients: hasPermission("canDeleteClients"),
    
    // Órdenes
    canViewOrders: hasPermission("canViewOrders"),
    canCreateOrders: hasPermission("canCreateOrders"),
    canApproveOrders: hasPermission("canApproveOrders"),
    
    // Sistema
    canViewAuditLogs: hasPermission("canViewAuditLogs"),
    canManageBackups: hasPermission("canManageBackups"),
    canManageUsers: hasPermission("canManageUsers"),
    canManageSettings: hasPermission("canManageSettings")
  };
}

// Utilidades para verificación de permisos en componentes
export function withPermission<P extends object>(
  Component: React.ComponentType<P>,
  requiredPermissions: Permission[],
  requireAll: boolean = false
) {
  return function PermissionWrapper(props: P) {
    return (
      <ProtectedRoute 
        requiredPermissions={requiredPermissions} 
        requireAll={requireAll}
      >
        <Component {...props} />
      </ProtectedRoute>
    );
  };
}
