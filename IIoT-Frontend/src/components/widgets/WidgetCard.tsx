// src/components/widgets/WidgetCard.tsx
"use client";
import React, { useMemo } from "react";
import {
  ResponsiveContainer, AreaChart, Area,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, LineChart, Line,
} from "recharts";
import { Trash2, Hash, TrendingUp, Gauge, ToggleLeft, BarChart2, Activity } from "lucide-react";
import {
  WidgetItem, WidgetType, WIDGET_TYPES, SIZE_OPTIONS, RANGE_OPTIONS,
  getSizeClass, getActiveRange, getChartData, getSparklineData,
  getLatestPayload, isStatusOn, defaultColor,
} from "@/lib/widget-config";

// ─── Props ───────────────────────────────────────────────────────────────────

interface WidgetCardProps {
  item: WidgetItem;
  index: number;
  isEditingConfig: boolean;
  isOnline: boolean;
  logs: any[];
  latestPayload: Record<string, any>;
  onUpdate: (index: number, field: string, value: any) => void;
  onRemove: (index: number) => void;
}

// ─── Icon map ────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, React.ReactNode> = {
  "hash":        <Hash className="w-4 h-4" />,
  "trending-up": <TrendingUp className="w-4 h-4" />,
  "gauge":       <Gauge className="w-4 h-4" />,
  "toggle":      <ToggleLeft className="w-4 h-4" />,
  "area":        <Activity className="w-4 h-4" />,
  "bar":         <BarChart2 className="w-4 h-4" />,
};

// ─── Root card ───────────────────────────────────────────────────────────────

export function WidgetCard({
  item, index, isEditingConfig, isOnline, logs, latestPayload, onUpdate, onRemove,
}: WidgetCardProps) {
  const isChart   = item.type === "chart" || item.type === "bar";
  const sizeClass = getSizeClass(item.size, item.type);
  const color     = item.color ?? defaultColor(item.type);

  const chartData    = useMemo(() => isChart ? getChartData(item, logs) : [],    [item, logs, isChart]);
  const sparkData    = useMemo(() => item.type === "trend" ? getSparklineData(item, logs) : [], [item, logs]);
  const latestValue  = latestPayload[item.key];

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col ${
        isEditingConfig
          ? "border-blue-400 dark:border-blue-500 ring-2 ring-blue-100 dark:ring-blue-950/40 shadow-lg bg-white dark:bg-slate-800"
          : "border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800"
      } ${sizeClass}`}
    >
      {isEditingConfig ? (
        <WidgetEditForm item={item} index={index} onUpdate={onUpdate} onRemove={onRemove} />
      ) : (
        <WidgetDisplay
          item={item}
          isOnline={isOnline}
          color={color}
          latestValue={latestValue}
          chartData={chartData}
          sparkData={sparkData}
          activeRangeLabel={getActiveRange(item.range).label}
        />
      )}
    </div>
  );
}

// ─── EDIT FORM ───────────────────────────────────────────────────────────────

function WidgetEditForm({
  item, index, onUpdate, onRemove,
}: {
  item: WidgetItem;
  index: number;
  onUpdate: (i: number, f: string, v: any) => void;
  onRemove: (i: number) => void;
}) {
  const isChart  = item.type === "chart" || item.type === "bar";
  const isGauge  = item.type === "gauge";
  const isStatus = item.type === "status";

  const inp = "w-full mt-1 bg-slate-50 dark:bg-slate-900/60 rounded-lg px-3 py-2 text-[11px] font-medium outline-none focus:ring-2 ring-blue-200 dark:ring-blue-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 placeholder:text-slate-300 dark:placeholder:text-slate-600";
  const lbl = "text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest";

  return (
    <div className="p-4 space-y-3.5 relative">

      {/* Delete */}
      <button
        onClick={() => onRemove(index)}
        className="absolute top-3 right-3 p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors border-none bg-transparent cursor-pointer"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {/* Type picker */}
      <div>
        <label className={lbl}>Tipe Tampilan</label>
        <div className="grid grid-cols-3 gap-1.5 mt-1.5">
          {WIDGET_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => {
                onUpdate(index, "type", t.value);
                if (!item.size) onUpdate(index, "size", t.defaultSize);
              }}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-center transition-all cursor-pointer ${
                item.type === t.value
                  ? "border-blue-400 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400"
                  : "border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300 hover:text-slate-600 dark:hover:text-slate-300 bg-transparent"
              }`}
            >
              <span className="text-current">{TYPE_ICONS[t.icon]}</span>
              <span className="text-[9px] font-black uppercase tracking-wide leading-none">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Label + Key */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={lbl}>Label</label>
          <input
            className={inp}
            placeholder="Suhu Ruangan"
            value={item.label}
            onChange={(e) => onUpdate(index, "label", e.target.value)}
          />
        </div>
        <div>
          <label className={lbl}>MQTT Key</label>
          <input
            className={`${inp} font-mono text-blue-600 dark:text-blue-400`}
            placeholder="temp_c"
            value={item.key}
            onChange={(e) => onUpdate(index, "key", e.target.value)}
          />
        </div>
      </div>

      {/* Unit + Size */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={lbl}>Satuan</label>
          <input
            className={inp}
            placeholder="°C"
            autoCapitalize="none"
            value={item.unit ?? ""}
            onChange={(e) => onUpdate(index, "unit", e.target.value)}
          />
        </div>
        <div>
          <label className={lbl}>Ukuran</label>
          <select
            className={`${inp} cursor-pointer`}
            value={item.size ?? "small"}
            onChange={(e) => onUpdate(index, "size", e.target.value)}
          >
            {SIZE_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Warna aksen */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className={lbl}>Warna Aksen</label>
          <div className="flex items-center gap-2 mt-1.5">
            {["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4","#f97316"].map((c) => (
              <button
                key={c}
                onClick={() => onUpdate(index, "color", c)}
                className={`w-5 h-5 rounded-full border-2 transition-all cursor-pointer ${item.color === c ? "border-slate-600 scale-110" : "border-transparent"}`}
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              type="color"
              value={item.color ?? defaultColor(item.type)}
              onChange={(e) => onUpdate(index, "color", e.target.value)}
              className="w-5 h-5 rounded-full cursor-pointer border-0 p-0 bg-transparent"
              title="Warna kustom"
            />
          </div>
        </div>
      </div>

      {/* Gauge min/max */}
      {isGauge && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={lbl}>Min</label>
            <input
              type="number"
              className={inp}
              placeholder="0"
              value={item.min ?? ""}
              onChange={(e) => onUpdate(index, "min", Number(e.target.value))}
            />
          </div>
          <div>
            <label className={lbl}>Max</label>
            <input
              type="number"
              className={inp}
              placeholder="100"
              value={item.max ?? ""}
              onChange={(e) => onUpdate(index, "max", Number(e.target.value))}
            />
          </div>
        </div>
      )}

      {/* Status ON value */}
      {isStatus && (
        <div>
          <label className={lbl}>Nilai "ON"</label>
          <input
            className={inp}
            placeholder='1 / true / on'
            value={item.onValue ?? ""}
            onChange={(e) => onUpdate(index, "onValue", e.target.value)}
          />
          <p className="text-[9px] text-slate-400 mt-1 ml-0.5">Nilai MQTT yang dianggap aktif/menyala</p>
        </div>
      )}

      {/* Chart range */}
      {isChart && (
        <div>
          <label className={lbl}>Rentang Waktu</label>
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {RANGE_OPTIONS.map((r) => (
              <button
                key={r.value}
                onClick={() => onUpdate(index, "range", r.value)}
                className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide border transition-all cursor-pointer ${
                  (item.range ?? "1h") === r.value
                    ? "bg-amber-400 border-amber-400 text-white"
                    : "bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DISPLAY ─────────────────────────────────────────────────────────────────

function WidgetDisplay({
  item, isOnline, color, latestValue, chartData, sparkData, activeRangeLabel,
}: {
  item: WidgetItem;
  isOnline: boolean;
  color: string;
  latestValue: any;
  chartData: { time: string; val: number }[];
  sparkData: { val: number }[];
  activeRangeLabel: string;
}) {
  return (
    <div className="p-4 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOnline ? "animate-pulse" : ""}`}
            style={{ backgroundColor: isOnline ? "#10b981" : "#f87171" }}
          />
          <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate">
            {item.label || "SENSOR"}
          </span>
        </div>
        {(item.type === "chart" || item.type === "bar") && (
          <span className="text-[8px] font-black uppercase text-slate-300 dark:text-slate-600 bg-slate-50 dark:bg-slate-900/40 px-1.5 py-0.5 rounded-md shrink-0 ml-2">
            {activeRangeLabel}
          </span>
        )}
      </div>

      {/* Body — each type */}
      {item.type === "value"  && <ValueDisplay  value={latestValue} unit={item.unit} color={color} isOnline={isOnline} />}
      {item.type === "trend"  && <TrendDisplay  value={latestValue} unit={item.unit} color={color} isOnline={isOnline} sparkData={sparkData} />}
      {item.type === "gauge"  && <GaugeDisplay  value={latestValue} unit={item.unit} color={color} min={item.min ?? 0} max={item.max ?? 100} />}
      {item.type === "status" && <StatusDisplay value={latestValue} label={item.label} color={color} onValue={item.onValue} isOnline={isOnline} />}
      {item.type === "chart"  && <AreaDisplay   data={chartData} color={color} />}
      {item.type === "bar"    && <BarDisplay    data={chartData} color={color} />}
    </div>
  );
}

// ─── VALUE ───────────────────────────────────────────────────────────────────

function ValueDisplay({ value, unit, color, isOnline }: { value: any; unit?: string; color: string; isOnline: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5 mt-auto pt-2">
      <span
        className={`text-5xl font-black tracking-tighter transition-all ${isOnline ? "" : "opacity-25"}`}
        style={{ color: isOnline ? color : undefined }}
      >
        {value ?? "—"}
      </span>
      {unit && (
        <span className="text-xs font-black text-slate-400 dark:text-slate-500 tracking-wider">{unit}</span>
      )}
    </div>
  );
}

// ─── TREND (value + sparkline) ───────────────────────────────────────────────

function TrendDisplay({ value, unit, color, isOnline, sparkData }: {
  value: any; unit?: string; color: string; isOnline: boolean; sparkData: { val: number }[];
}) {
  const prev  = sparkData.length > 1 ? sparkData[sparkData.length - 2].val : null;
  const curr  = Number(value ?? 0);
  const delta = prev !== null ? curr - prev : null;

  return (
    <div className="flex flex-col gap-1 mt-auto">
      <div className="flex items-baseline gap-1.5">
        <span
          className={`text-4xl font-black tracking-tighter ${isOnline ? "" : "opacity-25"}`}
          style={{ color: isOnline ? color : undefined }}
        >
          {value ?? "—"}
        </span>
        {unit && <span className="text-xs font-black text-slate-400">{unit}</span>}
        {delta !== null && (
          <span className={`text-[10px] font-black ml-1 ${delta > 0 ? "text-rose-500" : delta < 0 ? "text-emerald-500" : "text-slate-400"}`}>
            {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"} {Math.abs(delta).toFixed(1)}
          </span>
        )}
      </div>
      {sparkData.length > 1 && (
        <div style={{ height: 40 }}>
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

function GaugeDisplay({ value, unit, color, min, max }: {
  value: any; unit?: string; color: string; min: number; max: number;
}) {
  const num   = Number(value ?? min);
  const pct   = Math.min(1, Math.max(0, (num - min) / (max - min)));
  const angle = -135 + pct * 270; // sweep 270°

  // SVG arc helpers
  const R  = 38;
  const cx = 55, cy = 55;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const arcX  = (deg: number) => cx + R * Math.cos(toRad(deg));
  const arcY  = (deg: number) => cy + R * Math.sin(toRad(deg));

  const startDeg = 135;  // bottom-left
  const endDeg   = 45;   // bottom-right (going clockwise via top = 270° sweep)
  const fillDeg  = startDeg + pct * 270;

  const bgPath = `M ${arcX(startDeg)} ${arcY(startDeg)} A ${R} ${R} 0 1 1 ${arcX(endDeg)} ${arcY(endDeg)}`;
  const fillPath = pct > 0
    ? `M ${arcX(startDeg)} ${arcY(startDeg)} A ${R} ${R} 0 ${pct > 0.5 ? 1 : 0} 1 ${arcX(fillDeg)} ${arcY(fillDeg)}`
    : null;

  return (
    <div className="flex flex-col items-center mt-1">
      <svg width="110" height="80" viewBox="0 0 110 80">
        {/* Track */}
        <path d={bgPath} fill="none" stroke="#e2e8f0" strokeWidth="8" strokeLinecap="round" className="dark:stroke-slate-700" />
        {/* Fill */}
        {fillPath && (
          <path d={fillPath} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" />
        )}
        {/* Value */}
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="16" fontWeight="900" fill={color}>
          {value ?? "—"}
        </text>
        {unit && (
          <text x={cx} y={cy + 24} textAnchor="middle" fontSize="8" fontWeight="700" fill="#94a3b8">
            {unit}
          </text>
        )}
        {/* Min/Max labels */}
        <text x="10" y="76" fontSize="7" fontWeight="700" fill="#cbd5e1">{min}</text>
        <text x="92" y="76" fontSize="7" fontWeight="700" fill="#cbd5e1" textAnchor="end">{max}</text>
      </svg>
    </div>
  );
}

// ─── STATUS ──────────────────────────────────────────────────────────────────

function StatusDisplay({ value, label, color, onValue, isOnline }: {
  value: any; label: string; color: string; onValue?: string; isOnline: boolean;
}) {
  const on = isOnline && isStatusOn(value, onValue);

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-3 mt-auto">
      {/* Pill toggle visual */}
      <div
        className={`relative w-16 h-8 rounded-full transition-all duration-300 ${on ? "" : "bg-slate-200 dark:bg-slate-700"}`}
        style={{ backgroundColor: on ? color : undefined }}
      >
        <div
          className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${on ? "left-9" : "left-1"}`}
        />
      </div>
      <span
        className="text-sm font-black uppercase tracking-widest"
        style={{ color: on ? color : "#94a3b8" }}
      >
        {on ? "ON" : "OFF"}
      </span>
    </div>
  );
}

// ─── AREA CHART ──────────────────────────────────────────────────────────────

function AreaDisplay({ data, color }: { data: { time: string; val: number }[]; color: string }) {
  const gradId = `grad-${color.replace("#", "")}`;
  return (
    <div className="h-36 w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0}   />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-700/50" />
          <XAxis dataKey="time" tick={{ fontSize: 8, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 8, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ fontSize: "10px", fontWeight: 700, borderRadius: "10px", border: "1px solid #e2e8f0", padding: "4px 8px" }}
            itemStyle={{ color }}
          />
          <Area type="monotone" dataKey="val" stroke={color} strokeWidth={2} fill={`url(#${gradId})`} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── BAR CHART ───────────────────────────────────────────────────────────────

function BarDisplay({ data, color }: { data: { time: string; val: number }[]; color: string }) {
  return (
    <div className="h-36 w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-700/50" />
          <XAxis dataKey="time" tick={{ fontSize: 8, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 8, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ fontSize: "10px", fontWeight: 700, borderRadius: "10px", border: "1px solid #e2e8f0", padding: "4px 8px" }}
            itemStyle={{ color }}
            cursor={{ fill: `${color}10` }}
          />
          <Bar dataKey="val" fill={color} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}