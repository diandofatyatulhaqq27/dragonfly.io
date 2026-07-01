import { useQuery } from "@tanstack/react-query";
import { API_BASE, getAuthHeaders } from "@/lib/api";

/**
 * Fetch the list of gateways, optionally scoped to a single company.
 *
 * Query key includes companyId so that a company-scoped user and an
 * admin/operator (who sees all companies) never share the wrong cache
 * bucket, and switching users/companies doesn't leak stale data.
 *
 * Pass `undefined` (or omit) for companyId to fetch all gateways
 * (used by admin / rasindo_operator / rasindo_user roles).
 */
export function useGateways(companyId?: string, options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: ["gateways", companyId ?? "all"],
    queryFn: async () => {
      const url = companyId
        ? `${API_BASE}/gateways/?company_id=${companyId}`
        : `${API_BASE}/gateways/`;

      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Gagal menarik data gateway dari server.");

      const result = await res.json();
      return (result.data ?? []) as any[];
    },
    // Gateways don't change every second — keep them "fresh" for 30s so
    // navigating between pages that both use gateways doesn't refetch
    // unnecessarily, while still staying reasonably up to date.
    staleTime: 30_000,
    // Optional live polling (e.g. dashboard wants updates every 10s).
    // Omit this option on pages that don't need it.
    refetchInterval: options?.refetchInterval,
  });
}