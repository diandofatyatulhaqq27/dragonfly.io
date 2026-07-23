import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE, getAuthHeaders, getAuthHeadersMultipart } from "@/lib/api";

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

export function useCreateGateway() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      hmi_code: string | null;
      name: string;
      project_id: number;
      status: string;
    }) => {
      const res = await fetch(`${API_BASE}/gateways/`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.detail ?? "Gagal mendaftarkan gateway.");
      }

      return res.json();
    },
    onSuccess: () => {
      // Invalidates every ["gateways", ...] cache bucket regardless of
      // which company_id key it was stored under.
      queryClient.invalidateQueries({ queryKey: ["gateways"] });
    },
  });
}

export function useUpdateGateway() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: Record<string, any> }) => {
      const res = await fetch(`${API_BASE}/gateways/${id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Gagal memperbarui hardware.");

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gateways"] });
    },
  });
}

export function useDeleteGateway() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_BASE}/gateways/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error("Gagal menghapus gateway.");

      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gateways"] });
    },
  });
}

/** slot: "chiller" | "hmi" */
export function useUploadGatewayImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, slot, file }: { id: number; slot: "chiller" | "hmi"; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE}/gateways/${id}/image/${slot}`, {
        method: "POST",
        headers: getAuthHeadersMultipart(),
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.detail ?? "Gagal upload gambar.");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gateways"] });
      queryClient.invalidateQueries({ queryKey: ["gateway"] });
    },
  });
}

export function useDeleteGatewayImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, slot }: { id: number; slot: "chiller" | "hmi" }) => {
      const res = await fetch(`${API_BASE}/gateways/${id}/image/${slot}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error("Gagal menghapus gambar.");

      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gateways"] });
      queryClient.invalidateQueries({ queryKey: ["gateway"] });
    },
  });
}