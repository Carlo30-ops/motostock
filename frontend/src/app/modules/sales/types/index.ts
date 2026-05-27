import { Product, Client, Sale } from "@/lib/store";

export interface CartItem {
  product: Product;
  quantity: number;
  isCombo?: boolean;
}

export interface SaleReceipt {
  saleId: string;
  date: Date;
  client: Client | null;
  items: CartItem[];
  subtotal: number;
  discountAmount: number;
  ivaAmount: number;
  total: number;
  paymentMethod: Sale["paymentMethod"];
  received: number;
  vuelto: number;
}

export interface AuthMeResponse {
  role: string;
}

export type PaymentMethod = "cash" | "card" | "credit" | "nequi";
