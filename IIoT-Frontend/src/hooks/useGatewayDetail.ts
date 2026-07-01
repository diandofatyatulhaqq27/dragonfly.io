import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE, getAuthHeaders } from "@/lib/api";
import { WidgetItem } from "@/lib/widget-config";

/**
 * Single gateway detail (name, hmi_code, status, config, logs, last_ping...).
 *
 * `refetchInterval` mirrors the old 5s polling on the detail page; omit it
 * on pages that only need a one-shot fetch.
 */
/** Thrown by useGatewayDetail when the gateway genuinely doesn't exist (404),
 *  so pages can tell "not found" apart from a transient network/server error. */
export class GatewayNotFoundError extends Error {
  constructor() {
    super("Gateway tidak ditemukan.");
    this.name = "GatewayNotFoundError";
  }
}

export function useGatewayDetail(
  gatewayId?: string | number,
  options?: { refetchInterval?: number }
) {
  return useQuery({
    queryKey: ["gateway", String(gatewayId)],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/gateways/${gatewayId}`, {
        cache: "no-store",
        headers: getAuthHeaders(),
      });
      if (res.status === 404) throw new GatewayNotFoundError();
      if (!res.ok) throw new Error("Gagal mengambil data gateway.");
      const r = await res.json();
      return r.data as any;
    },
    enabled: !!gatewayId,
    // Live-ish data, but no need to hammer the server between polls.
    staleTime: 4_000,
    refetchInterval: options?.refetchInterval,
    // Don't retry a genuine 404 — retrying won't make a deleted gateway
    // reappear, it'll just delay showing the not-found state.
    retry: (failureCount, error) =>
      error instanceof GatewayNotFoundError ? false : failureCount < 3,
  });
}

/**
 * The project a gateway belongs to, reduced to its sorted gateway list
 * (used for the prev/next node navigator in the header).
 */
export function useProjectGateways(
  projectId?: string | number,
  options?: { refetchInterval?: number }
) {
  return useQuery({
    queryKey: ["project-gateways", String(projectId)],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/projects/${projectId}`, {
        cache: "no-store",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Gagal mengambil data project.");
      const r = await res.json();
      const gws: any[] = r.data?.gateways ?? [];
      return [...gws].sort(
        (a, b) => (a.gateway_id ?? a.id ?? 0) - (b.gateway_id ?? b.id ?? 0)
      );
    },
    enabled: !!projectId,
    staleTime: 30_000,
    refetchInterval: options?.refetchInterval,
  });
}

/**
 * Pre-aggregated chart data for every "chart" / "bar" widget in `widgets`.
 *
 * Runs one query per chart widget via useQueries, keyed by gateway + the
 * widget's range/keys, so editing a panel's range or key in edit mode
 * naturally triggers a refetch for just that widget — no manual
 * fetchChartDataForWidgets() call needed anymore.
 *
 * Returns a map shaped like the old `chartDataMap` state:
 *   { "chart-0-temperature": [...points], "bar-1-humidity": [...points] }
 */
export function useWidgetChartData(
  gatewayId: string | number | undefined,
  widgets: WidgetItem[]
) {
  const chartWidgets = widgets.filter((w) => w.type === "chart" || w.type === "bar");

  const specs = chartWidgets.map((item, idx) => {
    const isMulti = item.type === "chart" && (item.keys?.length ?? 0) > 1;
    const keysParam = isMulti ? (item.keys as string[]).join(",") : item.key ?? "";
    const range = item.range ?? "1h";
    return {
      mapKey: `${item.type}-${idx}-${item.key}`,
      keysParam,
      range,
    };
  });

  const results = useQueries({
    queries: specs.map((spec) => ({
      queryKey: ["chart", String(gatewayId), spec.mapKey, spec.range, spec.keysParam],
      queryFn: async () => {
        const res = await fetch(
          `${API_BASE}/gateways/${gatewayId}/chart?range=${spec.range}&keys=${spec.keysParam}`,
          { cache: "no-store", headers: getAuthHeaders() }
        );
        if (!res.ok) throw new Error("Gagal mengambil chart data.");
        const r = await res.json();
        return (r.data ?? []) as any[];
      },
      enabled: !!gatewayId && !!spec.keysParam,
      staleTime: 4_000,
    })),
  });

  const chartDataMap: Record<string, any[]> = {};
  specs.forEach((spec, i) => {
    chartDataMap[spec.mapKey] = results[i]?.data ?? [];
  });

  return chartDataMap;
}

/** Save widget layout/config (and other editable gateway fields) to the server. */
export function useUpdateGatewayConfig(gatewayId?: string | number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      const res = await fetch(`${API_BASE}/gateways/${gatewayId}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        throw new Error(result?.detail ?? "Gagal menyimpan konfigurasi.");
      }
      return res.json();
    },
    onSuccess: () => {
      // Refresh this gateway's detail plus any gateway list views (e.g. the
      // project list page's cards), matching the old fetchAllData() refresh.
      queryClient.invalidateQueries({ queryKey: ["gateway", String(gatewayId)] });
      queryClient.invalidateQueries({ queryKey: ["gateways"] });
    },
  });
}