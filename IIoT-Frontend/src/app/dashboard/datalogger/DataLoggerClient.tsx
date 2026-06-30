"use client";

// src/app/dashboard/datalogger/DataLoggerClient.tsx
//
// CLIENT COMPONENT — menangani interaktivitas (filter, pagination, export).
// Menerima data INITIAL dari Server Component induk lewat props, sehingga
// render pertama tidak perlu fetch apa pun. Fetch baru hanya terjadi saat
// user benar-benar mengganti filter (project/gateway/tanggal/halaman).

import React, { useState, useCallback } from "react";
import {
  Calendar, Download, RefreshCcw,
  Loader2, ChevronLeft, ChevronRight, AlertTriangle, Filter, SlidersHorizontal, Cpu, Clock
} from "lucide-react";
import { API_BASE, getAuthHeaders } from "@/lib/api";

interface Pagination {
  page: number;
  page_size: number;
  total_records: number;
  total_pages: number;
}

interface DataLoggerClientProps {
  initialProjects: any[];
  initialGateways: any[];
  initialSelectedProject: string;
  initialLogs: any[];
  initialPagination: Pagination;
}

export function DataLoggerClient({
  initialProjects,
  initialGateways,
  initialSelectedProject,
  initialLogs,
  initialPagination,
}: DataLoggerClientProps) {
  const [projectsList] = useState<any[]>(initialProjects);
  const [gatewaysList] = useState<any[]>(initialGateways);

  const [selectedProject, setSelectedProject] = useState<string>(initialSelectedProject);
  const [selectedGateway, setSelectedGateway] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate,   setEndDate]   = useState<string>("");

  const [logs,        setLogs]        = useState<any[]>(initialLogs);
  const [pagination,  setPagination]  = useState<Pagination>(initialPagination);
  const [isLoading,   setIsLoading]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const gatewaysInSelectedProject = gatewaysList.filter(
    (g) => String(g.project_id) === String(selectedProject)
  );

  // ── Fetch logs dengan filter + pagination server-side ────────────────────
  const fetchLogs = useCallback(async (opts: {
    project?: string; gateway?: string; start?: string; end?: string; page?: number;
  } = {}) => {
    const project = opts.project ?? selectedProject;
    const gateway = opts.gateway ?? selectedGateway;
    const start   = opts.start   ?? startDate;
    const end     = opts.end     ?? endDate;
    const page    = opts.page    ?? 1;

    if (!project) return;

    const gatewaysToQuery = gateway
      ? [gateway]
      : gatewaysList.filter((g) => String(g.project_id) === String(project)).map((g) => String(g.gateway_id));

    if (gatewaysToQuery.length === 0) {
      setLogs([]);
      setPagination({ page: 1, page_size: 25, total_records: 0, total_pages: 0 });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ page: String(page), page_size: "25" });
      if (start) params.set("start_date", start);
      if (end)   params.set("end_date", end);

      // Kalau gateway spesifik dipilih → 1 request langsung.
      // Kalau "SEMUA GATEWAY" → fetch tiap gateway lalu gabung + sort + paginate
      // ulang di sisi client (untuk dataset besar, lebih baik backend punya
      // endpoint project-level dengan pagination native — catatan future improvement).
      if (gateway) {
        const res = await fetch(
          `${API_BASE}/gateways/${gateway}/logs?${params}`,
          { headers: getAuthHeaders(), cache: "no-store" }
        );
        if (!res.ok) throw new Error(`Gagal memuat data. Status: ${res.status}`);
        const json = await res.json();
        setLogs(json.data?.logs ?? []);
        setPagination(json.data?.pagination ?? { page: 1, page_size: 25, total_records: 0, total_pages: 0 });
      } else {
        const results = await Promise.all(
          gatewaysToQuery.map((gwId) =>
            fetch(`${API_BASE}/gateways/${gwId}/logs?${params}`, {
              headers: getAuthHeaders(), cache: "no-store",
            }).then((r) => (r.ok ? r.json() : { data: { logs: [] } }))
          )
        );
        const combined = results.flatMap((r) => r.data?.logs ?? []);
        combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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
  }, [selectedProject, selectedGateway, startDate, endDate, gatewaysList]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleProjectChange = (val: string) => {
    setSelectedProject(val);
    setSelectedGateway("");
    fetchLogs({ project: val, gateway: "", page: 1 });
  };

  const handleGatewayChange = (val: string) => {
    setSelectedGateway(val);
    fetchLogs({ gateway: val, page: 1 });
  };

  const handleDateChange = (field: "start" | "end", val: string) => {
    if (field === "start") setStartDate(val); else setEndDate(val);
    fetchLogs({ [field]: val, page: 1 } as any);
  };

  const handlePageChange = (newPage: number) => {
    fetchLogs({ page: newPage });
  };

  const dynamicChannels = Array.from(
    new Set(logs.flatMap((log) => {
      if (!log.payload || typeof log.payload !== "object") return [];
      return Object.keys(log.payload);
    }))
  );

  const gatewayName = (gatewayId: any) =>
    gatewaysList.find((g) => g.gateway_id === gatewayId)?.name ?? `Gateway #${gatewayId ?? "—"}`;

  // ── Export CSV (tetap client-side, hanya export data yang sedang ditampilkan) ──
  const handleExportCSV = () => {
    if (logs.length === 0) return alert("Tidak ada data untuk di-export!");
    const projectName = projectsList.find((p) => String(p.project_id) === String(selectedProject))?.display_name ?? selectedProject;
    const gwLabel = selectedGateway ? gatewayName(Number(selectedGateway)) : "SEMUA_GATEWAY";

    let csv = "data:text/csv;charset=utf-8,";
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

    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csv));
    link.setAttribute("download", `DATA_LOGGER_PROJECT_${selectedProject}${selectedGateway ? `_GW${selectedGateway}` : ""}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 bg-transparent min-h-screen font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300 space-y-5">

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden transition-all duration-300">

        {/* ── TOOLBAR ── */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800">

          <div className="flex items-center gap-2 min-w-[160px] flex-1">
            <Filter className="w-3 h-3 text-slate-400 shrink-0" />
            <select
              value={selectedProject}
              onChange={(e) => handleProjectChange(e.target.value)}
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
              onChange={(e) => handleGatewayChange(e.target.value)}
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
              onChange={(e) => handleDateChange("start", e.target.value)}
              className="w-full py-2.5 px-3 bg-slate-50 dark:bg-slate-900/60 text-slate-800 dark:text-slate-200 rounded-xl text-[11px] font-bold border-none outline-none focus:ring-2 ring-blue-100 dark:ring-blue-900/40"
            />
          </div>

          <div className="flex items-center gap-2 min-w-[135px]">
            <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => handleDateChange("end", e.target.value)}
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
            onClick={() => fetchLogs()}
            disabled={!selectedProject}
            className="p-2.5 bg-slate-50 dark:bg-slate-900/80 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border-none cursor-pointer disabled:opacity-40"
          >
            <RefreshCcw className={`w-3.5 h-3.5 text-slate-500 dark:text-slate-400 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* ── INFO BAR ── */}
        <div className="px-4 py-2.5 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between">
          <span className="font-black text-[9px] uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
            <SlidersHorizontal className="w-3 h-3 text-blue-600 dark:text-blue-400" /> Data Logger Channel Transmissions
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
                {dynamicChannels.map((ch) => (
                  <th key={ch} className="p-4 text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest border-l border-slate-100 dark:border-slate-700/60 bg-blue-50/20 dark:bg-blue-950/10">
                    {ch.replace(/_/g, " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/40 text-[11px] font-mono text-slate-600 dark:text-slate-400">
              {isLoading ? (
                <tr>
                  <td colSpan={3 + dynamicChannels.length} className="p-28 text-center font-sans">
                    <Loader2 className="w-7 h-7 animate-spin text-blue-600 dark:text-blue-400 mx-auto" />
                    <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-3">
                      Re-indexing telemetry records...
                    </p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={3 + dynamicChannels.length} className="p-16 text-center font-sans">
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
                      {log.created_at ? new Date(log.created_at).toLocaleString("id-ID") : "—"}
                    </td>
                    <td className="p-4 font-sans text-slate-800 dark:text-slate-300 font-black uppercase tracking-tight text-[10px]">
                      {gatewayName(log.gateway_id)}
                    </td>
                    {dynamicChannels.map((ch) => {
                      const val = log.payload?.[ch];
                      return (
                        <td key={ch} className="p-4 font-black border-l border-slate-100 dark:border-slate-700/40 text-slate-800 dark:text-slate-200">
                          {val !== undefined ? (typeof val === "object" ? JSON.stringify(val) : String(val)) : (
                            <span className="text-slate-300 dark:text-slate-600">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3 + dynamicChannels.length} className="p-20 text-center text-slate-400 dark:text-slate-500 font-sans text-[9px] font-black uppercase italic tracking-[0.2em]">
                    No historical logs found within this date parameters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── PAGINATION (server-side) ── */}
        {pagination.total_pages > 1 && (
          <div className="p-4 border-t border-slate-50 dark:border-slate-700 flex items-center justify-between font-sans">
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Page {pagination.page} of {pagination.total_pages} — {pagination.total_records} total records
            </p>
            <div className="flex gap-1.5">
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
        )}
      </div>
    </div>
  );
}