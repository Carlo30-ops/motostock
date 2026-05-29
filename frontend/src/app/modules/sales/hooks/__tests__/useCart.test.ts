import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useCart } from "../useCart";
import { Product } from "@/lib/store";

// Mock useAuth
vi.mock("@/lib/auth-rbac", () => ({
  useAuth: vi.fn(() => ({
    user: { role: "admin" }
  }))
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    warning: vi.fn(),
    error: vi.fn(),
    success: vi.fn()
  }
}));

const mockProduct: Product = {
  id: "1",
  code: "P1",
  name: "Product 1",
  category: "cat1",
  brand: "brand1",
  stock: 10,
  salePrice: 1000,
  costPrice: 500,
  reorderThreshold: 2
};

describe("useCart", () => {
  it("should add a product to the cart", () => {
    const { result } = renderHook(() => useCart());
    
    act(() => {
      result.current.addToCart(mockProduct);
    });
    
    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0]!.product.id).toBe("1");
    expect(result.current.cart[0]!.quantity).toBe(1);
    expect(result.current.total).toBe(1000);
  });

  it("should increase quantity if adding the same product", () => {
    const { result } = renderHook(() => useCart());
    
    act(() => {
      result.current.addToCart(mockProduct);
      result.current.addToCart(mockProduct);
    });
    
    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0]!.quantity).toBe(2);
    expect(result.current.total).toBe(2000);
  });

  it("should calculate volume discount for 5 or more items", () => {
    const { result } = renderHook(() => useCart());
    
    act(() => {
      result.current.addToCart(mockProduct);
    });
    
    act(() => {
      result.current.updateQuantity("1", 5);
    });
    
    // 5 * 1000 * 0.9 = 4500
    expect(result.current.total).toBe(4500);
  });

  it("should apply discount correctly", () => {
    const { result } = renderHook(() => useCart());
    
    act(() => {
      result.current.addToCart(mockProduct);
      result.current.handleDiscountChange(10);
    });
    
    // 1000 - 10% = 900
    expect(result.current.total).toBe(900);
  });

  it("should respect cashier max discount", async () => {
    const { useAuth } = await import("@/lib/auth-rbac");
    (useAuth as any).mockReturnValue({
      user: { role: "cashier", max_discount: 5 }
    });
    
    const { result } = renderHook(() => useCart());
    const { toast } = await import("sonner");
    
    act(() => {
      result.current.handleDiscountChange(10);
    });
    
    expect(result.current.discountPercent).toBe(5);
    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining("5%"));
  });
});
