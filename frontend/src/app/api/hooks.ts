import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, CreditAdjustmentPayload, CompanyConfigUpsert } from "./client";
import type { Client, Product, PurchaseOrder } from "../lib/store";

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: api.getProducts,
  });
}

export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: api.getClients,
  });
}

export function useSales() {
  return useQuery({
    queryKey: ["sales"],
    queryFn: api.getSales,
  });
}

export function useOrders() {
  return useQuery({
    queryKey: ["orders"],
    queryFn: api.getOrders,
  });
}

export function useInventoryReport() {
  return useQuery({
    queryKey: ["inventoryReport"],
    queryFn: api.getInventoryReport,
  });
}

export function useSalesReport(from: string, to: string) {
  return useQuery({
    queryKey: ["salesReport", from, to],
    queryFn: () => api.getSalesReport(from, to),
    enabled: !!from && !!to,
  });
}

export function useBackups() {
  return useQuery({
    queryKey: ["backups"],
    queryFn: api.getBackups,
  });
}

export function useCompanyConfig() {
  return useQuery({
    queryKey: ["companyConfig"],
    queryFn: api.getCompanyConfig,
  });
}

// Mutations
export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createProduct,
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

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createClient,
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useCreateSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createSale,
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
    mutationFn: api.createOrder,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: PurchaseOrder["status"] }) => api.updateOrderStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useTriggerBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.triggerBackup,
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
