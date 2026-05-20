const roleLevel: Record<string, number> = {
  cashier: 10,
  seller: 20,
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
