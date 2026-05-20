import { create } from "zustand";
import { Product } from "./store";

interface CartItem {
  product: Product;
  quantity: number;
}

interface AppState {
  // Sales Cart
  cart: CartItem[];
  addToCart: (product: Product) => void;
  updateQuantity: (productId: string, delta: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  cart: [],
  
  addToCart: (product) => set((state) => {
    const existing = state.cart.find((item) => item.product.id === product.id);
    if (existing) {
      if (existing.quantity < product.stock) {
        return {
          cart: state.cart.map((item) =>
            item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
          ),
        };
      }
      return state;
    }
    return { cart: [...state.cart, { product, quantity: 1 }] };
  }),
  
  updateQuantity: (productId, delta) => set((state) => ({
    cart: state.cart.map((item) => {
      if (item.product.id === productId) {
        const newQuantity = item.quantity + delta;
        if (newQuantity <= 0 || newQuantity > item.product.stock) return item;
        return { ...item, quantity: newQuantity };
      }
      return item;
    }),
  })),
  
  removeFromCart: (productId) => set((state) => ({
    cart: state.cart.filter((item) => item.product.id !== productId),
  })),
  
  clearCart: () => set({ cart: [] }),
}));
