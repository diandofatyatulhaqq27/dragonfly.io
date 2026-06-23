"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Settings, Save, ArrowLeft, Plus,
  LayoutGrid, Loader2, ChevronLeft, ChevronRight, Cpu,
} from "lucide-react";
import { API_BASE, getAuthHeaders, getLocalUser, isReadOnlyRole } from "@/lib/api";
import { WidgetItem, getLatestPayload } from "@/lib/widget-config";
import { WidgetCard } from "@/components/widgets/WidgetCard";

export default function GatewayDetailPage() {
  const router = useRouter();
  const { projectId, gatewayId } = useParams();

  const [logs, setLogs] = useState<any[]>([]);
  const [gatewayInfo, setGatewayInfo] = useState<any>(null);
  const [projectGateways, setProjectGateways] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [editConfig, setEditConfig] = useState<WidgetItem[]>([]);

  const isReadOnly = isReadOnlyRole(getLocalUser()?.role);

  const fetchAllData = useCallback(async () => {
    if (!projectId || !gatewayId) return;
    try {
      const [resGw, resProject, resDev] = await Promise.all([
        fetch(`${API_BASE}/gateways/${gatewayId}`, { method: "GET", cache: "no-store", headers: getAuthHeaders() }),
        fetch(`${API_BASE}/projects/${projectId}`, { method: "GET", cache: "no-store", headers: getAuthHeaders() }),
        fetch(`${API_BASE}/devices/?gateway_id=${gatewayId}`, { method: "GET", cache: "no-store", headers: getAuthHeaders() }),
      ]);

      if (resGw.ok) {
        const r = await resGw.json();
        const data = r.data;
        if (data) {
          setGatewayInfo(data);
          setLogs(data.logs ?? []);
          // Di fetchAllData, setelah setLogs
          console.log("logs sample:", data.logs?.slice(-3));
          console.log("latestPayload:", getLatestPayload(data.logs ?? []));
          if (!isEditingConfig) setEditConfig(data.config ?? []);
        }
      }

      if (resProject.ok) {
        const r = await resProject.json();
        const gwInProject: any[] = r.data?.gateways ?? [];
        const sorted = [...gwInProject].sort((a, b) => (a.gateway_id ?? a.id ?? 0) - (b.gateway_id ?? b.id ?? 0));
        setProjectGateways(sorted);
      }

      if (resDev.ok) {
        const r = await resDev.json();
        setDevices(r.data ?? []);
      }
    } catch (err) {
      console.error("fetchAllData error:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId, gatewayId, isEditingConfig]);

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 5000);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  const currentIndex = projectGateways.findIndex((g) => String(g.gateway_id ?? g.id) === String(gatewayId));

  const handlePrev = () => {
    if (currentIndex > 0) {
      const gw = projectGateways[currentIndex - 1];
      router.push(`/dashboard/projects/${projectId}/${gw.gateway_id ?? gw.id}`);
    }
  };

  const handleNext = () => {
    if (currentIndex < projectGateways.length - 1) {
      const gw = projectGateways[currentIndex + 1];
      router.push(`/dashboard/projects/${projectId}/${gw.gateway_id ?? gw.id}`);
    }
  };

  const isOnline = (() => {
    if (!gatewayInfo?.last_ping) return false;
    const diffSec = (Date.now() - new Date(gatewayInfo.last_ping).getTime()) / 1000;
    return diffSec < 60;
  })();

  const addWidget = () => {
    if (isReadOnly) return;
    setEditConfig([...editConfig, { key: "", label: "", type: "value", unit: "", size: "small", range: "1h" }]);
  };

  const removeWidget = (i: number) => {
    if (isReadOnly) return;
    setEditConfig(editConfig.filter((_, idx) => idx !== i));
  };

  const updateWidget = (i: number, field: string, val: string) => {
    if (isReadOnly) return;
    const updated = [...editConfig];
    (updated[i] as any)[field] = val;
    setEditConfig(updated);
  };

  const handleSaveConfig = async () => {
    if (isReadOnly) return alert("Akses ditolak!");
    try {
      const res = await fetch(`${API_BASE}/gateways/${gatewayId}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          gateway_id: Number(gatewayId),
          name: gatewayInfo?.name ?? "",
          hmi_code: gatewayInfo?.hmi_code ?? null,
          project_id: Number(projectId),
          company_id: gatewayInfo?.company_id ?? null,
          status: gatewayInfo?.status ?? "offline",
          config: editConfig,
        }),
      });

      if (res.ok) {
        alert("Layout widget berhasil disimpan!");
        setIsEditingConfig(false);
        fetchAllData();
      } else {
        const result = await res.json().catch(() => ({}));
        alert(result?.detail ?? "Gagal menyimpan konfigurasi.");
      }
    } catch { alert("Gagal menghubungi server."); }
  };

  if (loading && !gatewayInfo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
        <p className="mt-3 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
          Syncing telemetry data streams...
        </p>
      </div>
    );
  }

  const latestPayload = getLatestPayload(logs);

  return (
    <div className="p-5 space-y-5 bg-slate-50 dark:bg-slate-900 min-h-screen font-sans text-slate-900 dark:text-slate-100">

      {/* ── HEADER PANEL ── */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard/projects")}
            className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all bg-white dark:bg-slate-800 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
          </button>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-lg font-black tracking-tighter text-slate-800 dark:text-slate-100 uppercase italic">
                {gatewayInfo?.name ?? "Loading Node..."}
              </h1>
              <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all ${
                isOnline
                  ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40 animate-pulse"
                  : "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/40"
              }`}>
                {isOnline ? "● Active Stream" : "○ Link Offline"}
              </span>
              {gatewayInfo?.hmi_code && (
                <span className="px-1.5 py-0.5 rounded-md text-[8px] font-mono font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 uppercase">
                  HMI: {gatewayInfo.hmi_code}
                </span>
              )}
            </div>
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
              Project #{projectId} · Gateway #{gatewayId} · {devices.length} Device Terdaftar
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {projectGateways.length > 1 && (
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 rounded-xl shadow-sm h-9">
              <button
                onClick={handlePrev}
                disabled={currentIndex <= 0}
                className="p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer transition-all border-none bg-transparent text-slate-700 dark:text-slate-300 h-full flex items-center"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <div className="px-1 flex items-center gap-1 text-slate-700 dark:text-slate-300 font-black text-[9px] uppercase tracking-wider italic whitespace-nowrap">
                <Cpu className="w-3 h-3 text-blue-500" />
                Node {currentIndex + 1} / {projectGateways.length}
              </div>
              <button
                onClick={handleNext}
                disabled={currentIndex >= projectGateways.length - 1}
                className="p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer transition-all border-none bg-transparent text-slate-700 dark:text-slate-300 h-full flex items-center"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {!isReadOnly && (
            <div className="flex gap-1.5 h-9">
              {isEditingConfig && (
                <button
                  onClick={handleSaveConfig}
                  className="flex items-center gap-1.5 px-4 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg hover:bg-blue-700 transition-all cursor-pointer border-none h-full"
                >
                  <Save className="w-3.5 h-3.5" /> Simpan Layout
                </button>
              )}
              <button
                onClick={() => setIsEditingConfig(!isEditingConfig)}
                className={`flex items-center gap-1.5 px-4 border rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-sm cursor-pointer h-full ${
                  isEditingConfig
                    ? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400"
                    : "bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                }`}
              >
                <Settings className="w-3.5 h-3.5" /> {isEditingConfig ? "Batal" : "Atur Widget"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="flex flex-col lg:flex-row gap-5">

        {/* Widget Grid */}
        <div className="flex-1">
          {editConfig.length === 0 && !isEditingConfig ? (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-12 text-center">
              <LayoutGrid className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto mb-2.5" />
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Belum ada widget — klik "Atur Widget" untuk menambahkan
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {editConfig.map((item, index) => (
                <WidgetCard
                  key={index}
                  item={item}
                  index={index}
                  isEditingConfig={isEditingConfig}
                  isOnline={isOnline}
                  logs={logs}
                  latestPayload={latestPayload}
                  onUpdate={updateWidget}
                  onRemove={removeWidget}
                />
              ))}

              {isEditingConfig && !isReadOnly && (
                <button
                  onClick={addWidget}
                  className="border-4 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center p-10 text-slate-400 hover:border-blue-400 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 hover:text-blue-600 transition-all group bg-transparent cursor-pointer"
                >
                  <Plus className="w-7 h-7 mb-1.5 group-hover:scale-110 transition-transform text-slate-300 dark:text-slate-600 group-hover:text-blue-500" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Tambah Widget</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── SIDEBAR META ── */}
        <div className="w-full lg:w-64 shrink-0">
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm sticky top-16 space-y-4">
            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="text-[8px] font-black uppercase tracking-[0.2em]">Meta Properties</span>
            </div>

            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Link Status</label>
              <div className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border w-fit ${
                isOnline
                  ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/40"
                  : "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/40"
              }`}>
                ● {isOnline ? "Online" : "Offline"}
              </div>
            </div>

            {devices.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Registered Devices</label>
                <div className="space-y-1">
                  {devices.map((dv) => (
                    <div key={dv.device_id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 px-2.5 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700">
                      <span className="text-[9px] font-black text-slate-700 dark:text-slate-300 uppercase truncate">{dv.name}</span>
                      <span className="text-[8px] font-mono text-slate-400 dark:text-slate-500 ml-2 shrink-0">{dv.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Last Ping</label>
              <p className="text-[9px] font-mono font-bold text-slate-600 dark:text-slate-400">
                {gatewayInfo?.last_ping
                  ? new Date(gatewayInfo.last_ping).toLocaleString("id-ID")
                  : "— Belum ada data —"}
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Log Records (last 1000)</label>
              <p className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{logs.length}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}