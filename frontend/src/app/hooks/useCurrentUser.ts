/**
 * Fase 1.2: perfil del usuario autenticado vía /auth/users/me y clave access_token unificada.
 */
import { useQuery } from "@tanstack/react-query";
import { api, getAccessToken } from "../api/client";

export function useCurrentUser() {
  const hasToken = typeof window !== "undefined" && !!getAccessToken();
  return useQuery({
    queryKey: ["currentUser"],
    queryFn: api.getCurrentUser,
    enabled: hasToken,
    retry: false,
  });
}
