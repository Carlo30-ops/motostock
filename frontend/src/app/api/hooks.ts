/** Hooks React Query para la API; Fase 2 añade useDeleteProduct para inventario. */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, CreateSalePayload, CreditAdjustmentPayload, CompanyConfigUpsert } from "./client";
import type { Client, Product, PurchaseOrder, Supplier, WorkOrder } from "../lib/store";

export function useProducts() {
  return useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: api.getProducts,
  });
}

export function useClients() {
  return useQuery<Client[]>({
    queryKey: ["clients"],
    queryFn: api.getClients,
  });
}

export function useSales() {
  return useQuery<any[]>({
    queryKey: ["sales"],
    queryFn: api.getSales,
  });
}

export function useOrders() {
  return useQuery<PurchaseOrder[]>({
    queryKey: ["orders"],
    queryFn: api.getPurchaseOrders,
  });
}

export function useInventoryReport() {
  return useQuery<any>({
    queryKey: ["inventoryReport"],
    queryFn: api.getInventoryReport,
  });
}

export function useSalesReport(from: string, to: string) {
  return useQuery<any>({
    queryKey: ["salesReport", from, to],
    queryFn: () => api.getSalesReport(from, to),
    enabled: !!from && !!to,
  });
}

export function useBackups() {
  return useQuery<any[]>({
    queryKey: ["backups"],
    queryFn: api.getBackups,
  });
}

export function useCompanyConfig() {
  return useQuery<any>({
    queryKey: ["companyConfig"],
    queryFn: api.getCompanyConfig,
  });
}

// Mutations
export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.createProduct(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Product> }) => api.updateProduct(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteProduct(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.createClient(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Client> }) => api.updateClient(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useAdjustClientCredit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreditAdjustmentPayload }) => 
      api.adjustClientCredit(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
    },
  });
}

export function useCreateSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ data, discountPct }: { data: CreateSalePayload; discountPct?: number }) =>
      api.createSale(data, discountPct ?? 0),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.createPurchaseOrder(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });
}

export function useOrder(id: string) {
  return useQuery<PurchaseOrder>({
    queryKey: ["orders", id],
    queryFn: () => api.getPurchaseOrder(id),
    enabled: !!id,
  });
}

export function useSubmitOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.submitPurchaseOrder(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders", id] });
    },
  });
}

export function useApproveOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.approvePurchaseOrder(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders", id] });
    },
  });
}

export function useRejectOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => api.rejectPurchaseOrder(id, notes),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders", id] });
    },
  });
}

export function useMarkAsOrdered() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.markPurchaseOrderAsOrdered(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders", id] });
    },
  });
}

export function useReceiveItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, items }: { id: string; items: { productId: string; quantity: number }[] }) =>
      api.receivePurchaseOrder(id, items),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders", id] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.cancelPurchaseOrder(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders", id] });
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: PurchaseOrder["status"] }) => api.updatePurchaseOrderStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useTriggerBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.triggerBackup(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["backups"] }),
  });
}

export function useUpsertCompanyConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CompanyConfigUpsert) => api.upsertCompanyConfig(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["companyConfig"] }),
  });
}

export function useSuppliers() {
  return useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: api.getSuppliers,
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.createSupplier(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["suppliers"] }),
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Supplier> }) =>
      api.updateSupplier(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["suppliers"] }),
  });
}

export function useServiceTemplates() {
  return useQuery<any[]>({
    queryKey: ["serviceTemplates"],
    queryFn: api.getServiceTemplates,
  });
}

export function useVehicles() {
  return useQuery<any[]>({
    queryKey: ["vehicles"],
    queryFn: () => api.getVehicles(),
  });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.createVehicle(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vehicles"] }),
  });
}

export function useWorkOrders() {
  return useQuery<WorkOrder[]>({
    queryKey: ["workOrders"],
    queryFn: api.getWorkOrders,
  });
}

export function useCreateWorkOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.createWorkOrder(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workOrders"] }),
  });
}

export function useUpdateWorkOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: WorkOrder["status"] }) =>
      api.updateWorkOrderStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workOrders"] }),
  });
}

export function use2FAStatus() {
  return useQuery<any>({
    queryKey: ["2faStatus"],
    queryFn: api.getTOTPStatus,
  });
}

export function useEnable2FA() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.setupTOTP(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["2faStatus"] }),
  });
}

export function useVerify2FA() {
  return useMutation({
    mutationFn: (token: string) => api.verifyTOTP(token),
  });
}

export function useDisable2FA() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code?: string) => api.disableTOTP(code || ""),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["2faStatus"] }),
  });
}

export function useRegenerateBackupCodes() {
  return useMutation({
    mutationFn: () => api.regenerateBackupCodes(),
  });
}

// Owner Hooks
export function useOwnerDashboard() {
  return useQuery<any>({
    queryKey: ["ownerDashboard"],
    queryFn: api.getOwnerDashboard,
    staleTime: 0, // No cache as requested
  });
}

export function useFinancialAudit(params: any) {
  return useQuery<any[]>({
    queryKey: ["financialAudit", params],
    queryFn: () => api.getFinancialAudit(params),
    staleTime: 0,
  });
}

export function useOwnerSalesHistory(params: any) {
  return useQuery<any[]>({
    queryKey: ["ownerSalesHistory", params],
    queryFn: () => api.getOwnerSalesHistory(params),
    staleTime: 0,
  });
}

export function useOwnerInventoryMovements() {
  return useQuery<any[]>({
    queryKey: ["ownerInventoryMovements"],
    queryFn: api.getOwnerInventoryMovements,
    staleTime: 0,
  });
}

export function useProfitability(params: any) {
  return useQuery<any>({
    queryKey: ["profitability", params],
    queryFn: () => api.getProfitability(params),
    staleTime: 0,
  });
}
