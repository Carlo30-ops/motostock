from enum import Enum
from typing import Set

class Permission(str, Enum):
    # Inventory
    INVENTORY_VIEW = "inventory:view"
    INVENTORY_EDIT = "inventory:edit"
    INVENTORY_DELETE = "inventory:delete"
    INVENTORY_VIEW_COSTS = "inventory:viewCosts"
    INVENTORY_ADJUST_STOCK = "inventory:adjustStock"
    
    # Sales
    SALES_VIEW = "sales:view"
    SALES_CREATE = "sales:create"
    SALES_APPLY_DISCOUNT = "sales:applyDiscount"
    SALES_DELETE = "sales:delete"
    
    # Clients
    CLIENTS_VIEW = "clients:view"
    CLIENTS_EDIT = "clients:edit"
    CLIENTS_DELETE = "clients:delete"
    
    # Workshop
    WORKSHOP_VIEW = "workshop:view"
    WORKSHOP_MANAGE = "workshop:manage"
    
    # Orders
    ORDERS_VIEW = "orders:view"
    ORDERS_CREATE = "orders:create"
    ORDERS_APPROVE = "orders:approve"
    
    # Reports
    REPORTS_VIEW = "reports:view"
    REPORTS_FINANCIAL = "reports:financial"
    
    # Users & Admin
    USERS_MANAGE = "users:manage"
    SYSTEM_BACKUPS = "system:backups"
    SETTINGS_EDIT = "settings:edit"

ROLE_PERMISSIONS: dict[str, Set[Permission]] = {
    "cashier": {
        Permission.INVENTORY_VIEW,
        Permission.SALES_VIEW,
        Permission.SALES_CREATE,
        Permission.CLIENTS_VIEW,
        Permission.CLIENTS_EDIT,
    },
    "mechanic": {
        Permission.INVENTORY_VIEW,
        Permission.WORKSHOP_VIEW,
        Permission.WORKSHOP_MANAGE,
    },
    "accountant": {
        Permission.INVENTORY_VIEW,
        Permission.INVENTORY_VIEW_COSTS,
        Permission.SALES_VIEW,
        Permission.REPORTS_VIEW,
        Permission.REPORTS_FINANCIAL,
        Permission.CLIENTS_VIEW,
        Permission.ORDERS_VIEW,
    },
    "supervisor": {
        Permission.INVENTORY_VIEW,
        Permission.INVENTORY_VIEW_COSTS,
        Permission.INVENTORY_EDIT,
        Permission.INVENTORY_ADJUST_STOCK,
        Permission.SALES_VIEW,
        Permission.SALES_CREATE,
        Permission.SALES_APPLY_DISCOUNT,
        Permission.CLIENTS_VIEW,
        Permission.CLIENTS_EDIT,
        Permission.WORKSHOP_VIEW,
        Permission.WORKSHOP_MANAGE,
        Permission.ORDERS_VIEW,
        Permission.ORDERS_CREATE,
        Permission.REPORTS_VIEW,
    },
    "admin": {
        Permission.INVENTORY_VIEW,
        Permission.INVENTORY_VIEW_COSTS,
        Permission.INVENTORY_EDIT,
        Permission.INVENTORY_DELETE,
        Permission.INVENTORY_ADJUST_STOCK,
        Permission.SALES_VIEW,
        Permission.SALES_CREATE,
        Permission.SALES_APPLY_DISCOUNT,
        Permission.SALES_DELETE,
        Permission.CLIENTS_VIEW,
        Permission.CLIENTS_EDIT,
        Permission.CLIENTS_DELETE,
        Permission.WORKSHOP_VIEW,
        Permission.WORKSHOP_MANAGE,
        Permission.ORDERS_VIEW,
        Permission.ORDERS_CREATE,
        Permission.ORDERS_APPROVE,
        Permission.REPORTS_VIEW,
        Permission.REPORTS_FINANCIAL,
        Permission.USERS_MANAGE,
        Permission.SYSTEM_BACKUPS,
        Permission.SETTINGS_EDIT,
    },
    "superadmin": set(Permission),
}

def has_permission(user_role: str, permission: Permission) -> bool:
    permissions = ROLE_PERMISSIONS.get(user_role, set())
    return permission in permissions
