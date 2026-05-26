# RBAC Internal Documentation - MotoStock

## Jerarquía de Roles
La jerarquía se define numéricamente para permitir herencia de permisos:

1. **superadmin (50)**: Acceso total. Único que gestiona otros superadmins.
2. **admin (40)**: Gestión total excepto superadmins. Visibilidad multi-sucursal.
3. **supervisor (30)**: Gestión de inventario y taller. Sin permisos de eliminación.
4. **accountant (25)**: Solo lectura financiera y de reportes.
5. **mechanic (15)**: Gestión de órdenes asignadas.
6. **cashier (10)**: Ventas y consulta de stock.

## Protección en Backend (FastAPI)

### Dependencias Centralizadas
Ubicación: `backend/app/services/auth.py`

- `require_role(min_role)`: Base para todas las protecciones.
- `require_admin`: Acceso nivel 40+.
- `require_superadmin`: Acceso nivel 50.
- `require_cashier`: Acceso nivel 10+.

### Filtro de Sucursal (Branch Isolation)
Las rutas deben filtrar automáticamente por `current_user.branch_id` a menos que el rol sea `>= admin`.

Ejemplo:
```python
query = db.query(models.Product)
if not has_role_access(current_user.role, "admin"):
    query = query.filter(models.Product.branch_id == current_user.branch_id)
```

## Protección en Frontend (React)

### Componente `<Can />`
Uso para ocultar/mostrar elementos de la UI:
```tsx
<Can permission="inventory:delete">
  <Button>Eliminar</Button>
</Can>
```

### Hook `useAuth`
Proporciona helpers de validación:
- `hasPermission(perm)`
- `canAccessBranch(branchId)`
- `canViewFinancialData()`

### Rutas Protegidas
En `routes.tsx`, usar `ProtectedRoute`:
```tsx
{ 
  path: "admin/users", 
  element: <ProtectedRoute requiredPermission="users:manage"><AdminUsers /></ProtectedRoute> 
}
```

## Hardening de Seguridad
1. **Rate Limiting**: Aplicado en `/auth/token`, `/users/`, y `/change-password`.
2. **Security Headers**: X-Frame-Options: DENY, CSP estricto, HSTS activado.
3. **Token Rotation**: Los refresh tokens rotan en cada uso.
4. **Invalidación**: Al cambiar contraseña o desactivar usuario, se revocan todos los tokens en DB.
