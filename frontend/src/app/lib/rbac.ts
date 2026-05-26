const roleLevel: Record<string, number> = {
  cashier: 10,
  mechanic: 15,
  seller: 20,
  accountant: 25,
  supervisor: 30,
  admin: 40,
  superadmin: 50,
};

export function hasRoleAccess(currentRole: string | undefined, minimumRole: string): boolean {
  if (!currentRole) {
    return false;
  }
  return (roleLevel[currentRole] ?? 0) >= (roleLevel[minimumRole] ?? 10 ** 9);
}

// Lógica granular para componentes
export const rbac = {
  inventory: {
    canView: (role: string) => true,
    canEdit: (role: string) => hasRoleAccess(role, "supervisor"),
    canDelete: (role: string) => hasRoleAccess(role, "admin"),
  },
  sales: {
    canView: (role: string) => role !== "mechanic",
    canCreate: (role: string) => hasRoleAccess(role, "cashier") && role !== "mechanic" && role !== "accountant",
  },
  orders: {
    canView: (role: string) => hasRoleAccess(role, "accountant"),
    canCreate: (role: string) => hasRoleAccess(role, "supervisor"),
  },
  workshop: {
    canView: (role: string) => true,
    canCreate: (role: string) => hasRoleAccess(role, "cashier") && role !== "mechanic",
    canUpdateStatus: (role: string) => hasRoleAccess(role, "mechanic"),
  },
  users: {
    canManage: (role: string) => hasRoleAccess(role, "admin"),
  }
};
