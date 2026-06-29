"use client";
import React, { useMemo } from "react";
import {
  ResponsiveContainer, AreaChart, Area,
  BarChart, Bar, XAxis, YAxis,
  Tooltip, LineChart, Line,
} from "recharts";
import { Hash, TrendingUp, Gauge, ToggleLeft, BarChart2, Activity, Plus, X, Settings2 } from "lucide-react";
import {
  WidgetItem, WIDGET_TYPES, RANGE_OPTIONS,
  getActiveRange, getChartData, getSparklineData,
  isStatusOn, defaultColor, resolveThresholdColor,
  applyTransform, applyDivisor, ThresholdItem,
} from "@/lib/widget-config";

// ─── Constants ────────────────────────────────────────────────────────────────

export const MULTI_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

const DIVISOR_OPTIONS = [
  { value: 1,    label: "÷1"    },
  { value: 10,   label: "÷10"   },
  { value: 100,  label: "÷100"  },
  { value: 1000, label: "÷1000" },
];

const SWATCH = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4","#f97316","#84cc16","#ffffff","#94a3b8","#1e293b"];

export type KeyRow = { key: string; color: string; divisor: number };

interface WidgetCardProps {
  item: WidgetItem;
  index: number;
  isEditMode: boolean;
  isSelected: boolean;
  isOnline: boolean;
  logs: any[];
  latestPayload: Record<string, any>;
  onSelect: (index: number) => void;
}

// ─── Root card ───────────────────────────────────────────────────────────────

export function WidgetCard({
  item, index, isEditMode, isSelected, isOnline, logs, latestPayload, onSelect,
}: WidgetCardProps) {
  const isChart     = item.type === "chart" || item.type === "bar";
  const color       = item.color ?? defaultColor(item.type);
  const rawValue    = latestPayload[item.key];
  const activeColor = resolveThresholdColor(rawValue, item.thresholds, color, item.divisor);

  const chartData = useMemo(() => {
  if (!isChart) return [];
  const data = getChartData(item, logs);
  console.log("CHART DEBUG:", {
    label: item.label,
    key: item.key,
    keys: item.keys,
    range: item.range,
    logsCount: logs.length,
    sampleLog: logs[logs.length - 1],
    chartDataCount: data.length,
    chartDataSample: data[0],
  });
  return data;
}, [item, logs, isChart]);
  
  const sparkData = useMemo(() => item.type === "trend" ? getSparklineData(item, logs) : [], [item, logs]);

  return (
    <div
      onClick={() => { if (isEditMode) onSelect(index); }}
      className={`rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col h-full bg-white dark:bg-slate-800 ${
        isEditMode
          ? isSelected
            ? "border-blue-500 ring-2 ring-blue-300 dark:ring-blue-700 shadow-xl cursor-pointer"
            : "border-slate-300 dark:border-slate-600 hover:border-blue-300 cursor-pointer hover:shadow-md"
          : "border-slate-200 dark:border-slate-700 shadow-sm"
      }`}
    >
      {isEditMode && (
        <div className={`flex items-center gap-1 px-3 py-1 text-[8px] font-black uppercase tracking-widest border-b shrink-0 ${
          isSelected
            ? "bg-blue-500 text-white border-blue-500"
            : "bg-slate-50 dark:bg-slate-900/50 text-slate-400 border-slate-100 dark:border-slate-700"
        }`}>
          <Settings2 className="w-2.5 h-2.5" />
          {isSelected ? "Dipilih — setting di panel kanan" : "Klik untuk setting"}
        </div>
      )}
      <div className="flex-1 min-h-0">
        <WidgetDisplay
          item={item} isOnline={isOnline} color={activeColor}
          rawValue={rawValue} chartData={chartData} sparkData={sparkData}
          activeRangeLabel={getActiveRange(item.range).label}
        />
      </div>
    </div>
  );
}

// ─── DISPLAY ─────────────────────────────────────────────────────────────────

function WidgetDisplay({ item, isOnline, color, rawValue, chartData, sparkData, activeRangeLabel }: {
  item: WidgetItem; isOnline: boolean; color: string; rawValue: any;
  chartData: any[]; sparkData: { val: number }[]; activeRangeLabel: string;
}) {
  const isChart = item.type === "chart" || item.type === "bar";
  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOnline ? "animate-pulse" : ""}`}
            style={{ backgroundColor: isOnline ? "#10b981" : "#f87171" }} />
          <span className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate">
            {item.label || "SENSOR"}
          </span>
        </div>
        {isChart && (
          <span className="text-[8px] font-black uppercase text-slate-300 dark:text-slate-600 bg-slate-50 dark:bg-slate-900/40 px-1.5 py-0.5 rounded-md shrink-0 ml-2">
            {activeRangeLabel}
          </span>
        )}
      </div>
      <div className="flex-1 flex items-center justify-center min-h-0">
        {item.type === "value"  && <ValueDisplay  rawValue={rawValue} unit={item.unit} color={color} isOnline={isOnline} divisor={item.divisor} />}
        {item.type === "trend"  && <TrendDisplay  rawValue={rawValue} unit={item.unit} color={color} isOnline={isOnline} sparkData={sparkData} divisor={item.divisor} />}
        {item.type === "gauge"  && <GaugeDisplay  rawValue={rawValue} unit={item.unit} color={color} min={item.min ?? 0} max={item.max ?? 100} divisor={item.divisor} />}
        {item.type === "status" && <StatusDisplay rawValue={rawValue} color={color} offColor={item.offColor} isOnline={isOnline} />}
        {item.type === "chart"  && <AreaDisplay   data={chartData} color={color} item={item} />}
        {item.type === "bar"    && <BarDisplay    data={chartData} color={color} item={item} />}
      </div>
    </div>
  );
}

// ─── VALUE ───────────────────────────────────────────────────────────────────

function ValueDisplay({ rawValue, unit, color, isOnline, divisor }: {
  rawValue: any; unit?: string; color: string; isOnline: boolean; divisor?: number;
}) {
  const display = applyTransform(rawValue, divisor);
  return (
    <div className="flex flex-col items-center gap-2 w-full px-2">
      <span
        className={`font-black tracking-tighter leading-none text-center ${isOnline ? "" : "opacity-25"}`}
        style={{ color: isOnline ? color : undefined, fontSize: "clamp(2.5rem, 10cqw, 5rem)" }}
      >
        {display}
      </span>
      {unit && <span className="text-base font-black text-slate-400 dark:text-slate-500 tracking-wider">{unit}</span>}
    </div>
  );
}

// ─── TREND ───────────────────────────────────────────────────────────────────

function TrendDisplay({ rawValue, unit, color, isOnline, sparkData, divisor }: {
  rawValue: any; unit?: string; color: string; isOnline: boolean;
  sparkData: { val: number }[]; divisor?: number;
}) {
  const display = applyTransform(rawValue, divisor);
  const prev    = sparkData.length > 1 ? sparkData[sparkData.length - 2].val : null;
  const curr    = applyDivisor(rawValue, divisor);
  const delta   = prev !== null ? curr - prev : null;

  return (
    <div className="w-full flex flex-col items-center gap-1 px-2">
      <div className="flex items-baseline gap-2 flex-wrap justify-center">
        <span
          className={`font-black tracking-tighter leading-none ${isOnline ? "" : "opacity-25"}`}
          style={{ color: isOnline ? color : undefined, fontSize: "clamp(2.5rem, 10cqw, 4.5rem)" }}
        >
          {display}
        </span>
        {unit && <span className="text-base font-black text-slate-400">{unit}</span>}
        {delta !== null && Math.abs(delta) >= 0.005 && (
          <span className={`text-sm font-black ${delta > 0 ? "text-rose-500" : "text-emerald-500"}`}>
            {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}
          </span>
        )}
      </div>
      {sparkData.length > 1 && (
        <div className="w-full" style={{ height: 40 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData}>
              <Line type="monotone" dataKey="val" stroke={color} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── GAUGE ───────────────────────────────────────────────────────────────────

function GaugeDisplay({ rawValue, unit, color, min, max, divisor }: {
  rawValue: any; unit?: string; color: string; min: number; max: number; divisor?: number;
}) {
  const num     = applyDivisor(rawValue, divisor);
  const pct     = isNaN(num) ? 0 : Math.min(1, Math.max(0, (num - min) / (max - min)));
  const display = applyTransform(rawValue, divisor);

  const R = 40; const cx = 60; const cy = 58;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const arcX  = (d: number) => cx + R * Math.cos(toRad(d));
  const arcY  = (d: number) => cy + R * Math.sin(toRad(d));
  const startDeg = 135; const endDeg = 45;
  const fillDeg  = startDeg + pct * 270;

  const bgPath       = `M ${arcX(startDeg)} ${arcY(startDeg)} A ${R} ${R} 0 1 1 ${arcX(endDeg)} ${arcY(endDeg)}`;
  const arcSpanDeg   = fillDeg - startDeg;
  const largeArcFlag = arcSpanDeg > 180 ? 1 : 0;
  const MIN_PCT      = 0.037;
  const fillPath     = pct >= MIN_PCT
    ? `M ${arcX(startDeg)} ${arcY(startDeg)} A ${R} ${R} 0 ${largeArcFlag} 1 ${arcX(fillDeg)} ${arcY(fillDeg)}`
    : null;

  return (
    <div className="w-full flex flex-col items-center">
      <svg viewBox="0 0 120 90" className="w-full max-w-[200px]">
        <path d={bgPath} fill="none" stroke="#e2e8f0" strokeWidth="7" strokeLinecap="round" className="dark:stroke-slate-700" />
        {fillPath && <path d={fillPath} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" style={{ transition: "stroke 0.4s ease" }} />}
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize="18" fontWeight="900" fill={color} style={{ transition: "fill 0.4s ease" }}>
          {display}
        </text>
        {unit && <text x={cx} y={cy + 23} textAnchor="middle" fontSize="9" fontWeight="700" fill="#94a3b8">{unit}</text>}
        <text x={arcX(startDeg) - 2} y={arcY(startDeg) + 10} textAnchor="middle" fontSize="7" fontWeight="700" fill="#94a3b8">{min}</text>
        <text x={arcX(endDeg) + 2}   y={arcY(endDeg) + 10}   textAnchor="middle" fontSize="7" fontWeight="700" fill="#94a3b8">{max}</text>
      </svg>
    </div>
  );
}

// ─── STATUS ──────────────────────────────────────────────────────────────────

function StatusDisplay({ rawValue, color, offColor, isOnline }: {
  rawValue: any; color: string; offColor?: string; isOnline: boolean;
}) {
  const on     = isOnline && isStatusOn(rawValue);
  const offClr = offColor ?? "#94a3b8";
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-16 h-8 rounded-full transition-all duration-300"
        style={{ backgroundColor: on ? color : offClr }}>
        <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${on ? "left-9" : "left-1"}`} />
      </div>
      <span className="text-base font-black uppercase tracking-widest" style={{ color: on ? color : offClr }}>
        {on ? "ON" : "OFF"}
      </span>
    </div>
  );
}

// ─── AREA CHART ──────────────────────────────────────────────────────────────

function AreaDisplay({ data, color, item }: { data: any[]; color: string; item: WidgetItem }) {
  const isMulti = item.type === "chart" && (item.keys?.length ?? 0) > 1;
  const keys    = isMulti ? item.keys! : [item.key];
  const indexed = React.useMemo(() => data.map((d, i) => ({ ...d, _idx: i })), [data]);
  const getColor = (i: number) => isMulti ? (item.colors?.[i] ?? MULTI_COLORS[i % MULTI_COLORS.length]) : color;

  return (
    <div className="w-full h-full" style={{ minHeight: 100 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={indexed} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <defs>
            {keys.map((k, i) => (
              <linearGradient key={k} id={`grad-${k}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={getColor(i)} stopOpacity={0.25} />
                <stop offset="100%" stopColor={getColor(i)} stopOpacity={0}    />
              </linearGradient>
            ))}
          </defs>
          <XAxis dataKey="_idx" tick={{ fontSize: 8, fill: "#94a3b8" }} tickLine={false} axisLine={false}
            tickFormatter={(idx) => indexed[idx]?.time ?? ""} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 8, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
          <Tooltip
            allowEscapeViewBox={{ x: false, y: false }}
            contentStyle={{ fontSize: "10px", fontWeight: 700, borderRadius: "10px", border: "1px solid #e2e8f0", padding: "6px 10px", backgroundColor: "#fff" }}
            formatter={(value: any, name: string) => [
              typeof value === "number" ? String(parseFloat(value.toPrecision(10))) : value,
              isMulti ? name : item.key,
            ]}
            labelFormatter={(idx) => indexed[Number(idx)]?.time ?? ""}
            labelStyle={{ color: "#94a3b8", marginBottom: 4 }}
          />
          {keys.map((k, i) => (
            <Area key={k} type="monotone" dataKey={isMulti ? k : "val"} name={k}
              stroke={getColor(i)} strokeWidth={2} fill={`url(#grad-${k}-${i})`} dot={false} activeDot={{ r: 4 }} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── BAR CHART ───────────────────────────────────────────────────────────────

function BarDisplay({ data, color, item }: { data: any[]; color: string; item: WidgetItem }) {
  const indexed = React.useMemo(() => data.map((d, i) => ({ ...d, _idx: i })), [data]);
  return (
    <div className="w-full h-full" style={{ minHeight: 100 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={indexed} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barCategoryGap="25%">
          <XAxis dataKey="_idx" tick={{ fontSize: 8, fill: "#94a3b8" }} tickLine={false} axisLine={false}
            tickFormatter={(idx) => indexed[idx]?.time ?? ""} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 8, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
          <Tooltip
            allowEscapeViewBox={{ x: false, y: false }}
            contentStyle={{ fontSize: "10px", fontWeight: 700, borderRadius: "10px", border: "1px solid #e2e8f0", padding: "4px 8px", backgroundColor: "#fff" }}
            formatter={(value: any) => [
              typeof value === "number" ? String(parseFloat(value.toPrecision(10))) : value,
              item.key || "val",
            ]}
            labelFormatter={(idx) => indexed[Number(idx)]?.time ?? ""}
            labelStyle={{ color: "#94a3b8", marginBottom: 2 }}
            cursor={{ fill: `${color}15` }}
          />
          <Bar dataKey="val" fill={color} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── WIDGET SETTINGS PANEL ───────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

interface WidgetSettingsPanelProps {
  item: WidgetItem;
  index: number;
  onUpdate: (index: number, field: string, value: any) => void;
  onRemove: (index: number) => void;
  onClose: () => void;
}

export function WidgetSettingsPanel({ item, index, onUpdate, onRemove, onClose }: WidgetSettingsPanelProps) {
  const isChart  = item.type === "chart" || item.type === "bar";
  const isGauge  = item.type === "gauge";
  const isTrend  = item.type === "trend";
  const isValue  = item.type === "value";
  const isStatus = item.type === "status";

  // ── Baris dinamis area chart ──────────────────────────────────────────────
  const initRows = (): KeyRow[] => {
    const keys = item.keys?.length ? item.keys : (item.key ? [item.key] : [""]);
    return keys.map((k, i) => ({
      key:     k,
      color:   item.colors?.[i]      ?? MULTI_COLORS[i % MULTI_COLORS.length],
      divisor: item.keyDivisors?.[i] ?? 1,
    }));
  };

  const [rows, setRows] = React.useState<KeyRow[]>(initRows);
  const [customDivisor, setCustomDivisor] = React.useState<string>(
    item.divisor && ![1,10,100,1000].includes(item.divisor) ? String(item.divisor) : ""
  );

  const syncRows = (next: KeyRow[]) => {
    setRows(next);
    onUpdate(index, "key",         next[0]?.key ?? "");
    onUpdate(index, "keys",        next.length > 1 ? next.map((r) => r.key) : []);
    onUpdate(index, "colors",      next.map((r) => r.color));
    onUpdate(index, "keyDivisors", next.map((r) => r.divisor));
  };

  const addRow    = () => syncRows([...rows, { key: "", color: MULTI_COLORS[rows.length % MULTI_COLORS.length], divisor: 1 }]);
  const removeRow = (i: number) => syncRows(rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows);
  const updateRow = (i: number, field: keyof KeyRow, val: any) =>
    syncRows(rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

  const isMultiKey  = item.type === "chart" && rows.length > 1;
  const hasEmptyKey = rows.some((r) => !r.key.trim());

  const thresholds: ThresholdItem[] = item.thresholds ?? [];
  const addThreshold    = () => onUpdate(index, "thresholds", [...thresholds, { value: 0, color: "#ef4444", label: "" }]);
  const removeThreshold = (i: number) => onUpdate(index, "thresholds", thresholds.filter((_, idx) => idx !== i));
  const updateThreshold = (i: number, field: keyof ThresholdItem, val: any) =>
    onUpdate(index, "thresholds", thresholds.map((t, idx) => idx === i ? { ...t, [field]: val } : t));

  const inp = "w-full mt-1 bg-slate-50 dark:bg-slate-900/60 rounded-lg px-3 py-2 text-[11px] font-medium outline-none focus:ring-2 ring-blue-200 dark:ring-blue-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 placeholder:text-slate-300 dark:placeholder:text-slate-600";
  const lbl = "text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest";
  const sec = "text-[8px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.2em] pt-3 pb-1 border-t border-slate-100 dark:border-slate-700/50 mt-1";

  const ColorSwatch = ({ field, value }: { field: string; value?: string }) => (
    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
      {SWATCH.map((c) => (
        <button key={c} onClick={() => onUpdate(index, field, c)}
          className={`w-5 h-5 rounded-full border-2 transition-all cursor-pointer ${value === c ? "border-slate-600 scale-110" : "border-transparent"}`}
          style={{ backgroundColor: c }} />
      ))}
      <input type="color" value={value ?? "#3b82f6"} onChange={(e) => onUpdate(index, field, e.target.value)}
        className="w-5 h-5 rounded-full cursor-pointer border-0 p-0 bg-transparent" />
    </div>
  );

  const DivisorBlock = () => (
    <div>
      <label className={lbl}>Pembagi Nilai (Divisor)</label>
      <p className="text-[9px] text-slate-400 mb-1.5">Raw ÷ divisor = nilai tampil. Contoh: 300 ÷ 10 = 30</p>
      <div className="flex gap-1.5 flex-wrap">
        {DIVISOR_OPTIONS.map((d) => (
          <button key={d.value}
            onClick={() => { onUpdate(index, "divisor", d.value); setCustomDivisor(""); }}
            className={`px-2.5 py-1 rounded-lg text-[9px] font-black border transition-all cursor-pointer ${
              (item.divisor ?? 1) === d.value && !customDivisor
                ? "bg-indigo-500 border-indigo-500 text-white"
                : "bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300"
            }`}>
            {d.label}
          </button>
        ))}
        <input type="number" min={1} placeholder="custom"
          className="w-20 bg-slate-50 dark:bg-slate-900/60 rounded-lg px-2.5 py-1 text-[11px] font-mono font-bold outline-none border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:ring-2 ring-indigo-200"
          value={customDivisor}
          onChange={(e) => {
            setCustomDivisor(e.target.value);
            const n = Number(e.target.value);
            if (n > 0) onUpdate(index, "divisor", n);
          }} />
      </div>
      {item.divisor && item.divisor !== 1 && (
        <p className="text-[9px] text-indigo-500 mt-1.5 font-bold">
          Preview: raw 300 → {applyTransform(300, item.divisor)}
        </p>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700 shrink-0">
        <div>
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Panel Settings</p>
          <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate mt-0.5">
            {item.label || "Widget " + (index + 1)}
          </p>
        </div>
        <button onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border-none bg-transparent cursor-pointer text-slate-400">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3.5">

        {/* Tipe */}
        <div>
          <label className={lbl}>Tipe Tampilan</label>
          <div className="grid grid-cols-3 gap-1.5 mt-1.5">
            {WIDGET_TYPES.map((t) => (
              <button key={t.value}
                onClick={() => onUpdate(index, "type", t.value)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-center transition-all cursor-pointer ${
                  item.type === t.value
                    ? "border-blue-400 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400"
                    : "border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300 bg-transparent"
                }`}>
                <span>{({"hash":<Hash className="w-3.5 h-3.5"/>,"trending-up":<TrendingUp className="w-3.5 h-3.5"/>,"gauge":<Gauge className="w-3.5 h-3.5"/>,"toggle":<ToggleLeft className="w-3.5 h-3.5"/>,"area":<Activity className="w-3.5 h-3.5"/>,"bar":<BarChart2 className="w-3.5 h-3.5"/>} as any)[t.icon]}</span>
                <span className="text-[8px] font-black uppercase tracking-wide leading-none">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Label */}
        <div>
          <label className={lbl}>Label</label>
          <input className={inp} placeholder="Suhu Ruangan" value={item.label}
            onChange={(e) => onUpdate(index, "label", e.target.value)} />
        </div>

        {/* MQTT Key (non-chart) */}
        {!isChart && (
          <div>
            <label className={lbl}>MQTT Key</label>
            <input className={`${inp} font-mono text-blue-600 dark:text-blue-400`} placeholder="temp_c"
              value={item.key} onChange={(e) => onUpdate(index, "key", e.target.value)} />
          </div>
        )}

        {/* Satuan (non-status) */}
        {!isStatus && (
          <div>
            <label className={lbl}>Satuan</label>
            <input className={inp} placeholder="°C" autoCapitalize="none"
              value={item.unit ?? ""} onChange={(e) => onUpdate(index, "unit", e.target.value)} />
          </div>
        )}

        {/* Divisor (value, gauge, trend, bar) */}
        {(isValue || isGauge || isTrend || item.type === "bar") && (
          <>
            <div className={sec}>Transformasi Nilai</div>
            <DivisorBlock />
          </>
        )}

        {/* Warna aksen (non-status, non-multi-chart) */}
        {!isStatus && (!isChart || item.type === "bar" || !isMultiKey) && (
          <div>
            <label className={lbl}>Warna Aksen</label>
            <ColorSwatch field="color" value={item.color} />
          </div>
        )}

        {/* Status: warna ON + OFF */}
        {isStatus && (
          <div className="space-y-3">
            <div>
              <label className={lbl}>Warna saat ON</label>
              <ColorSwatch field="color" value={item.color} />
            </div>
            <div>
              <label className={lbl}>Warna saat OFF</label>
              <ColorSwatch field="offColor" value={item.offColor} />
            </div>
          </div>
        )}

        {/* Gauge min/max + warna */}
        {isGauge && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={lbl}>Min</label>
                <input type="number" className={inp} placeholder="0" value={item.min ?? ""}
                  onChange={(e) => onUpdate(index, "min", Number(e.target.value))} />
              </div>
              <div>
                <label className={lbl}>Max</label>
                <input type="number" className={inp} placeholder="100" value={item.max ?? ""}
                  onChange={(e) => onUpdate(index, "max", Number(e.target.value))} />
              </div>
            </div>
            <div>
              <label className={lbl}>Warna Aksen</label>
              <ColorSwatch field="color" value={item.color} />
            </div>
          </>
        )}

        {/* Bar: MQTT Key */}
        {item.type === "bar" && (
          <div>
            <label className={lbl}>MQTT Key</label>
            <input className={`${inp} font-mono text-blue-600 dark:text-blue-400`} placeholder="temp_c"
              value={item.key} onChange={(e) => { onUpdate(index, "key", e.target.value); onUpdate(index, "keys", []); }} />
          </div>
        )}

        {/* Area: baris dinamis */}
        {item.type === "chart" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className={lbl}>MQTT Keys</label>
              <button onClick={addRow}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors cursor-pointer bg-transparent">
                <Plus className="w-3 h-3" /> Tambah Garis
              </button>
            </div>
            {hasEmptyKey && <p className="text-[9px] text-amber-500 font-bold">⚠ Isi semua MQTT key</p>}
            <div className="space-y-2">
              {rows.map((row, i) => (
                <div key={i} className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Garis {i + 1}</span>
                    {rows.length > 1 && (
                      <button onClick={() => removeRow(i)} className="p-0.5 text-rose-400 hover:text-rose-600 rounded transition-colors border-none bg-transparent cursor-pointer">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <input
                    className={`w-full bg-white dark:bg-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] font-mono font-medium outline-none focus:ring-2 ring-blue-200 dark:ring-blue-800 text-blue-600 dark:text-blue-400 border placeholder:text-slate-300 ${!row.key.trim() ? "border-amber-300" : "border-slate-200 dark:border-slate-600"}`}
                    placeholder="CHWS" value={row.key} onChange={(e) => updateRow(i, "key", e.target.value)} />
                  <div className="flex items-center gap-1 flex-wrap">
                    {["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4","#f97316"].map((c) => (
                      <button key={c} onClick={() => updateRow(i, "color", c)}
                        className={`w-3.5 h-3.5 rounded-full border-2 cursor-pointer transition-all ${row.color === c ? "border-slate-600 scale-110" : "border-transparent"}`}
                        style={{ backgroundColor: c }} />
                    ))}
                    <input type="color" value={row.color} onChange={(e) => updateRow(i, "color", e.target.value)}
                      className="w-3.5 h-3.5 rounded-full cursor-pointer border-0 p-0 bg-transparent" />
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[8px] text-slate-400 font-black uppercase mr-1">÷</span>
                    {[1, 10, 100, 1000].map((d) => (
                      <button key={d} onClick={() => updateRow(i, "divisor", d)}
                        className={`px-1.5 py-0.5 rounded text-[8px] font-black border cursor-pointer transition-all ${
                          row.divisor === d ? "bg-indigo-500 border-indigo-500 text-white" : "bg-transparent border-slate-200 dark:border-slate-600 text-slate-400"
                        }`}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Range */}
        {isChart && (
          <div>
            <label className={lbl}>Rentang Waktu</label>
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {RANGE_OPTIONS.map((r) => (
                <button key={r.value} onClick={() => onUpdate(index, "range", r.value)}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-black border transition-all cursor-pointer ${
                    (item.range ?? "1h") === r.value
                      ? "bg-amber-400 border-amber-400 text-white"
                      : "bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300"
                  }`}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Thresholds (gauge, value, trend) */}
        {(isGauge || isValue || isTrend) && (
          <div className="space-y-2">
            <div className={sec}>Thresholds</div>
            <p className="text-[9px] text-slate-400">
              Warna berubah saat nilai (setelah divisor) melewati threshold.
            </p>
            {[...thresholds]
              .map((t, i) => ({ ...t, _i: i }))
              .sort((a, b) => a.value - b.value)
              .map(({ _i, value: tVal, color: tColor, label: tLabel }) => (
                <div key={_i} className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
                  <input type="color" value={tColor} onChange={(e) => updateThreshold(_i, "color", e.target.value)}
                    className="w-6 h-6 rounded-full cursor-pointer border-0 p-0 bg-transparent shrink-0" />
                  <input type="number"
                    className="flex-1 bg-slate-50 dark:bg-slate-900/60 rounded-md px-2 py-1 text-[11px] font-mono font-bold outline-none border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-slate-200 min-w-0"
                    placeholder="Nilai" value={tVal}
                    onChange={(e) => updateThreshold(_i, "value", Number(e.target.value))} />
                  <input
                    className="w-16 bg-slate-50 dark:bg-slate-900/60 rounded-md px-2 py-1 text-[10px] font-medium outline-none border border-slate-100 dark:border-slate-700 text-slate-500 min-w-0"
                    placeholder="Label" value={tLabel ?? ""}
                    onChange={(e) => updateThreshold(_i, "label", e.target.value)} />
                  <button onClick={() => removeThreshold(_i)}
                    className="p-1 text-rose-400 hover:text-rose-600 rounded transition-colors border-none bg-transparent cursor-pointer shrink-0">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            <button onClick={addThreshold}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 text-[9px] font-black text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-all cursor-pointer bg-transparent">
              <Plus className="w-3 h-3" /> Tambah Threshold
            </button>
          </div>
        )}

      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 shrink-0">
        <button onClick={() => { onRemove(index); onClose(); }}
          className="w-full py-2 rounded-xl text-[9px] font-black uppercase tracking-widest text-rose-500 border border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer bg-transparent">
          Hapus Panel
        </button>
      </div>
    </div>
  );
}