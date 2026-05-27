import { useState, useMemo, useCallback } from "react";
import { Product, Client } from "@/lib/store";
import { CartItem, PaymentMethod } from "../types";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-rbac";

export function useCart() {
  const { user: currentUser } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [cashReceived, setCashReceived] = useState<number | "">("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const handleDiscountChange = useCallback((val: number) => {
    let finalVal = val;
    if (currentUser?.role === "cashier") {
      const max = (currentUser as any)?.max_discount || 0;
      if (finalVal > max) {
        toast.warning(`Su descuento máximo permitido es ${max}%`);
        finalVal = max;
      }
    }
    setDiscountPercent(finalVal);
  }, [currentUser]);

  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1, isCombo: product.id.startsWith("c") }];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) return;
    setCart((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, quantity } : item))
    );
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setDiscountPercent(0);
    setPaymentMethod("cash");
    setCashReceived("");
    setSelectedClient(null);
  }, []);

  // Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const volumeDiscount = item.quantity >= 5 ? 0.9 : 1;
      return sum + (item.product.salePrice * item.quantity * volumeDiscount);
    }, 0);
  }, [cart]);

  const discountAmount = useMemo(() => (subtotal * discountPercent) / 100, [subtotal, discountPercent]);
  
  const ivaAmount = useMemo(() => {
    return cart.reduce((sum, item) => {
      const taxRate = item.product.taxRate || 0;
      return sum + (item.product.salePrice * item.quantity * (taxRate / 100));
    }, 0);
  }, [cart]);

  const total = useMemo(() => subtotal - discountAmount + ivaAmount, [subtotal, discountAmount, ivaAmount]);

  return {
    cart,
    setCart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    discountPercent,
    handleDiscountChange,
    paymentMethod,
    setPaymentMethod,
    cashReceived,
    setCashReceived,
    selectedClient,
    setSelectedClient,
    subtotal,
    discountAmount,
    ivaAmount,
    total
  };
}
