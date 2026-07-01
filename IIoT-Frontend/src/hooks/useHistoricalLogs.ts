import { useQuery } from "@tanstack/react-query";
import { API_BASE, getAuthHeaders } from "@/lib/api";

export interface LogsPagination {
  page: number;
  page_size: number;
  total_records: number;
  total_pages: number;
}

export type LogsTab = "gateway_logs" | "alarm_logs";

const EMPTY_PAGINATION: LogsPagination = { page: 1, page_size: 25, total_records: 0, total_pages: 0 };

/**
 * Fetch historical gateway telemetry logs or alarm history logs.
 *
 * Two modes, matching the original page's behavior exactly:
 * - A single gateway selected -> hits `/gateways/:id/{logs|alarms}` and
 *   trusts the server's pagination object directly.
 * - No gateway selected ("SEMUA GATEWAY") -> fans out to every gateway
 *   in `gatewayIdsInProject`, combines + sorts client-side by
 *   created_at/triggered_at, and fakes a single-page pagination object
 *   over the combined array (server-side pagination isn't meaningful
 *   once you're merging multiple gateways' result sets).
 */
export function useHistoricalLogs(params: {
  activeTab: LogsTab;
  selectedProject: string;
  selectedGateway: string;
  gatewayIdsInProject: string[];
  startDate: string;
  endDate: string;
  page: number;
}) {
  const {
    activeTab,
    selectedProject,
    selectedGateway,
    gatewayIdsInProject,
    startDate,
    endDate,
    page,
  } = params;

  const endpointSuffix = activeTab === "gateway_logs" ? "logs" : "alarms";

  return useQuery({
    queryKey: [
      "historical-logs",
      activeTab,
      selectedProject,
      selectedGateway,
      gatewayIdsInProject.join(","),
      startDate,
      endDate,
      page,
    ],
    queryFn: async () => {
      const idsToQuery = selectedGateway ? [selectedGateway] : gatewayIdsInProject;

      if (idsToQuery.length === 0) {
        return { logs: [] as any[], pagination: EMPTY_PAGINATION };
      }

      const urlParams = new URLSearchParams({ page: String(page), page_size: "25" });
      if (startDate.trim()) urlParams.set("start_date", startDate);
      if (endDate.trim()) urlParams.set("end_date", endDate);

      if (selectedGateway) {
        const res = await fetch(`${API_BASE}/gateways/${selectedGateway}/${endpointSuffix}?${urlParams}`, {
          method: "GET",
          cache: "no-store",
          headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error(`Gagal memuat data. Status: ${res.status}`);

        const json = await res.json();
        return {
          logs: (json.data?.[endpointSuffix] ?? json.data?.logs ?? []) as any[],
          pagination: (json.data?.pagination ?? EMPTY_PAGINATION) as LogsPagination,
        };
      }

      const results = await Promise.all(
        idsToQuery.map((gwId) =>
          fetch(`${API_BASE}/gateways/${gwId}/${endpointSuffix}?${urlParams}`, {
            method: "GET",
            cache: "no-store",
            headers: getAuthHeaders(),
          }).then((r) => (r.ok ? r.json() : { data: { [endpointSuffix]: [] } }))
        )
      );

      const combined = results.flatMap((r) => r.data?.[endpointSuffix] ?? r.data?.logs ?? []);

      combined.sort((a: any, b: any) => {
        const timeA = new Date(a.created_at || a.triggered_at).getTime();
        const timeB = new Date(b.created_at || b.triggered_at).getTime();
        return timeB - timeA;
      });

      return {
        logs: combined,
        pagination: {
          page: 1,
          page_size: 25,
          total_records: combined.length,
          total_pages: Math.ceil(combined.length / 25),
        } as LogsPagination,
      };
    },
    enabled: !!selectedProject,
    staleTime: 5_000,
  });
}