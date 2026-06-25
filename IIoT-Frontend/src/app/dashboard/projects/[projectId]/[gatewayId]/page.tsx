"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, Plus, LayoutGrid, Loader2,
  ChevronLeft, ChevronRight, Cpu, Pencil, X, Check,
} from "lucide-react";
import ReactGridLayout from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { API_BASE, getAuthHeaders, getLocalUser, isReadOnlyRole } from "@/lib/api";
import { WidgetItem, getLatestPayload, defaultGridPos } from "@/lib/widget-config";
import { WidgetCard, WidgetSettingsPanel } from "@/components/widgets/WidgetCard";

// ─── Grid config ─────────────────────────────────────────────────────────────
const COLS  = 80;
const ROW_H = 80;
const GridLayout = ReactGridLayout as any;

type RGLLayout = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
};

function itemToLayout(item: WidgetItem, index: number): RGLLayout {
  const gp = item.gridPos ?? defaultGridPos(item.type, index);
  return { i: String(index), x: gp.x, y: gp.y, w: gp.w, h: gp.h, minW: 1, minH: 1 };
}

export default function GatewayDetailPage() {
  const router = useRouter();
  const { projectId, gatewayId } = useParams();

  const [logs,            setLogs]            = useState<any[]>([]);
  const [gatewayInfo,     setGatewayInfo]     = useState<any>(null);
  const [projectGateways, setProjectGateways] = useState<any[]>([]);
  const [devices,         setDevices]         = useState<any[]>([]);
  const [loading,         setLoading]         = useState(true);

  const [isEditMode,      setIsEditMode]      = useState(false);
  const [editConfig,      setEditConfig]      = useState<WidgetItem[]>([]);
  const [selectedIdx,     setSelectedIdx]     = useState<number | null>(null);
  const [layouts,         setLayouts]         = useState<RGLLayout[]>([]);
  const [containerWidth,  setContainerWidth]  = useState(1200);

  // ── Floating panel state ──────────────────────────────────────────────────
  const [panelPos,        setPanelPos]        = useState({ x: 100, y: 80 });
  const [isDraggingPanel, setIsDraggingPanel] = useState(false);
  const dragOffset = React.useRef({ x: 0, y: 0 });

  const isReadOnly = isReadOnlyRole(getLocalUser()?.role);

  // Set posisi awal floating panel setelah mount
  useEffect(() => {
    setPanelPos({ x: window.innerWidth - 320, y: 80 });
  }, []);

  // Drag handler untuk floating panel
  const onPanelMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingPanel(true);
    dragOffset.current = {
      x: e.clientX - panelPos.x,
      y: e.clientY - panelPos.y,
    };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDraggingPanel) return;
      setPanelPos({
        x: Math.max(0, Math.min(window.innerWidth - 300, e.clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.current.y)),
      });
    };
    const onUp = () => setIsDraggingPanel(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDraggingPanel]);

  // Track container width for responsive grid
  const gridRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!gridRef.current) return;
    const obs = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    obs.observe(gridRef.current);
    return () => obs.disconnect();
  }, []);

  const fetchAllData = useCallback(async () => {
    if (!projectId || !gatewayId) return;
    try {
      const [resGw, resProject, resDev] = await Promise.all([
        fetch(`${API_BASE}/gateways/${gatewayId}`, { method: "GET", cache: "no-store", headers: getAuthHeaders() }),
        fetch(`${API_BASE}/projects/${projectId}`,  { method: "GET", cache: "no-store", headers: getAuthHeaders() }),
        fetch(`${API_BASE}/devices/?gateway_id=${gatewayId}`, { method: "GET", cache: "no-store", headers: getAuthHeaders() }),
      ]);

      if (resGw.ok) {
        const r = await resGw.json();
        const data = r.data;
        if (data) {
          setGatewayInfo(data);
          setLogs(data.logs ?? []);
          if (!isEditMode) {
            const cfg: WidgetItem[] = data.config ?? [];
            setEditConfig(cfg);
            setLayouts(cfg.map((item, i) => itemToLayout(item, i)));
          }
        }
      }
      if (resProject.ok) {
        const r = await resProject.json();
        const gws: any[] = r.data?.gateways ?? [];
        setProjectGateways([...gws].sort((a, b) => (a.gateway_id ?? a.id ?? 0) - (b.gateway_id ?? b.id ?? 0)));
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
  }, [projectId, gatewayId, isEditMode]);

  useEffect(() => {
    fetchAllData();
    const iv = setInterval(fetchAllData, 5000);
    return () => clearInterval(iv);
  }, [fetchAllData]);

  const currentIndex = projectGateways.findIndex((g) => String(g.gateway_id ?? g.id) === String(gatewayId));

  const isOnline = (() => {
    if (!gatewayInfo?.last_ping) return false;
    return (Date.now() - new Date(gatewayInfo.last_ping).getTime()) / 1000 < 60;
  })();

  const onLayoutChange = (newLayout: RGLLayout[]) => {
    setLayouts(newLayout);
    setEditConfig((prev) => prev.map((item, i) => {
      const l = newLayout.find((n) => n.i === String(i));
      if (!l) return item;
      return { ...item, gridPos: { x: l.x, y: l.y, w: l.w, h: l.h } };
    }));
  };

  const addWidget = () => {
    if (isReadOnly) return;
    const newItem: WidgetItem = { key: "", label: "", type: "value", unit: "", size: "small", range: "1h" };
    const newIdx = editConfig.length;
    const gp = defaultGridPos("value", newIdx);
    newItem.gridPos = gp;
    const newConfig  = [...editConfig, newItem];
    const newLayouts: RGLLayout[] = [...layouts, { i: String(newIdx), x: gp.x, y: gp.y, w: gp.w, h: gp.h, minW: 1, minH: 1 }];
    setEditConfig(newConfig);
    setLayouts(newLayouts);
    setSelectedIdx(newIdx);
  };

  const removeWidget = (i: number) => {
    if (isReadOnly) return;
    const newConfig  = editConfig.filter((_, idx) => idx !== i);
    const newLayouts = newConfig.map((item, newIdx) => itemToLayout(item, newIdx));
    setEditConfig(newConfig);
    setLayouts(newLayouts);
    if (selectedIdx === i) setSelectedIdx(null);
    else if (selectedIdx !== null && selectedIdx > i) setSelectedIdx(selectedIdx - 1);
  };

  const updateWidget = (i: number, field: string, val: any) => {
    if (isReadOnly) return;
    setEditConfig((prev) => {
      const updated = [...prev];
      (updated[i] as any)[field] = val;
      return updated;
    });
  };

  const handleSaveConfig = async () => {
    if (isReadOnly) return alert("Akses ditolak!");
    try {
      const res = await fetch(`${API_BASE}/gateways/${gatewayId}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          gateway_id: Number(gatewayId),
          name:       gatewayInfo?.name ?? "",
          hmi_code:   gatewayInfo?.hmi_code ?? null,
          project_id: Number(projectId),
          status:     gatewayInfo?.status ?? "offline",
          config:     editConfig,
        }),
      });
      if (res.ok) {
        setIsEditMode(false);
        setSelectedIdx(null);
        fetchAllData();
      } else {
        const result = await res.json().catch(() => ({}));
        alert(result?.detail ?? "Gagal menyimpan konfigurasi.");
      }
    } catch { alert("Gagal menghubungi server."); }
  };

  const exitEditMode = () => {
    setIsEditMode(false);
    setSelectedIdx(null);
    const cfg: WidgetItem[] = gatewayInfo?.config ?? [];
    setEditConfig(cfg);
    setLayouts(cfg.map((item, i) => itemToLayout(item, i)));
  };

  if (loading && !gatewayInfo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="mt-3 text-[9px] font-black text-slateate-400 uppercase tracking-widest">Syncing telemetry...</p>
      </div>
    );
  }

  const latestPayload = getLatestPayload(logs);
  const selectedItem  = selectedIdx !== null ? editConfig[selectedIdx] : null;

  return (
    <div className="bg-slate-50 dark:bg-slate-900 min-h-screen font-sans text-slate-900 dark:text-slate-100">

      {/* ── FLOATING SETTINGS PANEL ───────────────────────────────────────── */}
      {isEditMode && selectedItem !== null && selectedIdx !== null && (
        <div
          className="fixed z-[100] w-72 bg-white dark:bg-slate-800 rounded-2xl border border-blue-200 dark:border-blue-800 shadow-2xl flex flex-col"
          style={{
            left:      panelPos.x,
            top:       panelPos.y,
            maxHeight: "80vh",  // ← max 80% tinggi layar
            minHeight: "auto",  // ← tidak ada minimum, ikut konten
          }}
        >
          {/* Drag handle */}
          <div
            onMouseDown={onPanelMouseDown}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 text-white cursor-grab active:cursor-grabbing shrink-0 select-none rounded-t-2xl"
          >
            <div className="flex gap-0.5 shrink-0">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="w-0.5 h-3 bg-white/40 rounded-full" />
              ))}
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest flex-1 text-center">
              Panel Settings
            </span>
            <button
              onClick={() => setSelectedIdx(null)}
              className="p-0.5 hover:bg-white/20 rounded transition-colors border-none bg-transparent text-white cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <WidgetSettingsPanel
              item={selectedItem}
              index={selectedIdx}
              onUpdate={updateWidget}
              onRemove={removeWidget}
              onClose={() => setSelectedIdx(null)}
            />
          </div>
        </div>
      )}

      {/* ── EDIT MODE TOP BAR ─────────────────────────────────────────────── */}
      {isEditMode && (
        <div className="sticky top-0 z-50 flex items-center justify-between px-5 py-2.5 bg-blue-600 text-white shadow-lg">
          <div className="flex items-center gap-2">
            <Pencil className="w-3.5 h-3.5" />
            <span className="text-[10px] font-black uppercase tracking-widest">Mode Edit Aktif</span>
            <span className="text-[9px] text-blue-200">— Klik panel untuk setting, drag untuk pindah, tarik pojok untuk resize</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={addWidget}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-400 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer border-none">
              <Plus className="w-3 h-3" /> Panel
            </button>
            <button onClick={exitEditMode}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer border-none">
              <X className="w-3 h-3" /> Batal
            </button>
            <button onClick={handleSaveConfig}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-blue-600 hover:bg-blue-50 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer border-none shadow">
              <Check className="w-3 h-3" /> Simpan
            </button>
          </div>
        </div>
      )}

      <div className="p-5 space-y-4">

        {/* ── HEADER ───────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/dashboard/projects")}
              className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all bg-white dark:bg-slate-800 cursor-pointer">
              <ArrowLeft className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
            </button>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-lg font-black tracking-tighter text-slate-800 dark:text-slate-100 uppercase italic">
                  {gatewayInfo?.name ?? "Loading..."}
                </h1>
                <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all ${
                  isOnline
                    ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 border-emerald-200 animate-pulse"
                    : "bg-rose-50 dark:bg-rose-950/30 text-rose-600 border-rose-200"
                }`}>
                  {isOnline ? "● Active Stream" : "○ Link Offline"}
                </span>
                {gatewayInfo?.hmi_code && (
                  <span className="px-1.5 py-0.5 rounded-md text-[8px] font-mono font-black text-blue-600 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 uppercase">
                    HMI: {gatewayInfo.hmi_code}
                  </span>
                )}
              </div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                Project #{projectId} · Gateway #{gatewayId} · {devices.length} Device
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {projectGateways.length > 1 && (
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 rounded-xl shadow-sm h-9">
                <button
                  onClick={() => currentIndex > 0 && router.push(`/dashboard/projects/${projectId}/${projectGateways[currentIndex-1].gateway_id ?? projectGateways[currentIndex-1].id}`)}
                  disabled={currentIndex <= 0}
                  className="p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer transition-all border-none bg-transparent text-slate-700 dark:text-slate-300 h-full flex items-center">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <div className="px-1 flex items-center gap-1 text-slate-700 dark:text-slate-300 font-black text-[9px] uppercase tracking-wider italic whitespace-nowrap">
                  <Cpu className="w-3 h-3 text-blue-500" /> Node {currentIndex + 1} / {projectGateways.length}
                </div>
                <button
                  onClick={() => currentIndex < projectGateways.length - 1 && router.push(`/dashboard/projects/${projectId}/${projectGateways[currentIndex+1].gateway_id ?? projectGateways[currentIndex+1].id}`)}
                  disabled={currentIndex >= projectGateways.length - 1}
                  className="p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer transition-all border-none bg-transparent text-slate-700 dark:text-slate-300 h-full flex items-center">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {!isReadOnly && !isEditMode && (
              <button onClick={() => setIsEditMode(true)}
                title="Edit Layout"
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-blue-600 transition-all shadow-sm cursor-pointer">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ── MAIN AREA ────────────────────────────────────────────────────── */}
        <div className="flex gap-5">

          {/* ── GRID AREA ─────────────────────────────────────────────────── */}
          <div className={`flex-1 min-w-0 ${isEditMode ? "edit-mode" : ""}`} ref={gridRef}>
            {editConfig.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-12 text-center">
                <LayoutGrid className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto mb-2.5" />
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Belum ada panel — {isEditMode ? 'klik "+ Panel" di atas' : 'klik ikon pensil untuk mulai edit'}
                </p>
              </div>
            ) : (
              <GridLayout
                layout={layouts as any}
                cols={COLS}
                rowHeight={ROW_H}
                width={containerWidth}
                isDraggable={isEditMode}
                isResizable={isEditMode}
                onLayoutChange={(newLayout: any) => onLayoutChange(newLayout)}
                draggableHandle=".drag-handle"
                margin={[12, 12]}
                containerPadding={[0, 0]}
                resizeHandles={["se"]}
              >
                {editConfig.map((item, index) => (
                  <div key={String(index)} className="relative">
                    {isEditMode && (
                      <div className="drag-handle absolute top-0 left-0 right-0 h-7 z-10 cursor-grab active:cursor-grabbing flex items-center px-3 gap-1.5 bg-slate-900/5 dark:bg-white/5 rounded-t-2xl">
                        <div className="flex gap-0.5">
                          {[...Array(6)].map((_, i) => (
                            <div key={i} className="w-0.5 h-3 bg-slate-400/40 dark:bg-slate-500/40 rounded-full" />
                          ))}
                        </div>
                      </div>
                    )}
                    <WidgetCard
                      item={item}
                      index={index}
                      isEditMode={isEditMode}
                      isSelected={selectedIdx === index}
                      isOnline={isOnline}
                      logs={logs}
                      latestPayload={latestPayload}
                      onSelect={setSelectedIdx}
                    />
                  </div>
                ))}
              </GridLayout>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}