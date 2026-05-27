/**
 * Fase 1.2: cliente HTTP único con tokens access_token/refresh_token e interceptores 401.
 */
import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { toast } from "sonner";
import type {
  Client,
  Product,
  PurchaseOrder,
  Sale,
  User,
  Organization,
} from "../lib/store";

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

const authBypassPaths = [
  "/auth/token",
  "/auth/refresh",
  "/auth/pin-login",
  "/health",
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
  } catch (e) {
    return false;
  }
};

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean } | undefined;
    const requestUrl = originalRequest?.url ?? "";
    const isAuthRequest = [...authBypassPaths].some((path) => requestUrl.includes(path));

    // Error handling logic
    const status = error.response?.status;
    const errorData = error.response?.data as any;
    const errorMessage = errorData?.error?.message || errorData?.detail || error.message || "Error inesperado";

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

export const api = {
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
  createSale: (data: any, discountPct = 0) =>
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
  adjustClientCredit: (id: number | string, data: { amount: number; description: string }) =>
    apiClient.post(`/clients/${id}/ledger`, data).then((res) => res.data),

  // Purchase Orders
  getPurchaseOrders: () =>
    apiClient.get<PurchaseOrder[]>("/orders/").then((res) => res.data),
  createPurchaseOrder: (data: any) =>
    apiClient.post<PurchaseOrder>("/orders/", data).then((res) => res.data),
  getPurchaseOrder: (id: number | string) =>
    apiClient.get<PurchaseOrder>(`/orders/${id}`).then((res) => res.data),
  updatePurchaseOrderStatus: (id: number | string, status: string) =>
    apiClient
      .put<PurchaseOrder>(`/orders/${id}/status`, { status })
      .then((res) => res.data),
  receivePurchaseOrder: (id: number | string, data: any) =>
    apiClient
      .post<PurchaseOrder>(`/orders/${id}/receive`, data)
      .then((res) => res.data),

  // Reports
  getSalesReport: (from: string, to: string) =>
    apiClient
      .get("/reports/sales", { params: { date_from: from, date_to: to } })
      .then((res) => res.data),
  getInventoryReport: () =>
    apiClient.get("/reports/inventory").then((res) => res.data),

  // Sync
  syncOfflineData: (data: any) =>
    apiClient.post("/sync/batch", data).then((res) => res.data),

  // 2FA
  getTOTPStatus: () =>
    apiClient
      .get<{ enabled: boolean }>("/2fa/status")
      .then((res) => res.data),
  setupTOTP: () =>
    apiClient
      .post<{ secret: string; qr_code: string }>("/2fa/setup")
      .then((res) => res.data),
  verifyTOTP: (code: string) =>
    apiClient.post("/2fa/verify", { code }).then((res) => res.data),
  disableTOTP: (code: string) =>
    apiClient
      .post<{ success: boolean }>("/2fa/disable", { code })
      .then((res) => res.data),
  regenerateBackupCodes: () =>
    apiClient
      .post<{ success: boolean; data: { backup_codes: string[] } }>(
        "/2fa/regenerate-backup-codes"
      )
      .then((res) => res.data),
};
