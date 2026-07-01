import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE, getAuthHeaders } from "@/lib/api";

/**
 * Fetch the list of users. Admin-only endpoint — used by the Master
 * Admin "Users System" tab.
 */
export function useUsers(options?: { refetchInterval?: number; enabled?: boolean }) {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/users/`, {
        method: "GET",
        cache: "no-store",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Gagal mengambil data users dari FastAPI");

      const result = await res.json();
      return (result.data ?? []) as any[];
    },
    staleTime: 5_000,
    refetchInterval: options?.refetchInterval,
    enabled: options?.enabled,
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      const res = await fetch(`${API_BASE}/users/${payload.id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const resData = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(resData?.detail ?? "Gagal memperbarui data ke database.");
      return resData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: any) => {
      const res = await fetch(`${API_BASE}/users/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      const resData = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(resData?.detail ?? "Gagal menghapus.");
      return resData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

/**
 * Generate a self-service password reset link for a user. Not a data
 * mutation in the cache sense (doesn't change the users list), so no
 * invalidation on success — it just returns the link for the caller to
 * copy/display.
 */
export function useGenerateResetLink() {
  return useMutation({
    mutationFn: async (userId: any) => {
      const res = await fetch(`${API_BASE}/users/generate-reset-token/${userId}`, {
        method: "POST",
        headers: getAuthHeaders(),
      });

      const resData = await res.json().catch(() => ({}));
      if (!res.ok || !resData.reset_link) {
        throw new Error(resData?.detail ?? "Gagal menjahit token keamanan baru.");
      }
      return resData as { reset_link: string };
    },
  });
}