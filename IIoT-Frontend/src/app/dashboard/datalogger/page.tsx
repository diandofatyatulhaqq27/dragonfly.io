"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Calendar, Download, RefreshCcw, Bell, FileText,
  Loader2, ChevronLeft, ChevronRight, AlertTriangle, Filter, SlidersHorizontal, Cpu, Clock
} from "lucide-react";

import { useProjects } from "@/hooks/useProjects";
import { useGateways } from "@/hooks/useGateways";
import { useHistoricalLogs, fetchAllHistoricalLogsForExport, LogsTab } from "@/hooks/useHistoricalLogs";

export default function DataLoggerPage() {
  const [activeTab, setActiveTab] = useState<LogsTab>("gateway_logs");

  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedGateway, setSelectedGateway] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [page, setPage] = useState(1);

  // Export runs a separate fetch-all-pages request in the background,
  // so it needs its own loading flag distinct from the table's isLoading.
  const [isExporting, setIsExporting] = useState(false);

  // ─── MASTER DATA ─────────────────────────────────────────────────────
  // NOTE: gateways here are intentionally UNSCOPED (no company_id filter),
  // same as the original page — this feeds gatewayName() lookups and the
  // gateway dropdown for whichever project is selected. useProjects() IS
  // scoped for non-admin roles, also matching the original.
  const projectsQuery = useProjects();
  const gatewaysQuery = useGateways();

  const projectsList = projectsQuery.data ?? [];
  const gatewaysList = gatewaysQuery.data ?? [];

  // Default to the first project once the list loads.
  useEffect(() => {
    if (projectsList.length > 0 && !selectedProject) {
      setSelectedProject(String(projectsList[0].project_id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectsList]);

  const gatewaysInSelectedProject = useMemo(
    () => gatewaysList.filter((g) => String(g.project_id) === String(selectedProject)),
    [gatewaysList, selectedProject]
  );
  const gatewayIdsInProject = useMemo(
    () => gatewaysInSelectedProject.map((g) => String(g.gateway_id)),
    [gatewaysInSelectedProject]
  );

  // Reset gateway selection whenever the project changes.
  useEffect(() => {
    setSelectedGateway("");
  }, [selectedProject]);

  // Reset to page 1 whenever any filter changes.
  useEffect(() => {
    setPage(1);
  }, [selectedProject, selectedGateway, startDate, endDate, activeTab]);

  // ─── HISTORICAL LOGS ─────────────────────────────────────────────────
  const logsQuery = useHistoricalLogs({
    activeTab,
    selectedProject,
    selectedGateway,
    gatewayIdsInProject,
    startDate,
    endDate,
    page,
  });

  const logs = logsQuery.data?.logs ?? [];
  const pagination = logsQuery.data?.pagination ?? { page: 1, page_size: 25, total_records: 0, total_pages: 0 };
  // ⚠️ FIX: isLoading (true only on the very first fetch, when there's no
  // cached data yet) — not isFetching (true on EVERY refetch, including
  // silent background polling). Using isFetching here was blanking the
  // whole table out to a spinner every time the periodic refetch fired,
  // then snapping back once fresh data arrived — that height jump is the
  // "kedip"/flicker you were seeing, most noticeable on alarm_logs simply
  // because that table tends to have more visible rows/columns at once.
  const isLoading = logsQuery.isLoading;
  // Background refetch indicator — used only to spin the refresh icon,
  // never to swap out the table body.
  const isRefetching = logsQuery.isFetching && !logsQuery.isLoading;
  const error = logsQuery.error?.message ?? null;

  // Mengambil channel dinamis dari objek JSON payload (hanya berlaku di tab gateway_logs)
  const dynamicChannels = Array.from(
    new Set(logs.flatMap((log: any) => {
      if (activeTab !== "gateway_logs" || !log.payload || typeof log.payload !== "object") return [];
      return Object.keys(log.payload);
    }))
  );

  const gatewayName = (gatewayId: any) =>
    gatewaysList.find((g) => g.gateway_id === gatewayId)?.name ?? `Gateway #${gatewayId ?? "—"}`;

  // ─── EXPORT CSV ───────────────────────────────────────────────────────
  // Fetches the FULL result set matching current filters (walking every
  // page from the server), not just the 25 rows currently rendered in the
  // table — otherwise a date range spanning thousands of rows only ever
  // exports whatever page happens to be on screen.
  const handleExportCSV = async () => {
    if (!selectedProject) return;
    setIsExporting(true);
    try {
      const allLogs = await fetchAllHistoricalLogsForExport({
        activeTab,
        selectedGateway,
        gatewayIdsInProject,
        startDate,
        endDate,
      });

      if (allLogs.length === 0) {
        alert("Tidak ada data untuk di-export!");
        return;
      }

      // Recompute channels from the FULL export set — the on-screen page
      // might not contain every channel that appears across the whole
      // filtered range.
      const exportChannels = Array.from(
        new Set(allLogs.flatMap((log: any) => {
          if (activeTab !== "gateway_logs" || !log.payload || typeof log.payload !== "object") return [];
          return Object.keys(log.payload);
        }))
      );

      const projectName = projectsList.find((p) => String(p.project_id) === String(selectedProject))?.display_name ?? selectedProject;
      const gwLabel = selectedGateway ? gatewayName(Number(selectedGateway)) : "SEMUA_GATEWAY";

      let csv = "data:text/csv;charset=utf-8,";

      if (activeTab === "gateway_logs") {
        csv += `AUDIT REPORT TELEMETRI DATA LOGGER: ${String(projectName).toUpperCase()} - ${gwLabel.toUpperCase()}\n`;
        csv += ["No", "Timestamp", "Gateway", ...exportChannels].join(",") + "\n";

        allLogs.forEach((log: any, i: number) => {
          const formattedTime = log.created_at ? new Date(log.created_at).toLocaleString("id-ID").replace(/,/g, "") : "—";
          const row = [
            i + 1,
            `"${formattedTime}"`,
            gatewayName(log.gateway_id),
            ...exportChannels.map((ch) => {
              const val = log.payload?.[ch];
              return val !== undefined ? (typeof val === "object" ? JSON.stringify(val).replace(/,/g, " ") : val) : "-";
            }),
          ];
          csv += row.join(",") + "\n";
        });
      } else {
        csv += `AUDIT REPORT ALARM HISTORY: ${String(projectName).toUpperCase()} - ${gwLabel.toUpperCase()}\n`;
        csv += ["No", "Triggered At", "Gateway", "Alarm Name", "MQTT Key", "Message", "Verified At", "Verified By"].join(",") + "\n";

        allLogs.forEach((log: any, i: number) => {
          const trigTime = log.triggered_at ? new Date(log.triggered_at).toLocaleString("id-ID").replace(/,/g, "") : "—";
          const verTime = log.verified_at ? new Date(log.verified_at).toLocaleString("id-ID").replace(/,/g, "") : "—";
          const row = [
            i + 1,
            `"${trigTime}"`,
            gatewayName(log.gateway_id),
            `"${log.alarm_name ?? "—"}"`,
            `"${log.mqtt_key ?? "—"}"`,
            `"${(log.message ?? "").replace(/"/g, '""')}"`,
            `"${verTime}"`,
            `"${log.verified_by ?? "—"}"`,
          ];
          csv += row.join(",") + "\n";
        });
      }

      const link = document.createElement("a");
      link.setAttribute("href", encodeURI(csv));
      link.setAttribute("download", `DATA_LOGGER_${activeTab.toUpperCase()}_PROJECT_${selectedProject}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(err?.message ?? "Gagal meng-export data.");
    } finally {
      setIsExporting(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  return (
    <div className="p-6 bg-transparent min-h-screen font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300 space-y-5">

      {/* Tab Selector Segment */}
      <div className="flex gap-1.5 p-1 bg-slate-200/50 dark:bg-slate-800/60 w-fit rounded-xl border border-slate-200 dark:border-slate-700 transition-all">
        {[
          { id: "gateway_logs", label: "Gateway Telemetry Records", icon: FileText },
          { id: "alarm_logs", label: "Alarm History Records", icon: Bell },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as LogsTab)}
            className={`flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer border-none ${
              activeTab === tab.id
                ? "bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:bg-white/40 dark:hover:bg-slate-700/40"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" /> {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden transition-all duration-300">

        {/* ── TOOLBAR INTERNAL ── */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800">

          <div className="flex items-center gap-2 min-w-[160px] flex-1">
            <Filter className="w-3 h-3 text-slate-400 shrink-0" />
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full py-2.5 px-3 bg-slate-50 dark:bg-slate-900/60 text-slate-800 dark:text-slate-200 rounded-xl text-[11px] font-black border-none outline-none focus:ring-2 ring-blue-100 dark:ring-blue-900/40 cursor-pointer"
            >
              {projectsList.length === 0 && <option value="" disabled>Loading projects...</option>}
              {projectsList.map((p) => (
                <option key={p.project_id} value={String(p.project_id)} className="dark:bg-slate-800">
                  {p.display_name.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 min-w-[160px] flex-1">
            <Cpu className="w-3 h-3 text-slate-400 shrink-0" />
            <select
              value={selectedGateway}
              onChange={(e) => setSelectedGateway(e.target.value)}
              disabled={!selectedProject}
              className="w-full py-2.5 px-3 bg-slate-50 dark:bg-slate-900/60 text-slate-800 dark:text-slate-200 rounded-xl text-[11px] font-black border-none outline-none focus:ring-2 ring-blue-100 dark:ring-blue-900/40 cursor-pointer disabled:opacity-40"
            >
              <option value="" className="dark:bg-slate-800">SEMUA GATEWAY</option>
              {gatewaysInSelectedProject.length === 0 && selectedProject && (
                <option value="" disabled>Tidak ada gateway di site ini</option>
              )}
              {gatewaysInSelectedProject.map((g) => (
                <option key={g.gateway_id} value={String(g.gateway_id)} className="dark:bg-slate-800">
                  {g.name.toUpperCase()}{g.hmi_code ? ` (${g.hmi_code})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 min-w-[135px]">
            <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full py-2.5 px-3 bg-slate-50 dark:bg-slate-900/60 text-slate-800 dark:text-slate-200 rounded-xl text-[11px] font-bold border-none outline-none focus:ring-2 ring-blue-100 dark:ring-blue-900/40"
            />
          </div>

          <div className="flex items-center gap-2 min-w-[135px]">
            <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full py-2.5 px-3 bg-slate-50 dark:bg-slate-900/60 text-slate-800 dark:text-slate-200 rounded-xl text-[11px] font-bold border-none outline-none focus:ring-2 ring-blue-100 dark:ring-blue-900/40"
            />
          </div>

          <div className="flex-1" />

          <button
            onClick={handleExportCSV}
            disabled={!selectedProject || isExporting}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider shadow-md active:scale-95 transition-all border-none cursor-pointer whitespace-nowrap disabled:opacity-40"
          >
            {isExporting
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Download className="w-3.5 h-3.5 stroke-[3]" />}
            {isExporting ? "Exporting..." : "Export CSV"}
          </button>

          <button
            onClick={() => logsQuery.refetch()}
            disabled={!selectedProject}
            className="p-2.5 bg-slate-50 dark:bg-slate-900/80 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border-none cursor-pointer disabled:opacity-40"
          >
            {/* Spins on BOTH initial load and background refetch — this is
                the only visual cue for background polling now, instead of
                the whole table blanking out. */}
            <RefreshCcw className={`w-3.5 h-3.5 text-slate-500 dark:text-slate-400 ${(isLoading || isRefetching) ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* ── TABLE INFO BAR ── */}
        <div className="px-4 py-2.5 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between">
          <span className="font-black text-[9px] uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
            <SlidersHorizontal className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            {activeTab === "gateway_logs" ? "Data Logger Channel Transmissions" : "System Core Alarm Anomalies History"}
          </span>
          <span className="text-[9px] font-mono font-black uppercase text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-lg border border-blue-100 dark:border-blue-900/50">
            Total Records: {pagination.total_records} Rows
          </span>
        </div>

        {/* ── TABLE ── */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-700">
                <th className="p-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest w-14 text-center">Index</th>
                <th className="p-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest w-36">
                  <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> Timestamp</div>
                </th>
                <th className="p-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest w-40">Gateway</th>

                {/* Header dinamis conditional per tab */}
                {activeTab === "gateway_logs" ? (
                  dynamicChannels.map((ch) => (
                    <th key={ch} className="p-4 text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest border-l border-slate-100 dark:border-slate-700/60 bg-blue-50/20 dark:bg-blue-950/10">
                      {ch.replace(/_/g, " ")}
                    </th>
                  ))
                ) : (
                  <>
                    <th className="p-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-1 border-slate-100 dark:border-slate-700/60">Alarm Name</th>
                    <th className="p-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-l border-slate-100 dark:border-slate-700/60 w-64">Alert Message</th>
                    <th className="p-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-l border-slate-100 dark:border-slate-700/60">Verified At</th>
                    <th className="p-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-l border-slate-100 dark:border-slate-700/60">Operator</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/40 text-[11px] font-mono text-slate-600 dark:text-slate-400">
              {isLoading ? (
                <tr>
                  <td colSpan={activeTab === "gateway_logs" ? 3 + dynamicChannels.length : 8} className="p-28 text-center font-sans">
                    <Loader2 className="w-7 h-7 animate-spin text-blue-600 dark:text-blue-400 mx-auto" />
                    <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-3">Re-indexing telemetry records dari PostgreSQL...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={activeTab === "gateway_logs" ? 3 + dynamicChannels.length : 8} className="p-16 text-center font-sans">
                    <AlertTriangle className="w-4 h-4 text-rose-400 mx-auto mb-2" />
                    <p className="text-rose-500 dark:text-rose-400 font-bold text-[11px] uppercase italic">{error}</p>
                  </td>
                </tr>
              ) : logs.length > 0 ? (
                logs.map((log: any, index: number) => (
                  <tr key={log.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/20 transition-colors">
                    <td className="p-4 text-center text-slate-400 dark:text-slate-600 font-bold">
                      {(pagination.page - 1) * pagination.page_size + index + 1}
                    </td>
                    <td className="p-4 text-slate-700 dark:text-slate-300 font-sans whitespace-nowrap">
                      {new Date(log.created_at || log.triggered_at).toLocaleString("id-ID")}
                    </td>
                    <td className="p-4 font-sans text-slate-800 dark:text-slate-300 font-black uppercase tracking-tight text-[10px]">
                      {gatewayName(log.gateway_id)}
                    </td>

                    {/* Render data berdasarkan tipe tab aktif */}
                    {activeTab === "gateway_logs" ? (
                      dynamicChannels.map((ch) => {
                        const val = log.payload?.[ch];
                        return (
                          <td key={ch} className="p-4 font-black border-l border-slate-100 dark:border-slate-700/40 text-slate-800 dark:text-slate-200">
                            {val !== undefined ? (typeof val === "object" ? JSON.stringify(val) : String(val)) : (
                              <span className="text-slate-300 dark:text-slate-600">-</span>
                            )}
                          </td>
                        );
                      })
                    ) : (
                      <>
                        <td className="p-4 font-sans font-black uppercase text-rose-600 dark:text-rose-400 border-l border-slate-100 dark:border-slate-700/40">{log.alarm_name || "—"}</td>
                        <td className="p-4 text-slate-700 dark:text-slate-300 border-l border-slate-100 dark:border-slate-700/40 font-sans truncate max-w-xs" title={log.message}>{log.message || "—"}</td>
                        <td className="p-4 font-sans border-l border-slate-100 dark:border-slate-700/40 text-emerald-600 dark:text-emerald-400">
                          {log.verified_at ? new Date(log.verified_at).toLocaleString("id-ID") : <span className="text-amber-500 font-bold">UNVERIFIED</span>}
                        </td>
                        <td className="p-4 font-sans font-bold uppercase text-slate-700 dark:text-slate-400 border-l border-slate-100 dark:border-slate-700/40">{log.verified_by || "—"}</td>
                      </>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={activeTab === "gateway_logs" ? 3 + dynamicChannels.length : 8} className="p-20 text-center font-sans text-slate-400 dark:text-slate-500 text-[9px] font-black uppercase italic tracking-[0.2em]">
                    No historical logs found within this date parameters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── PAGINATION (server-side) ── */}
        {pagination.total_pages > 1 && (
          <div className="p-4 border-t border-slate-50 dark:border-slate-700 flex items-center justify-between font-sans flex-wrap gap-3">
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Page {pagination.page} of {pagination.total_pages} — {pagination.total_records} total records
            </p>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Go to</span>
                <input
                  type="number"
                  min={1}
                  max={pagination.total_pages}
                  defaultValue={pagination.page}
                  key={pagination.page}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = Number((e.target as HTMLInputElement).value);
                      if (val >= 1 && val <= pagination.total_pages) {
                        handlePageChange(val);
                      } else {
                        (e.target as HTMLInputElement).value = String(pagination.page);
                      }
                    }
                  }}
                  onBlur={(e) => {
                    const val = Number(e.target.value);
                    if (val >= 1 && val <= pagination.total_pages && val !== pagination.page) {
                      handlePageChange(val);
                    } else {
                      e.target.value = String(pagination.page);
                    }
                  }}
                  className="w-16 py-1.5 px-2 bg-slate-50 dark:bg-slate-900 rounded-lg text-[11px] font-bold text-center outline-none border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:ring-2 ring-blue-200 dark:ring-blue-800"
                />
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  / {pagination.total_pages}
                </span>
              </div>

              <div className="flex gap-1.5 ml-2">
                <button
                  onClick={() => handlePageChange(Math.max(pagination.page - 1, 1))}
                  disabled={pagination.page === 1}
                  className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-pointer disabled:opacity-40"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handlePageChange(Math.min(pagination.page + 1, pagination.total_pages))}
                  disabled={pagination.page === pagination.total_pages}
                  className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-pointer disabled:opacity-40"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}