/**
 * Fase 1.2: cliente HTTP único con tokens access_token/refresh_token e interceptores 401.
 */
import axios, { type InternalAxiosRequestConfig } from "axios";
import { toast } from "sonner";
import { enqueueOfflineMutation } from "../offline/sync";
import type {
  Client,
  Product,
  PurchaseOrder,
  Sale,
  User,
  Organization,
  Supplier,
} from "../lib/store";

export interface BackupFile {
  filename: string;
  size_bytes: number;
  created_at: number;
  url?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

export const getAccessToken = () => localStorage.getItem("access_token");
export const getRefreshToken = () => localStorage.getItem("refresh_token");

export const clearAuthTokens = () => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
};

export const loginWithCredentials = async (username: string, password: string) => {
  const formData = new FormData();
  formData.append("username", username);
  formData.append("password", password);
  
  const res = await apiClient.post("/auth/token-with-refresh", formData);
  const { access_token, refresh_token } = res.data;
  localStorage.setItem("access_token", access_token);
  localStorage.setItem("refresh_token", refresh_token);
  return res.data;
};

export const logoutSession = async () => {
  const refresh_token = getRefreshToken();
  if (refresh_token) {
    try {
      await apiClient.post("/auth/logout", { refresh_token });
    } catch {
      console.error("Error during logout");
    }
  }
  clearAuthTokens();
};

const authBypassPaths = [
  "/auth/token",
  "/auth/refresh",
  "/auth/pin-login",
  "/health",
];

const offlineExcludedPaths = [
  ...authBypassPaths,
  "/auth/users/me",
  "/2fa/status",
  "/2fa/verify",
];

const redirectToLogin = () => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  if (!window.location.pathname.includes("/login")) {
    window.location.href = "/login";
  }
};

const refreshAuthSession = async (): Promise<boolean> => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
      refresh_token: refreshToken,
    });
    const { access_token, refresh_token } = res.data;
    localStorage.setItem("access_token", access_token);
    localStorage.setItem("refresh_token", refresh_token);
    return true;
  } catch {
    return false;
  }
};

apiClient.interceptors.request.use(async (config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Lógica Offline: interceptar mutaciones si no hay red
  const isMutation = ["post", "put", "patch", "delete"].includes(config.method?.toLowerCase() || "");
  const isExcluded = offlineExcludedPaths.some(path => config.url?.includes(path));

  if (isMutation && !isExcluded && !navigator.onLine) {
    await enqueueOfflineMutation({
      endpoint: config.url || "",
      method: (config.method?.toUpperCase() as any) || "POST",
      payload: config.data,
    });
    // Lanzamos un error especial que pueda ser capturado para mostrar feedback
    return Promise.reject({ isOfflineQueued: true, config });
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: any) => {
    // Si la petición fue encolada por el interceptor de request
    if (error.isOfflineQueued) {
      toast.info("Sin conexión. Operación guardada para sincronizar después.");
      return Promise.resolve({ data: { _offline: true } });
    }

    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean } | undefined;
    const requestUrl = originalRequest?.url ?? "";
    const isAuthRequest = [...authBypassPaths].some((path) => requestUrl.includes(path));

    // Error handling logic
    const status = error.response?.status;
    const errorData = error.response?.data as any;
    const errorMessage = errorData?.error?.message || errorData?.detail || error.message || "Error inesperado";

    // Manejo de fallos de red genuinos durante una mutación
    const isMutation = ["post", "put", "patch", "delete"].includes(originalRequest?.method?.toLowerCase() || "");
    const isExcluded = offlineExcludedPaths.some(path => requestUrl.includes(path));
    
    if (isMutation && !isExcluded && (error.code === "ERR_NETWORK" || !status)) {
      await enqueueOfflineMutation({
        endpoint: requestUrl,
        method: (originalRequest?.method?.toUpperCase() as any) || "POST",
        payload: originalRequest?.data ? JSON.parse(originalRequest.data) : null,
      });
      toast.info("Error de red. Operación guardada para sincronizar después.");
      return Promise.resolve({ data: { _offline: true } });
    }

    if (status === 401 && originalRequest && !originalRequest._retry && !isAuthRequest) {
      originalRequest._retry = true;
      const refreshed = await refreshAuthSession();
      if (refreshed) {
        const token = getAccessToken();
        if (token) {
          originalRequest.headers.Authorization = `Bearer ${token}`;
        }
        return apiClient.request(originalRequest);
      }
      redirectToLogin();
      return Promise.reject(error);
    }

    if (status === 401 && !isAuthRequest) {
      redirectToLogin();
    } else if (status === 403) {
      toast.error("No tienes permisos para realizar esta acción");
    } else if (status === 400 || status === 422) {
      toast.error(errorMessage);
    } else if (status && status >= 500) {
      toast.error("Error en el servidor. Intenta de nuevo más tarde.");
    } else if (error.code === "ECONNABORTED") {
      toast.error("Tiempo de espera agotado. Revisa tu conexión.");
    }

    return Promise.reject(error);
  }
);

export interface CreateSalePayload {
  items: { productId: string | number; quantity: number; unitPrice: number }[];
  paymentMethod: string;
  clientId?: number | string;
  date?: string;
}

export interface CreditAdjustmentPayload {
  amount: number;
  description: string;
}

export interface CompanyConfigUpsert {
  nit: string;
  company_name: string;
  address: string;
  dian_resolution: string;
  resolution_number?: string;
  invoice_prefix: string;
  cert_path?: string;
  cert_password?: string;
  provider: string;
}

export const api = {
  // Generic methods (for legacy components)
  get: <T>(url: string, config?: any) => apiClient.get<T>(url, config),
  post: <T>(url: string, data?: any, config?: any) => apiClient.post<T>(url, data, config),
  put: <T>(url: string, data?: any, config?: any) => apiClient.put<T>(url, data, config),
  delete: <T>(url: string, config?: any) => apiClient.delete<T>(url, config),

  // Auth
  login: (data: FormData) =>
    apiClient.post("/auth/token", data).then((res) => res.data),
  pinLogin: (pin: string) =>
    apiClient.post("/auth/pin-login", { pin }).then((res) => res.data),
  getCurrentUser: () =>
    apiClient.get<User>("/auth/users/me").then((res) => res.data),
  updateProfile: (data: Partial<User>) =>
    apiClient.put<User>("/auth/users/me", data).then((res) => res.data),
  changePassword: (data: any) =>
    apiClient.post("/auth/users/me/change-password", data).then((res) => res.data),

  // Organization / Admin
  getOrganization: () =>
    apiClient.get<Organization>("/auth/organization").then((res) => res.data),
  updateOrganization: (data: Partial<Organization>) =>
    apiClient.put<Organization>("/auth/organization", data).then((res) => res.data),
  getUsers: () => apiClient.get<User[]>("/users/").then((res) => res.data),
  createUser: (data: any) =>
    apiClient.post<User>("/users/", data).then((res) => res.data),
  deleteUser: (id: number | string) =>
    apiClient.delete(`/users/${id}`).then((res) => res.data),

  // Inventory
  getProducts: () =>
    apiClient.get<Product[]>("/inventory/").then((res) => res.data),
  createProduct: (data: any) =>
    apiClient.post<Product>("/inventory/", data).then((res) => res.data),
  updateProduct: (id: number | string, data: any) =>
    apiClient.put<Product>(`/inventory/${id}`, data).then((res) => res.data),
  deleteProduct: (id: number | string) =>
    apiClient.delete(`/inventory/${id}`).then((res) => res.data),
  generateBarcode: (id: number | string) =>
    apiClient
      .post<Product>(`/inventory/${id}/generate-barcode`)
      .then((res) => res.data),
  bulkGenerateBarcodes: () =>
    apiClient
      .post<Product[]>("/inventory/bulk-generate-barcodes")
      .then((res) => res.data),

  // Sales
  getSales: () => apiClient.get<Sale[]>("/sales/").then((res) => res.data),
  createSale: (data: CreateSalePayload, discountPct = 0) =>
    apiClient
      .post<Sale>("/sales/", data, { params: { discount_pct: discountPct } })
      .then((res) => res.data),

  // Clients
  getClients: () => apiClient.get<Client[]>("/clients/").then((res) => res.data),
  createClient: (data: any) =>
    apiClient.post<Client>("/clients/", data).then((res) => res.data),
  updateClient: (id: number | string, data: any) =>
    apiClient.put<Client>(`/clients/${id}`, data).then((res) => res.data),
  getClientLedger: (id: number | string) =>
    apiClient.get(`/clients/${id}/ledger`).then((res) => res.data),
  adjustClientCredit: (id: number | string, data: CreditAdjustmentPayload) =>
    apiClient.post(`/clients/${id}/ledger`, data).then((res) => res.data),

  // Purchase Orders
  getOrders: () =>
    apiClient.get<PurchaseOrder[]>("/orders/").then((res) => res.data),
  getPurchaseOrders: () =>
    apiClient.get<PurchaseOrder[]>("/orders/").then((res) => res.data),
  createOrder: (data: any) =>
    apiClient.post<PurchaseOrder>("/orders/", data).then((res) => res.data),
  createPurchaseOrder: (data: any) =>
    apiClient.post<PurchaseOrder>("/orders/", data).then((res) => res.data),
  getOrder: (id: number | string) =>
    apiClient.get<PurchaseOrder>(`/orders/${id}`).then((res) => res.data),
  getPurchaseOrder: (id: number | string) =>
    apiClient.get<PurchaseOrder>(`/orders/${id}`).then((res) => res.data),
  submitOrder: (id: number | string) =>
    apiClient.post(`/orders/${id}/submit`).then((res) => res.data),
  approveOrder: (id: number | string) =>
    apiClient.post(`/orders/${id}/approve`).then((res) => res.data),
  rejectOrder: (id: number | string, notes?: string) =>
    apiClient.post(`/orders/${id}/reject`, { notes }).then((res) => res.data),
  markAsOrdered: (id: number | string) =>
    apiClient.post(`/orders/${id}/mark-ordered`).then((res) => res.data),
  receiveItems: (id: number | string, items: { productId: string; quantity: number }[]) =>
    apiClient.post(`/orders/${id}/receive`, { items }).then((res) => res.data),
  cancelOrder: (id: number | string) =>
    apiClient.post(`/orders/${id}/cancel`).then((res) => res.data),
  updateOrderStatus: (id: number | string, status: string) =>
    apiClient
      .put<PurchaseOrder>(`/orders/${id}/status`, { status })
      .then((res) => res.data),
  updatePurchaseOrderStatus: (id: number | string, status: string) =>
    apiClient
      .put<PurchaseOrder>(`/orders/${id}/status`, { status })
      .then((res) => res.data),
  receivePurchaseOrder: (id: number | string, data: any) =>
    apiClient
      .post<PurchaseOrder>(`/orders/${id}/receive`, data)
      .then((res) => res.data),

  // Suppliers
  getSuppliers: () => apiClient.get<Supplier[]>("/suppliers/").then((res) => res.data),
  createSupplier: (data: any) =>
    apiClient.post<Supplier>("/suppliers/", data).then((res) => res.data),
  updateSupplier: (id: number | string, data: any) =>
    apiClient.put<Supplier>(`/suppliers/${id}`, data).then((res) => res.data),

  // Workshop
  getServiceTemplates: () =>
    apiClient.get("/workshop/templates").then((res) => res.data),
  getVehicles: () =>
    apiClient.get("/workshop/vehicles").then((res) => res.data),
  createVehicle: (data: any) =>
    apiClient.post("/workshop/vehicles", data).then((res) => res.data),
  getWorkOrders: () =>
    apiClient.get("/workshop/orders").then((res) => res.data),
  createWorkOrder: (data: any) =>
    apiClient.post("/workshop/orders", data).then((res) => res.data),
  updateWorkOrderStatus: (id: number | string, status: string) =>
    apiClient.put(`/workshop/orders/${id}/status`, { status }).then((res) => res.data),

  // Reports
  getSalesReport: (from: string, to: string) =>
    apiClient
      .get("/reports/sales", { params: { date_from: from, date_to: to } })
      .then((res) => res.data),
  getInventoryReport: () =>
    apiClient.get("/reports/inventory").then((res) => res.data),

  // Backups & Config
  getBackups: () => apiClient.get("/backups/").then((res) => res.data),
  triggerBackup: () => apiClient.post("/backups/trigger").then((res) => res.data),
  getCompanyConfig: () => apiClient.get("/billing/config").then((res) => res.data),
  upsertCompanyConfig: (data: CompanyConfigUpsert) =>
    apiClient.post("/billing/config", data).then((res) => res.data),

  // Sync
  syncOfflineData: (data: any) =>
    apiClient.post("/sync/batch", data).then((res) => res.data),

  // 2FA
  get2FAStatus: () =>
    apiClient.get<{ enabled: boolean; backup_codes_remaining?: number }>("/2fa/status").then((res) => res.data),
  getTOTPStatus: () =>
    apiClient
      .get<{ enabled: boolean; backup_codes_remaining?: number }>("/2fa/status")
      .then((res) => res.data),
  enable2FA: () =>
    apiClient.post<{ secret: string; qr_code: string; backup_codes: string[] }>("/2fa/setup").then((res) => res.data),
  setupTOTP: () =>
    apiClient
      .post<{ secret: string; qr_code: string; backup_codes: string[] }>("/2fa/setup")
      .then((res) => res.data),
  verify2FA: (code: string) =>
    apiClient.post("/2fa/verify", { code }).then((res) => res.data),
  verifyTOTP: (code: string) =>
    apiClient.post("/2fa/verify", { code }).then((res) => res.data),
  disable2FA: (code?: string) =>
    apiClient.post("/2fa/disable", { code }).then((res) => res.data),
  disableTOTP: (code: string) =>
    apiClient
      .post<{ success: boolean }>("/2fa/disable", { code })
      .then((res) => res.data),
  regenerateBackupCodes: () =>
    apiClient
      .post<{ success: boolean; backup_codes: string[] }>(
        "/2fa/regenerate-backup-codes"
      )
      .then((res) => res.data),
};
