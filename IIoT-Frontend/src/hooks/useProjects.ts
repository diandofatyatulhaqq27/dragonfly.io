import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE, getAuthHeaders, getLocalUser } from "@/lib/api";

/**
 * Fetch the list of projects.
 *
 * Scoping sekarang konsisten dengan convention isCompanyScoped di halaman
 * alarms/monitoring/dashboard: admin, rasindo_operator, dan rasindo_user
 * semuanya melihat SEMUA project (mereka staff internal Rasindo, bukan
 * tenant klien spesifik). Role lain (client_operator, client_user) di-scope
 * ke company_id mereka sendiri.
 */
export function useProjects(options?: { refetchInterval?: number }) {
  const loggedInUser = getLocalUser();
  const companyId = String(loggedInUser?.company_id ?? "");
  const userRole = loggedInUser?.role ?? "client_user";
  const isScoped = !["admin", "rasindo_operator", "rasindo_user"].includes(userRole) && !!companyId;

  return useQuery({
    queryKey: ["projects", isScoped ? companyId : "all"],
    queryFn: async () => {
      const url = isScoped
        ? `${API_BASE}/projects/?company_id=${companyId}`
        : `${API_BASE}/projects/`;

      const res = await fetch(url, { method: "GET", cache: "no-store", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Backend menolak permintaan atau sesi tidak sah");

      const result = await res.json();
      return (result.data ?? []) as any[];
    },
    staleTime: 5_000,
    refetchInterval: options?.refetchInterval,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      display_name: string;
      description: string;
      company_id: number;
      latitude: number;
      longitude: number;
      config: any[];
    }) => {
      const res = await fetch(`${API_BASE}/projects/`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const rawText = await res.text();
        let errData: any = {};
        try { errData = JSON.parse(rawText); } catch {}
        throw new Error(errData?.detail ?? rawText ?? "Gagal menyimpan project.");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: Record<string, any> }) => {
      const res = await fetch(`${API_BASE}/projects/${id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.detail ?? "Gagal memperbarui data.");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_BASE}/projects/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.detail ?? "Gagal menghapus project.");
      }

      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}