import { Product } from "@/lib/store";

export type InventoryFormData = Omit<Product, "id" | "branchId" | "barcode" | "supplier"> & {
  code: string;
};

export interface StockStatus {
  variant: "destructive" | "warning" | "success";
  label: string;
}
