import axios from "axios";
import type { Client, Product, PurchaseOrder, Sale } from "../lib/store";

export interface CreditAdjustmentPayload {
  amount: number;
  description: string;
}

export interface CreateSalePayload extends Omit<Sale, "id"> {}
export interface CreateOrderPayload extends Omit<PurchaseOrder, "id"> {}
export interface UpdateOrderStatusPayload {
  status: PurchaseOrder["status"];
}
export interface BackupFile {
  filename: string;
  created_at: number;
  size_bytes: number;
}

export interface CompanyConfig {
  id: number;
  nit: string;
  company_name: string;
  address: string;
  dian_resolution: string;
  resolution_number?: string | null;
  invoice_prefix: string;
  cert_path?: string | null;
  cert_password?: string | null;
  provider: string;
  created_at: string;
  updated_at: string;
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

export interface SyncOperation {
  resource: string;
  action: "create" | "update";
  record_id?: number;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface SyncBatchPayload {
  operations: SyncOperation[];
}

export interface CurrentUser {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
}

function isNetworkError(error: unknown): boolean {
  return axios.isAxiosError(error) && !error.response;
}

async function queueMutationIfOffline(endpoint: string, method: "POST" | "PUT" | "PATCH" | "DELETE", payload: unknown) {
  const { enqueueOfflineMutation } = await import("../offline/sync");
  await enqueueOfflineMutation({ endpoint, method, payload });
}

async function requestWithOfflineQueue<T>(
  request: () => Promise<T>,
  fallback: { endpoint: string; method: "POST" | "PUT" | "PATCH" | "DELETE"; payload: unknown }
): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (isNetworkError(error)) {
      await queueMutationIfOffline(fallback.endpoint, fallback.method, fallback.payload);
      return {
        offline_queued: true,
        message: "Operacion encolada para sincronizacion cuando vuelva la conexion.",
      } as T;
    }
    throw error;
  }
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const api = {
  // Inventory
  getProducts: () => apiClient.get<Product[]>("/inventory/").then((res) => res.data),
  createProduct: (data: Omit<Product, "id">) =>
    requestWithOfflineQueue(
      () => apiClient.post<Product>("/inventory/", data).then((res) => res.data),
      { endpoint: "/inventory/", method: "POST", payload: data }
    ),
  updateProduct: (id: string, data: Partial<Product>) =>
    requestWithOfflineQueue(
      () => apiClient.put<Product>(`/inventory/${id}`, data).then((res) => res.data),
      { endpoint: `/inventory/${id}`, method: "PUT", payload: data }
    ),
  deleteProduct: (id: string) => apiClient.delete(`/inventory/${id}`).then((res) => res.data),
  
  // Clients
  getClients: () => apiClient.get<Client[]>("/clients/").then((res) => res.data),
  createClient: (data: Omit<Client, "id">) =>
    requestWithOfflineQueue(
      () => apiClient.post<Client>("/clients/", data).then((res) => res.data),
      { endpoint: "/clients/", method: "POST", payload: data }
    ),
  updateClient: (id: string, data: Partial<Client>) =>
    requestWithOfflineQueue(
      () => apiClient.put<Client>(`/clients/${id}`, data).then((res) => res.data),
      { endpoint: `/clients/${id}`, method: "PUT", payload: data }
    ),
  adjustClientCredit: (id: string, data: CreditAdjustmentPayload) =>
    requestWithOfflineQueue(
      () => apiClient.post(`/clients/${id}/ledger`, data).then((res) => res.data),
      { endpoint: `/clients/${id}/ledger`, method: "POST", payload: data }
    ),
  
  // Sales
  getSales: () => apiClient.get<Sale[]>("/sales/").then((res) => res.data),
  createSale: (data: CreateSalePayload) =>
    requestWithOfflineQueue(
      () => apiClient.post<Sale>("/sales/", data).then((res) => res.data),
      { endpoint: "/sales/", method: "POST", payload: data }
    ),
  
  // Purchase Orders
  getOrders: () => apiClient.get<PurchaseOrder[]>("/orders/").then((res) => res.data),
  createOrder: (data: CreateOrderPayload) =>
    requestWithOfflineQueue(
      () => apiClient.post<PurchaseOrder>("/orders/", data).then((res) => res.data),
      { endpoint: "/orders/", method: "POST", payload: data }
    ),
  updateOrderStatus: (id: string, status: PurchaseOrder["status"]) =>
    requestWithOfflineQueue(
      () =>
        apiClient
          .patch<PurchaseOrder>(`/orders/${id}/status`, { status } satisfies UpdateOrderStatusPayload)
          .then((res) => res.data),
      { endpoint: `/orders/${id}/status`, method: "PATCH", payload: { status } }
    ),
    
  // Reports
  getSalesReport: (from: string, to: string) => 
    apiClient.get(`/reports/sales?date_from=${from}&date_to=${to}`).then((res) => res.data),
  getInventoryReport: () => 
    apiClient.get("/reports/inventory").then((res) => res.data),
    
  // Backups
  getBackups: () => apiClient.get<BackupFile[]>("/backups/").then((res) => res.data),
  triggerBackup: () => apiClient.post("/backups/trigger").then((res) => res.data),

  // Invoices / DIAN config
  getCompanyConfig: () => apiClient.get<CompanyConfig>("/invoices/company-config").then((res) => res.data),
  upsertCompanyConfig: (data: CompanyConfigUpsert) =>
    apiClient.put<CompanyConfig>("/invoices/company-config", data).then((res) => res.data),

  // Offline Sync
  syncBatch: (data: SyncBatchPayload) => apiClient.post("/sync/", data).then((res) => res.data),
  getCurrentUser: () => apiClient.get<CurrentUser>("/auth/users/me").then((res) => res.data),
};
