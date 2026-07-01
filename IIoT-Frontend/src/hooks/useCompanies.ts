import { useQuery } from "@tanstack/react-query";
import { API_BASE, getAuthHeaders } from "@/lib/api";

/**
 * Fetch the list of companies (tenants). Unscoped — used for label
 * lookups (e.g. resolving a project's company_id to a display name).
 */
export function useCompanies(options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/companies/`, {
        method: "GET",
        cache: "no-store",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Gagal menarik data perusahaan dari server.");

      const result = await res.json();
      return (result.data ?? []) as any[];
    },
    // Companies change rarely — safe to keep fresh longer than alarms/gateways.
    staleTime: 30_000,
    refetchInterval: options?.refetchInterval,
  });
}