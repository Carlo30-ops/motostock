import axios from "axios";
import { Sale } from "@/lib/store";

export const salesService = {
  createSale: async (sale: Omit<Sale, "id">, discountPercent: number) => {
    // This usually matches what useCreateSale hook does, but we keep it here for modularity
    // if we want to move away from global hooks.
    const response = await axios.post("/sales", { ...sale, discountPercent });
    return response.data;
  },

  apiErrorMessage: (error: unknown): string => {
    if (axios.isAxiosError(error)) {
      const detail = error.response?.data;
      if (typeof detail === "object" && detail !== null && "detail" in detail) {
        return String((detail as { detail: unknown }).detail);
      }
      return error.message;
    }
    if (error instanceof Error) return error.message;
    return "Error desconocido";
  }
};
