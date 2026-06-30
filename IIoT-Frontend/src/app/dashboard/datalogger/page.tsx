"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Calendar, Download, RefreshCcw, Bell, FileText,
  Loader2, ChevronLeft, ChevronRight, AlertTriangle, Filter, SlidersHorizontal, Cpu, Clock
} from "lucide-react";
import { API_BASE, getAuthHeaders, getLocalUser } from "@/lib/api";

interface Pagination {
  page: number;
  page_size: number;
  total_records: number;
  total_pages: number;
}

type TabType = "gateway_logs" | "alarm_logs";

export default function DataLoggerPage() {
  const [activeTab, setActiveTab] = useState<TabType>("gateway_logs");
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [gatewaysList, setGatewaysList] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedGateway, setSelectedGateway] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [pagination, setPagination] = useState<Pagination>({
    page: 1, page_size: 25, total_records: 0, total_pages: 0,
  });

  // ─── 1. FETCH MASTER DATA (Projects + Gateways) ─────────────────────
  const fetchProjects = useCallback(async () => {
    try {
      const currentUser = getLocalUser();
      const currentRole: string = currentUser?.role ?? "client_user";
      const currentCompanyId: string = String(currentUser?.company_id ?? "");

      let url = `${API_BASE}/projects/`;
      if (currentRole !== "admin" && currentCompanyId) {
        url += `?company_id=${currentCompanyId}`;
      }

      const [resProj, resGw] = await Promise.all([
        fetch(url, { method: "GET", cache: "no-store", headers: getAuthHeaders() }),
        fetch(`${API_BASE}/gateways/`, { method: "GET", cache: "no-store", headers: getAuthHeaders() }),
      ]);

      if (resProj.ok) {
        const result = await resProj.json();
        const pList = result.data ?? [];
        setProjectsList(pList);
        if (pList.length > 0) setSelectedProject(String(pList[0].project_id));
      }

      if (resGw.ok) {
        const r = await resGw.json();
        setGatewaysList(r.data ?? []);
      }
    } catch (err) {
      console.error("Gagal memuat master data data logger:", err);
    }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const gatewaysInSelectedProject = gatewaysList.filter(
    (g) => String(g.project_id) === String(selectedProject)
  );

  useEffect(() => {
    setSelectedGateway("");
  }, [selectedProject]);

  // ─── 2. FETCH HISTORICAL LOGS (Gateway Logs atau Alarm Logs) ──
  const fetchHistoricalData = useCallback(async (page: number = 1) => {
    if (!selectedProject) return;

    const gatewaysToQuery = selectedGateway
      ? [selectedGateway]
      : gatewaysInSelectedProject.map((g) => String(g.gateway_id));

    if (gatewaysToQuery.length === 0) {
      setLogs([]);
      setPagination({ page: 1, page_size: 25, total_records: 0, total_pages: 0 });
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({ page: String(page), page_size: "25" });
      if (startDate.trim()) params.set("start_date", startDate);
      if (endDate.trim())   params.set("end_date", endDate);

      // Mengubah endpoint berdasarkan tab yang aktif (gateways/:id/logs atau gateways/:id/alarms)
      const endpointSuffix = activeTab === "gateway_logs" ? "logs" : "alarms";

      if (selectedGateway) {
        const res = await fetch(`${API_BASE}/gateways/${selectedGateway}/${endpointSuffix}?${params}`, {
          method: "GET", cache: "no-store", headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error(`Gagal memuat data. Status: ${res.status}`);
        const json = await res.json();
        setLogs(json.data?.[endpointSuffix] ?? json.data?.logs ?? []);
        setPagination(json.data?.pagination ?? { page: 1, page_size: 25, total_records: 0, total_pages: 0 });
      } else {
        const results = await Promise.all(
          gatewaysToQuery.map((gwId) =>
            fetch(`${API_BASE}/gateways/${gwId}/${endpointSuffix}?${params}`, {
              method: "GET", cache: "no-store", headers: getAuthHeaders(),
            }).then((r) => (r.ok ? r.json() : { data: { [endpointSuffix]: [] } }))
          )
        );
        const combined = results.flatMap((r) => r.data?.[endpointSuffix] ?? r.data?.logs ?? []);
        
        // Pengurutan berdasarkan tanggal (created_at untuk logs biasa, triggered_at untuk alarms)
        combined.sort((a, b) => {
          const timeA = new Date(a.created_at || a.triggered_at).getTime();
          const timeB = new Date(b.created_at || b.triggered_at).getTime();
          return timeB - timeA;
        });

        setLogs(combined);
        setPagination({
          page: 1,
          page_size: 25,
          total_records: combined.length,
          total_pages: Math.ceil(combined.length / 25),
        });
      }
    } catch (err: any) {
      setError(err.message ?? "Terjadi kesalahan saat memuat data.");
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedProject, selectedGateway, startDate, endDate, gatewaysInSelectedProject, activeTab]);

  useEffect(() => {
    if (selectedProject) fetchHistoricalData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject, selectedGateway, startDate, endDate, activeTab]);

  // Mengambil channel dinamis dari objek JSON payload (hanya berlaku di tab gateway_logs)
  const dynamicChannels = Array.from(
    new Set(logs.flatMap((log) => {
      if (activeTab !== "gateway_logs" || !log.payload || typeof log.payload !== "object") return [];
      return Object.keys(log.payload);
    }))
  );

  const gatewayName = (gatewayId: any) =>
    gatewaysList.find((g) => g.gateway_id === gatewayId)?.name ?? `Gateway #${gatewayId ?? "—"}`;

  // ─── 3. EXPORT CSV ───────────────────────────────────────────────────────
  const handleExportCSV = () => {
    if (logs.length === 0) return alert("Tidak ada data untuk di-export!");
    const projectName = projectsList.find((p) => String(p.project_id) === String(selectedProject))?.display_name ?? selectedProject;
    const gwLabel = selectedGateway ? gatewayName(Number(selectedGateway)) : "SEMUA_GATEWAY";

    let csv = "data:text/csv;charset=utf-8,";
    
    if (activeTab === "gateway_logs") {
      csv += `AUDIT REPORT TELEMETRI DATA LOGGER: ${String(projectName).toUpperCase()} - ${gwLabel.toUpperCase()}\n`;
      csv += ["No", "Timestamp", "Gateway", ...dynamicChannels].join(",") + "\n";

      logs.forEach((log, i) => {
        const formattedTime = log.created_at ? new Date(log.created_at).toLocaleString("id-ID").replace(/,/g, "") : "—";
        const row = [
          i + 1,
          `"${formattedTime}"`,
          gatewayName(log.gateway_id),
          ...dynamicChannels.map((ch) => {
            const val = log.payload?.[ch];
            return val !== undefined ? (typeof val === "object" ? JSON.stringify(val).replace(/,/g, " ") : val) : "-";
          }),
        ];
        csv += row.join(",") + "\n";
      });
    } else {
      csv += `AUDIT REPORT ALARM HISTORY: ${String(projectName).toUpperCase()} - ${gwLabel.toUpperCase()}\n`;
      csv += ["No", "Triggered At", "Gateway", "Alarm Name", "MQTT Key", "Message", "Verified At", "Verified By"].join(",") + "\n";

      logs.forEach((log, i) => {
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
  };

  const handlePageChange = (newPage: number) => {
    fetchHistoricalData(newPage);
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
            onClick={() => {
              setActiveTab(tab.id as TabType);
              setLogs([]);
            }}
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
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider shadow-md active:scale-95 transition-all border-none cursor-pointer whitespace-nowrap disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5 stroke-[3]" /> Export CSV
          </button>

          <button
            onClick={() => fetchHistoricalData(pagination.page)}
            disabled={!selectedProject}
            className="p-2.5 bg-slate-50 dark:bg-slate-900/80 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border-none cursor-pointer disabled:opacity-40"
          >
            <RefreshCcw className={`w-3.5 h-3.5 text-slate-500 dark:text-slate-400 ${isLoading ? "animate-spin" : ""}`} />
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
                logs.map((log, index) => (
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