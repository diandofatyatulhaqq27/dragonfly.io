import { useQuery } from "@tanstack/react-query";
import { API_BASE, getAuthHeaders } from "@/lib/api";

/**
 * Fetch alarm history (all triggered_at timestamps, not just active
 * ones) — used to build the Alarm Activity chart. Separate query key
 * from useAllAlarms() (/alarms/) and useAlarms() (/alarms/recent) since
 * this hits a different endpoint with a different response shape.
 */
export function useAlarmHistory(options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: ["alarms", "history"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/alarms/history`, {
        method: "GET",
        cache: "no-store",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Gagal menarik riwayat alarm dari server.");

      const result = await res.json();
      return (result.data ?? []) as any[];
    },
    staleTime: 5_000,
    refetchInterval: options?.refetchInterval,
  });
}