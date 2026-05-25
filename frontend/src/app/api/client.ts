/**
 * Fase 1.2: cliente HTTP único con tokens access_token/refresh_token e interceptores 401.
 */
import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import type {
  Client,
  Product,
  PurchaseOrder,
  Sale,
  Supplier,
  Vehicle,
  WorkOrder,
  ServiceTemplate,
} from "../lib/store";

export const ACCESS_TOKEN_KEY = "access_token";
export const REFRESH_TOKEN_KEY = "refresh_token";

const API_ROOT = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export function getAccessToken(): string | null {
  return (
    localStorage.getItem(ACCESS_TOKEN_KEY) ||
    localStorage.getItem("token")
  );
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setAuthTokens(accessToken: string, refreshToken?: string | null): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.removeItem("token");
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

export function clearAuthTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem("token");
}

export interface LoginTokenResponse {
  access_token: string;
  token_type: string;
  role: string;
  refresh_token?: string;
}

const authClient = axios.create({
  baseURL: API_ROOT,
  headers: {
    "Content-Type": "application/json",
  },
});

let refreshInFlight: Promise<boolean> | null = null;
let authSessionVersion = 0;

function invalidateAuthSession(): void {
  authSessionVersion += 1;
  refreshInFlight = null;
}

export async function loginWithCredentials(
  username: string,
  password: string
): Promise<LoginTokenResponse> {
  const form = new URLSearchParams();
  form.append("username", username);
  form.append("password", password);
  const { data } = await authClient.post<LoginTokenResponse>(
    "/auth/token-with-refresh",
    form,
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  setAuthTokens(data.access_token, data.refresh_token ?? null);
  return data;
}

export async function refreshAuthSession(): Promise<boolean> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return false;
  }

  const sessionVersion = authSessionVersion;

  refreshInFlight = authClient
    .post<LoginTokenResponse>("/auth/refresh", {
      refresh_token: refreshToken,
    })
    .then(({ data }) => {
      if (sessionVersion !== authSessionVersion) {
        return false;
      }
      setAuthTokens(data.access_token, data.refresh_token ?? refreshToken);
      return true;
    })
    .catch(() => {
      if (sessionVersion === authSessionVersion) {
        clearAuthTokens();
      }
      return false;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

export async function logoutSession(): Promise<void> {
  const refreshToken = getRefreshToken();
  invalidateAuthSession();
  try {
    if (refreshToken) {
      await authClient.post("/auth/logout", { refresh_token: refreshToken });
    }
  } finally {
    clearAuthTokens();
  }
}

let isRedirectingToLogin = false;

function redirectToLogin(): void {
  if (isRedirectingToLogin || window.location.pathname === "/login") {
    return;
  }
  isRedirectingToLogin = true;
  invalidateAuthSession();
  clearAuthTokens();
  window.location.href = "/login";
}

export interface CreditAdjustmentPayload {
  amount: number;
  description: string;
}

export interface CreateSalePayload extends Omit<Sale, "id"> {}

export interface ApiSaleItemIn {
  product_id: number;
  quantity: number;
  unit_price: number;
}

export interface ApiSaleCreatePayload {
  offline_id?: string | null;
  client_id?: number | null;
  date: string;
  items: ApiSaleItemIn[];
  discount_pct: number;
  payment_method: string;
  expected_total: number;
}

export interface ApiClientRaw {
  id: number;
  name: string;
  phone: string;
  motorcycle_model: string;
  last_service_date?: string | null;
  oil_change_interval_km: number;
  current_km: number;
  credit_limit: number;
  credit_balance: number;
}

export function mapClientFromApi(raw: ApiClientRaw): Client {
  return {
    id: String(raw.id),
    name: raw.name,
    phone: raw.phone,
    motorcycleModel: raw.motorcycle_model,
    lastServiceDate: raw.last_service_date ?? "",
    oilChangeIntervalKm: raw.oil_change_interval_km,
    currentKm: raw.current_km,
    creditLimit: raw.credit_limit,
    creditBalance: raw.credit_balance,
  };
}

export function mapClientToApiPayload(data: Partial<Omit<Client, "id">>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.phone !== undefined) payload.phone = data.phone;
  if (data.motorcycleModel !== undefined) payload.motorcycle_model = data.motorcycleModel;
  if (data.lastServiceDate !== undefined) {
    payload.last_service_date = data.lastServiceDate || null;
  }
  if (data.oilChangeIntervalKm !== undefined) {
    payload.oil_change_interval_km = data.oilChangeIntervalKm;
  }
  if (data.currentKm !== undefined) payload.current_km = data.currentKm;
  if (data.creditLimit !== undefined) payload.credit_limit = data.creditLimit;
  if (data.creditBalance !== undefined) payload.credit_balance = data.creditBalance;
  return payload;
}

export interface ApiSaleItemRaw {
  product_id: number;
  quantity: number;
  unit_price: number;
}

export interface ApiSaleRaw {
  id: number;
  offline_id?: string | null;
  client_id?: number | null;
  date: string;
  total: number;
  payment_method: string;
  items: ApiSaleItemRaw[];
}

export function mapSaleFromApi(raw: ApiSaleRaw): Sale {
  const sale: Sale = {
    id: String(raw.id),
    offlineId: raw.offline_id || undefined,
    date: raw.date,
    total: raw.total,
    paymentMethod: raw.payment_method as Sale["paymentMethod"],
    items: raw.items.map((item) => ({
      productId: String(item.product_id),
      quantity: item.quantity,
      price: item.unit_price,
    })),
  };
  if (raw.client_id != null) {
    sale.clientId = String(raw.client_id);
  }
  return sale;
}

export interface ApiOrderItemRaw {
  id?: number;
  product_id: number;
  quantity: number;
  unit_cost: number;
}

export interface ApiOrderRaw {
  id: number;
  supplier: string;
  supplier_id?: number | null;
  status: string;
  date: string;
  total: number;
  notes?: string;
  items: ApiOrderItemRaw[];
}

export function mapOrderFromApi(raw: ApiOrderRaw): PurchaseOrder {
  return {
    id: String(raw.id),
    supplierId: raw.supplier_id != null ? String(raw.supplier_id) : raw.supplier,
    items: (raw.items ?? []).map((item) => ({
      productId: String(item.product_id),
      quantity: item.quantity,
      cost: item.unit_cost,
    })),
    status: raw.status as PurchaseOrder["status"],
    date: String(raw.date).slice(0, 10),
    total: raw.total,
  };
}

export interface ApiSupplierRaw {
  id: number;
  name: string;
  contact_name: string;
  phone: string;
  email: string;
  address: string;
  rating: number;
  is_active: boolean;
}

export function mapSupplierFromApi(raw: ApiSupplierRaw): Supplier {
  return {
    id: String(raw.id),
    name: raw.name,
    contactName: raw.contact_name,
    phone: raw.phone,
    email: raw.email,
    address: raw.address,
    rating: raw.rating,
    isActive: raw.is_active,
  };
}

export function mapSupplierToApi(
  data: Omit<Supplier, "id">
): Record<string, unknown> {
  return {
    name: data.name,
    contact_name: data.contactName,
    phone: data.phone,
    email: data.email,
    address: data.address,
    rating: data.rating,
    is_active: data.isActive,
  };
}

export interface ApiServiceTemplateRaw {
  id: number;
  name: string;
  description: string;
  estimated_price: number;
  estimated_hours: number;
  is_active: boolean;
}

export function mapServiceTemplateFromApi(raw: ApiServiceTemplateRaw): ServiceTemplate {
  return {
    id: String(raw.id),
    name: raw.name,
    description: raw.description,
    estimatedPrice: raw.estimated_price,
    estimatedHours: raw.estimated_hours,
  };
}

export interface ApiVehicleRaw {
  id: number;
  client_id: number;
  brand: string;
  model: string;
  year: number;
  plate: string;
}

export function mapVehicleFromApi(raw: ApiVehicleRaw): Vehicle {
  return {
    id: String(raw.id),
    clientId: String(raw.client_id),
    brand: raw.brand,
    model: raw.model,
    year: raw.year,
    plate: raw.plate,
  };
}

export function mapVehicleToApi(data: Omit<Vehicle, "id">): Record<string, unknown> {
  return {
    client_id: Number(data.clientId),
    brand: data.brand,
    model: data.model,
    year: data.year,
    plate: data.plate,
  };
}

export interface ApiWorkOrderRaw {
  id: number;
  vehicle_id: number;
  status: string;
  scheduled_date: string;
  notes: string;
  service_ids: number[];
}

export function mapWorkOrderFromApi(raw: ApiWorkOrderRaw): WorkOrder {
  return {
    id: String(raw.id),
    vehicleId: String(raw.vehicle_id),
    status: raw.status as WorkOrder["status"],
    scheduledDate: String(raw.scheduled_date).slice(0, 10),
    serviceIds: (raw.service_ids ?? []).map(String),
    notes: raw.notes ?? "",
  };
}

export function mapWorkOrderToApi(data: {
  vehicleId: string;
  scheduledDate: string;
  serviceIds: string[];
  notes?: string;
}): Record<string, unknown> {
  return {
    vehicle_id: Number(data.vehicleId),
    scheduled_date: data.scheduledDate,
    service_ids: data.serviceIds.map(Number),
    notes: data.notes ?? "",
  };
}

export function mapOrderToApiPayload(data: {
  supplier: string;
  supplierId?: string;
  date: string;
  items: { productId: string; quantity: number; cost: number }[];
  notes?: string;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    supplier: data.supplier,
    date: data.date,
    items: data.items.map((item) => ({
      product_id: Number(item.productId),
      quantity: item.quantity,
      unit_cost: item.cost,
    })),
    notes: data.notes ?? "",
  };
  if (data.supplierId && /^\d+$/.test(data.supplierId)) {
    payload.supplier_id = Number(data.supplierId);
  }
  return payload;
}

export interface SalesReportRow {
  product_id: number;
  product_name: string;
  category: string;
  quantity_sold: number;
  revenue: number;
  cost: number;
  profit: number;
}

export interface SalesReport {
  date_from: string;
  date_to: string;
  total_revenue: number;
  total_cost: number;
  total_profit: number;
  total_transactions: number;
  average_ticket: number;
  rows: SalesReportRow[];
}

export interface InventoryReportRow {
  product_id: number;
  product_name: string;
  category: string;
  brand: string;
  stock: number;
  cost_price: number;
  stock_value: number;
  status: string;
}

export interface InventoryReport {
  total_products: number;
  total_units: number;
  total_stock_value: number;
  rows: InventoryReportRow[];
}

export function mapSaleToApiPayload(
  data: CreateSalePayload,
  discountPct: number
): ApiSaleCreatePayload {
  return {
    offline_id: data.offlineId || null,
    client_id: data.clientId ? Number(data.clientId) : null,
    date: data.date.slice(0, 10),
    items: data.items.map((item) => ({
      product_id: Number(item.productId),
      quantity: item.quantity,
      unit_price: item.price,
    })),
    discount_pct: discountPct,
    payment_method: data.paymentMethod,
    expected_total: data.total,
  };
}
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

/** Respuesta cruda de la API de inventario (snake_case). */
export interface ApiProductRaw {
  id: number;
  code: string;
  name: string;
  category: string;
  brand: string;
  barcode?: string | null;
  supplier?: string | null;
  stock: number;
  sale_price: number;
  cost_price: number;
  reorder_threshold: number;
}

export function mapProductFromApi(raw: ApiProductRaw): Product {
  const mapped: Product = {
    id: String(raw.id),
    code: raw.code,
    name: raw.name,
    category: raw.category,
    brand: raw.brand,
    stock: raw.stock,
    salePrice: raw.sale_price,
    costPrice: raw.cost_price,
    reorderThreshold: raw.reorder_threshold,
  };
  if (raw.barcode) {
    mapped.barcode = raw.barcode;
  }
  return mapped;
}

export function mapProductToApiPayload(data: Partial<Product>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (data.code !== undefined) payload.code = data.code;
  if (data.name !== undefined) payload.name = data.name;
  if (data.category !== undefined) payload.category = data.category;
  if (data.brand !== undefined) payload.brand = data.brand;
  if (data.stock !== undefined) payload.stock = data.stock;
  if (data.salePrice !== undefined) payload.sale_price = data.salePrice;
  if (data.costPrice !== undefined) payload.cost_price = data.costPrice;
  if (data.reorderThreshold !== undefined) payload.reorder_threshold = data.reorderThreshold;
  if (data.barcode !== undefined) payload.barcode = data.barcode;
  return payload;
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
  baseURL: API_ROOT,
  headers: {
    "Content-Type": "application/json",
  },
});

const authBypassPaths = new Set([
  "/auth/token",
  "/auth/token-with-refresh",
  "/auth/refresh",
  "/auth/logout",
]);

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
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

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthRequest) {
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
    if (error.response?.status === 401 && !isAuthRequest) {
      redirectToLogin();
    }
    return Promise.reject(error);
  }
);

export const api = {
  // Inventory
  getProducts: () =>
    apiClient
      .get<ApiProductRaw[]>("/inventory/")
      .then((res) => res.data.map(mapProductFromApi)),
  createProduct: (data: Omit<Product, "id">) =>
    requestWithOfflineQueue(
      () =>
        apiClient
          .post<ApiProductRaw>("/inventory/", mapProductToApiPayload(data))
          .then((res) => mapProductFromApi(res.data)),
      { endpoint: "/inventory/", method: "POST", payload: mapProductToApiPayload(data) }
    ),
  updateProduct: (id: string, data: Partial<Product>) =>
    requestWithOfflineQueue(
      () =>
        apiClient
          .put<ApiProductRaw>(`/inventory/${id}`, mapProductToApiPayload(data))
          .then((res) => mapProductFromApi(res.data)),
      { endpoint: `/inventory/${id}`, method: "PUT", payload: mapProductToApiPayload(data) }
    ),
  deleteProduct: (id: string) => apiClient.delete(`/inventory/${id}`).then((res) => res.data),
  generateBarcode: (productId: number) =>
    apiClient
      .post<ApiProductRaw>(`/inventory/${productId}/generate-barcode`)
      .then((res) => mapProductFromApi(res.data)),
  bulkGenerateBarcodes: () =>
    apiClient
      .post<ApiProductRaw[]>("/inventory/bulk-generate-barcodes")
      .then((res) => res.data.map(mapProductFromApi)),
  
  // Clients
  getClients: () =>
    apiClient
      .get<ApiClientRaw[]>("/clients/")
      .then((res) => res.data.map(mapClientFromApi)),
  createClient: (data: Omit<Client, "id">) =>
    requestWithOfflineQueue(
      () =>
        apiClient
          .post<ApiClientRaw>("/clients/", mapClientToApiPayload(data))
          .then((res) => mapClientFromApi(res.data)),
      { endpoint: "/clients/", method: "POST", payload: mapClientToApiPayload(data) }
    ),
  updateClient: (id: string, data: Partial<Client>) =>
    requestWithOfflineQueue(
      () =>
        apiClient
          .put<ApiClientRaw>(`/clients/${id}`, mapClientToApiPayload(data))
          .then((res) => mapClientFromApi(res.data)),
      { endpoint: `/clients/${id}`, method: "PUT", payload: mapClientToApiPayload(data) }
    ),
  adjustClientCredit: (id: string, data: CreditAdjustmentPayload) =>
    requestWithOfflineQueue(
      () => apiClient.post(`/clients/${id}/ledger`, data).then((res) => res.data),
      { endpoint: `/clients/${id}/ledger`, method: "POST", payload: data }
    ),
  
  // Sales
  getSales: () =>
    apiClient
      .get<ApiSaleRaw[]>("/sales/")
      .then((res) => res.data.map(mapSaleFromApi)),
  createSale: (data: CreateSalePayload, discountPct = 0) =>
    requestWithOfflineQueue(
      () =>
        apiClient
          .post<ApiSaleRaw>("/sales/", mapSaleToApiPayload(data, discountPct))
          .then((res) => {
            const sale: Sale = {
              id: String(res.data.id),
              offlineId: res.data.offline_id || undefined,
              date: String(res.data.date),
              items: res.data.items.map((item) => ({
                productId: String(item.product_id),
                quantity: item.quantity,
                price: item.unit_price,
              })),
              total: res.data.total,
              paymentMethod: res.data.payment_method as Sale["paymentMethod"],
            };
            if (res.data.client_id != null) sale.clientId = String(res.data.client_id);
            return sale;
          }),
      {
        endpoint: "/sales/",
        method: "POST",
        payload: mapSaleToApiPayload(data, discountPct),
      }
    ),
  
  // Purchase Orders
  getOrders: () =>
    apiClient
      .get<ApiOrderRaw[]>("/orders/")
      .then((res) => res.data.map(mapOrderFromApi)),
  getSuppliers: () =>
    apiClient.get<ApiSupplierRaw[]>("/suppliers/").then((res) => res.data.map(mapSupplierFromApi)),
  createSupplier: (data: Omit<Supplier, "id">) =>
    apiClient
      .post<ApiSupplierRaw>("/suppliers/", mapSupplierToApi(data))
      .then((res) => mapSupplierFromApi(res.data)),
  updateSupplier: (id: string, data: Partial<Supplier>) => {
    const body: Record<string, unknown> = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.contactName !== undefined) body.contact_name = data.contactName;
    if (data.phone !== undefined) body.phone = data.phone;
    if (data.email !== undefined) body.email = data.email;
    if (data.address !== undefined) body.address = data.address;
    if (data.rating !== undefined) body.rating = data.rating;
    if (data.isActive !== undefined) body.is_active = data.isActive;
    return apiClient
      .put<ApiSupplierRaw>(`/suppliers/${id}`, body)
      .then((res) => mapSupplierFromApi(res.data));
  },

  getServiceTemplates: () =>
    apiClient
      .get<ApiServiceTemplateRaw[]>("/workshop/service-templates")
      .then((res) => res.data.map(mapServiceTemplateFromApi)),
  getVehicles: (clientId?: string) =>
    apiClient
      .get<ApiVehicleRaw[]>("/workshop/vehicles", {
        params: clientId ? { client_id: Number(clientId) } : undefined,
      })
      .then((res) => res.data.map(mapVehicleFromApi)),
  createVehicle: (data: Omit<Vehicle, "id">) =>
    apiClient
      .post<ApiVehicleRaw>("/workshop/vehicles", mapVehicleToApi(data))
      .then((res) => mapVehicleFromApi(res.data)),
  getWorkOrders: () =>
    apiClient
      .get<ApiWorkOrderRaw[]>("/workshop/work-orders")
      .then((res) => res.data.map(mapWorkOrderFromApi)),
  createWorkOrder: (data: {
    vehicleId: string;
    scheduledDate: string;
    serviceIds: string[];
    notes?: string;
  }) =>
    apiClient
      .post<ApiWorkOrderRaw>("/workshop/work-orders", mapWorkOrderToApi(data))
      .then((res) => mapWorkOrderFromApi(res.data)),
  updateWorkOrderStatus: (id: string, status: WorkOrder["status"]) =>
    apiClient
      .patch<ApiWorkOrderRaw>(`/workshop/work-orders/${id}/status`, { status })
      .then((res) => mapWorkOrderFromApi(res.data)),

  createOrder: (data: {
    supplier: string;
    supplierId?: string;
    date: string;
    items: { productId: string; quantity: number; cost: number }[];
    notes?: string;
  }) =>
    requestWithOfflineQueue(
      () =>
        apiClient
          .post<ApiOrderRaw>("/orders/", mapOrderToApiPayload(data))
          .then((res) => mapOrderFromApi(res.data)),
      { endpoint: "/orders/", method: "POST", payload: mapOrderToApiPayload(data) }
    ),
  updateOrderStatus: (id: string, status: PurchaseOrder["status"]) =>
    requestWithOfflineQueue(
      () =>
        apiClient
          .patch<ApiOrderRaw>(`/orders/${id}/status`, { status } satisfies UpdateOrderStatusPayload)
          .then((res) => mapOrderFromApi(res.data)),
      { endpoint: `/orders/${id}/status`, method: "PATCH", payload: { status } }
    ),

  // Reports
  getSalesReport: (from: string, to: string) =>
    apiClient
      .get<SalesReport>(`/reports/sales?date_from=${from}&date_to=${to}`)
      .then((res) => res.data),
  getInventoryReport: () =>
    apiClient.get<InventoryReport>("/reports/inventory").then((res) => res.data),
    
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

  // 2FA (Fase B)
  get2FAStatus: () =>
    apiClient
      .get<{
        enabled: boolean;
        backup_codes_remaining: number;
        can_setup_2fa?: boolean;
        enabled_at?: string | null;
      }>("/2fa/status")
      .then((res) => res.data),
  enable2FA: () =>
    apiClient
      .post<{
        success: boolean;
        message: string;
        data: { qr_code: string; backup_codes: string[]; instructions: string };
      }>("/2fa/enable")
      .then((res) => res.data),
  verify2FA: (token: string) =>
    apiClient
      .post<{ success: boolean; message: string }>("/2fa/verify", { token })
      .then((res) => res.data),
  disable2FA: () =>
    apiClient
      .post<{ success: boolean; message: string }>("/2fa/disable")
      .then((res) => res.data),
  regenerateBackupCodes: () =>
    apiClient
      .post<{ success: boolean; data: { backup_codes: string[] } }>(
        "/2fa/regenerate-backup-codes"
      )
      .then((res) => res.data),
};
