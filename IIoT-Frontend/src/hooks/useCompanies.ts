import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE, getAuthHeaders } from "@/lib/api";

/**
 * Fetch the list of companies (tenants). Unscoped — used both for label
 * lookups (e.g. resolving a project's company_id to a display name) and
 * as the table data source on the Master Admin "Companies" tab.
 */
export function useCompanies(options?: { refetchInterval?: number; enabled?: boolean }) {
  return useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/companies/`, {
        method: "GET",
        cache: "no-store",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Gagal mengambil data companies dari FastAPI");

      const result = await res.json();
      return (result.data ?? []) as any[];
    },
    // Companies change rarely — safe to keep fresh longer than alarms/gateways.
    staleTime: 30_000,
    refetchInterval: options?.refetchInterval,
    enabled: options?.enabled,
  });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; address: string; invitation_code: string }) => {
      const res = await fetch(`${API_BASE}/companies/`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const resData = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(resData?.detail ?? "Gagal menyimpan organisasi baru.");
      return resData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      const res = await fetch(`${API_BASE}/companies/${payload.id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const resData = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(resData?.detail ?? "Gagal memperbarui data ke database.");
      return resData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}

export function useDeleteCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: any) => {
      const res = await fetch(`${API_BASE}/companies/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      const resData = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(resData?.detail ?? "Gagal menghapus.");
      return resData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}