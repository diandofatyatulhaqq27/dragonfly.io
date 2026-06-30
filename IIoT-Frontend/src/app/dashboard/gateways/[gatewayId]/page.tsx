"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { LayoutGrid, Loader2, Pencil, X, Check, Plus } from "lucide-react";
import ReactGridLayout from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { API_BASE, getAuthHeaders, getLocalUser, isReadOnlyRole } from "@/lib/api";
import { WidgetItem, getLatestPayload, defaultGridPos } from "@/lib/widget-config";
import { WidgetCard, WidgetSettingsPanel } from "@/components/widgets/WidgetCard";

const COLS  = 80;
const ROW_H = 80;
const GridLayout = ReactGridLayout as any;

type RGLLayout = {
  i: string; x: number; y: number; w: number; h: number; minW?: number; minH?: number;
};

function itemToLayout(item: WidgetItem, index: number): RGLLayout {
  const gp = item.gridPos ?? defaultGridPos(item.type, index);
  return { i: String(index), x: gp.x, y: gp.y, w: gp.w, h: gp.h, minW: 1, minH: 1 };
}

export default function SingleGatewayPage() {
  const { gatewayId } = useParams();

  const [logs,           setLogs]           = useState<any[]>([]);
  const [gatewayInfo,    setGatewayInfo]    = useState<any>(null);
  const [loading,        setLoading]        = useState(true);

  const [isEditMode,     setIsEditMode]     = useState(false);
  const [editConfig,     setEditConfig]     = useState<WidgetItem[]>([]);
  const [selectedIdx,    setSelectedIdx]    = useState<number | null>(null);
  const [layouts,        setLayouts]        = useState<RGLLayout[]>([]);
  const [chartDataMap,   setChartDataMap]   = useState<Record<string, any[]>>({});
  const [containerWidth, setContainerWidth] = useState(1200);

  // ── Floating panel drag state ─────────────────────────────────────────────
  const [panelPos,        setPanelPos]        = useState({ x: 100, y: 80 });
  const [isDraggingPanel, setIsDraggingPanel] = useState(false);
  const dragOffset = React.useRef({ x: 0, y: 0 });

  const isReadOnly = isReadOnlyRole(getLocalUser()?.role);

  useEffect(() => {
    setPanelPos({ x: window.innerWidth - 320, y: 80 });
  }, []);

  const onPanelMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingPanel(true);
    dragOffset.current = { x: e.clientX - panelPos.x, y: e.clientY - panelPos.y };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDraggingPanel) return;
      setPanelPos({
        x: Math.max(0, Math.min(window.innerWidth  - 300, e.clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.current.y)),
      });
    };
    const onUp = () => setIsDraggingPanel(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
  }, [isDraggingPanel]);

  // ── Grid container width ──────────────────────────────────────────────────
  const gridRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!gridRef.current) return;
    const obs = new ResizeObserver((entries) => setContainerWidth(entries[0].contentRect.width));
    obs.observe(gridRef.current);
    return () => obs.disconnect();
  }, []);

  // ── Fetch chart data dari backend (pre-aggregated) ────────────────────────
  const fetchChartDataForWidgets = useCallback(async (configList: WidgetItem[]) => {
    if (!gatewayId || !configList.length) return;

    const chartWidgets = configList.filter((item) => item.type === "chart" || item.type === "bar");
    if (!chartWidgets.length) return;

    const newMap: Record<string, any[]> = {};

    await Promise.all(
      chartWidgets.map(async (item, idx) => {
        const isMulti   = item.type === "chart" && (item.keys?.length ?? 0) > 1;
        const keysParam = isMulti ? item.keys!.join(",") : item.key;
        const range     = item.range ?? "1h";
        if (!keysParam) return;

        // ✅ FIX: pakai idx bukan index
        const mapKey = `${item.type}-${idx}-${item.key}`;

        try {
          const res = await fetch(
            `${API_BASE}/gateways/${gatewayId}/chart?range=${range}&keys=${keysParam}`,
            { method: "GET", cache: "no-store", headers: getAuthHeaders() }
          );
          if (res.ok) {
            const r = await res.json();
            newMap[mapKey] = r.data ?? [];
          }
        } catch (err) {
          console.error(`Chart fetch error (idx ${idx}):`, err);
        }
      })
    );

    setChartDataMap((prev) => ({ ...prev, ...newMap }));
  }, [gatewayId]);

  // ── Polling gateway data ──────────────────────────────────────────────────
  const fetchAllData = useCallback(async () => {
    if (!gatewayId) return;
    try {
      const res = await fetch(`${API_BASE}/gateways/${gatewayId}`, {
        method: "GET", cache: "no-store", headers: getAuthHeaders(),
      });
      if (res.ok) {
        const r    = await res.json();
        const data = r.data;
        if (data) {
          setGatewayInfo(data);
          setLogs(data.logs ?? []);
          const cfg: WidgetItem[] = data.config ?? [];
          if (!isEditMode) {
            setEditConfig(cfg);
            setLayouts(cfg.map((item, i) => itemToLayout(item, i)));
            fetchChartDataForWidgets(cfg);
          } else {
            fetchChartDataForWidgets(editConfig);
          }
        }
      }
    } catch (err) {
      console.error("fetchAllData error:", err);
    } finally {
      setLoading(false);
    }
  }, [gatewayId, isEditMode, editConfig, fetchChartDataForWidgets]);

  useEffect(() => {
    fetchAllData();
    const iv = setInterval(fetchAllData, 5000);
    return () => clearInterval(iv);
  }, [fetchAllData]);

  const isOnline = (() => {
    if (!gatewayInfo?.last_ping) return false;
    return (Date.now() - new Date(gatewayInfo.last_ping).getTime()) / 1000 < 60;
  })();

  // ── Layout change ─────────────────────────────────────────────────────────
  const onLayoutChange = (newLayout: RGLLayout[]) => {
    setLayouts(newLayout);
    setEditConfig((prev) => prev.map((item, i) => {
      const l = newLayout.find((n) => n.i === String(i));
      if (!l) return item;
      return { ...item, gridPos: { x: l.x, y: l.y, w: l.w, h: l.h } };
    }));
  };

  // ── Widget CRUD ───────────────────────────────────────────────────────────
  const addWidget = () => {
    if (isReadOnly) return;
    const newItem: WidgetItem = { key: "", label: "", type: "value", unit: "", size: "small", range: "1h" };
    const newIdx = editConfig.length;
    const gp     = defaultGridPos("value", newIdx);
    newItem.gridPos = gp;
    setEditConfig([...editConfig, newItem]);
    setLayouts([...layouts, { i: String(newIdx), x: gp.x, y: gp.y, w: gp.w, h: gp.h, minW: 1, minH: 1 }]);
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
      // Re-fetch chart jika range/key berubah
      if (field === "range" || field === "key" || field === "keys") {
        fetchChartDataForWidgets(updated);
      }
      return updated;
    });
  };

  // ── Save ──────────────────────────────────────────────────────────────────
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
          project_id: gatewayInfo?.project_id ? Number(gatewayInfo.project_id) : null,
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

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading && !gatewayInfo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="mt-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Syncing stream...</p>
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
          style={{ left: panelPos.x, top: panelPos.y, maxHeight: "80vh" }}
        >
          <div
            onMouseDown={onPanelMouseDown}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 text-white cursor-grab active:cursor-grabbing shrink-0 select-none rounded-t-2xl"
          >
            <div className="flex gap-0.5 shrink-0">
              {[...Array(8)].map((_, i) => <div key={i} className="w-0.5 h-3 bg-white/40 rounded-full" />)}
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest flex-1 text-center">Panel Settings</span>
            <button
              onClick={() => setSelectedIdx(null)}
              className="p-0.5 hover:bg-white/20 rounded transition-colors border-none bg-transparent text-white cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
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
            <span className="text-[9px] text-blue-200 hidden sm:inline">
              — Klik panel untuk setting, drag untuk pindah, tarik pojok untuk resize
            </span>
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
              Gateway #{gatewayId}
            </p>
          </div>

          {!isReadOnly && !isEditMode && (
            <button onClick={() => setIsEditMode(true)} title="Edit Layout"
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-blue-600 transition-all shadow-sm cursor-pointer">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* ── GRID ─────────────────────────────────────────────────────────── */}
        <div ref={gridRef}>
          {editConfig.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-12 text-center">
              <LayoutGrid className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto mb-2.5" />
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                {isEditMode ? 'Klik "+ Panel" di atas untuk tambah panel' : 'Klik ikon pensil untuk mulai edit'}
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
              {editConfig.map((item, index) => {
                // ✅ FIX: key konsisten dengan yang dipakai di fetchChartDataForWidgets
                const chartWidgetIdx = editConfig
                  .filter((w) => w.type === "chart" || w.type === "bar")
                  .findIndex((_, i) => {
                    const chartItems = editConfig.filter((w) => w.type === "chart" || w.type === "bar");
                    return chartItems[i] === item;
                  });
                const mapKey = (item.type === "chart" || item.type === "bar")
                  ? `${item.type}-${chartWidgetIdx}-${item.key}`
                  : "";
                const serverChartData = mapKey ? (chartDataMap[mapKey] ?? []) : [];

                return (
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
                      serverChartData={serverChartData}
                    />
                  </div>
                );
              })}
            </GridLayout>
          )}
        </div>

      </div>
    </div>
  );
}