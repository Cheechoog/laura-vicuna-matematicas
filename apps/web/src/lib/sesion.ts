import type { Sesion } from "@lv/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "./api";

export const CLAVE_SESION = ["sesion"] as const;

/** Sesión actual; `null` si nadie ha ingresado. */
export function useSesion() {
  return useQuery({
    queryKey: CLAVE_SESION,
    queryFn: async () => {
      try {
        return await api.get<Sesion>("/auth/sesion");
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSalir() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<void>("/auth/salir"),
    onSuccess: () => {
      qc.clear();
      qc.setQueryData(CLAVE_SESION, null);
    },
  });
}
