import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

export function useCurrentUser() {
  const hasToken = typeof window !== "undefined" && !!localStorage.getItem("token");
  return useQuery({
    queryKey: ["currentUser"],
    queryFn: api.getCurrentUser,
    enabled: hasToken,
    retry: false,
  });
}
