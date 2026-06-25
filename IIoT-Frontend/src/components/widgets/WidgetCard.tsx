"use client";
import React, { useMemo } from "react";
import {
  ResponsiveContainer, AreaChart, Area,
  BarChart, Bar, XAxis, YAxis,
  Tooltip, LineChart, Line,
} from "recharts";
import { Trash2, Hash, TrendingUp, Gauge, ToggleLeft, BarChart2, Activity } from "lucide-react";
import {
  WidgetItem, WIDGET_TYPES, SIZE_OPTIONS, RANGE_OPTIONS,
  getSizeClass, getActiveRange, getChartData, getSparklineData,
  isStatusOn, defaultColor,
} from "@/lib/widget-config";

// ─── Constants ───────────────────────────────────────────────────────────────

const MULTI_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
const DECIMAL_OPTIONS = [
  { value: -1, label: "Auto" },
  { value: 0,  label: "0" },
  { value: 1,  label: "0.0" },
  { value: 2,  label: "0.00" },
  { value: 3,  label: "0.000" },
];

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatVal(value: any, decimals?: number): string {
  if (value === null || value === undefined) return "—";
  const num = Number(value);
  if (isNaN(num)) return String(value);
  if (decimals === undefined || decimals < 0) return String(value);
  return num.toFixed(decimals);
}

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

  const chartData   = useMemo(() => isChart ? getChartData(item, logs) : [], [item, logs, isChart]);
  const sparkData   = useMemo(() => item.type === "trend" ? getSparklineData(item, logs) : [], [item, logs]);
  const latestValue = latestPayload[item.key];

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
  const isChart    = item.type === "chart" || item.type === "bar";
  const isGauge    = item.type === "gauge";
  const isTrend    = item.type === "trend";
  const isStatus   = item.type === "status";
  const isMultiKey = item.type === "chart" && (item.keys?.length ?? 0) > 1;

  const [rawKeys, setRawKeys] = React.useState<string>(
    item.keys?.length ? item.keys.join(", ") : item.key
  );

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

      {/* Label */}
      <div>
        <label className={lbl}>Label</label>
        <input
          className={inp}
          placeholder="Suhu Ruangan"
          value={item.label}
          onChange={(e) => onUpdate(index, "label", e.target.value)}
        />
      </div>

      {/* MQTT Key — hanya untuk non-chart */}
      {!isChart && (
        <div>
          <label className={lbl}>MQTT Key</label>
          <input
            className={`${inp} font-mono text-blue-600 dark:text-blue-400`}
            placeholder="temp_c"
            value={item.key}
            onChange={(e) => onUpdate(index, "key", e.target.value)}
          />
        </div>
      )}

      {/* Unit + Size — satuan disembunyikan untuk status */}
      <div className={`grid gap-2 ${isStatus ? "grid-cols-1" : "grid-cols-2"}`}>
        {!isStatus && (
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
        )}
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

      {/* Desimal — untuk gauge dan trend */}
      {(isGauge || isTrend) && (
        <div>
          <label className={lbl}>Format Desimal</label>
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {DECIMAL_OPTIONS.map((d) => (
              <button
                key={d.value}
                onClick={() => onUpdate(index, "decimals", d.value)}
                className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide border transition-all cursor-pointer ${
                  (item.decimals ?? -1) === d.value
                    ? "bg-blue-500 border-blue-500 text-white"
                    : "bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Warna aksen — non-chart, bar, atau area single key */}
      {(!isChart || item.type === "bar" || !isMultiKey) && (
        <div>
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
      )}

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

      {/* Bar: MQTT key tunggal */}
      {item.type === "bar" && (
        <div>
          <label className={lbl}>MQTT Key</label>
          <input
            className={`${inp} font-mono text-blue-600 dark:text-blue-400`}
            placeholder="temp_c"
            value={item.key}
            onChange={(e) => {
              onUpdate(index, "key", e.target.value);
              onUpdate(index, "keys", []);
            }}
          />
        </div>
      )}

      {/* Area: multi key */}
      {item.type === "chart" && (
        <div className="space-y-3">
          <div>
            <label className={lbl}>MQTT Keys (pisah koma untuk multi-garis)</label>
            <input
              className={`${inp} font-mono text-blue-600 dark:text-blue-400`}
              placeholder="CHWS, CHWR, INVRTR"
              value={rawKeys}
              onChange={(e) => {
                const raw = e.target.value;
                setRawKeys(raw);
                if (raw.endsWith(",") || raw.endsWith(", ") || raw.endsWith(" ")) return;
                const arr = raw.split(",").map((s) => s.trim()).filter(Boolean);
                if (arr.length > 1) {
                  onUpdate(index, "keys", arr);
                  onUpdate(index, "key", arr[0]);
                } else {
                  onUpdate(index, "keys", []);
                  onUpdate(index, "key", raw.trim());
                }
              }}
            />
            <p className="text-[9px] text-slate-400 mt-1">Contoh: CHWS, CHWR — akan jadi 2 garis berbeda</p>
          </div>

          {/* Color + Decimal per key — hanya muncul jika multi key */}
          {isMultiKey && (
            <div className="space-y-3">
              <div>
                <label className={lbl}>Warna Per Garis</label>
                <div className="space-y-2 mt-1.5">
                  {item.keys!.map((k, i) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-blue-600 dark:text-blue-400 w-16 truncate shrink-0">{k}</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4","#f97316"].map((c) => {
                          const isSelected = (item.colors?.[i] ?? MULTI_COLORS[i % MULTI_COLORS.length]) === c;
                          return (
                            <button
                              key={c}
                              onClick={() => {
                                const updated = [...(item.colors ?? item.keys!.map((_, idx) => MULTI_COLORS[idx % MULTI_COLORS.length]))];
                                updated[i] = c;
                                onUpdate(index, "colors", updated);
                              }}
                              className={`w-4 h-4 rounded-full border-2 transition-all cursor-pointer ${isSelected ? "border-slate-600 scale-110" : "border-transparent"}`}
                              style={{ backgroundColor: c }}
                            />
                          );
                        })}
                        <input
                          type="color"
                          value={item.colors?.[i] ?? MULTI_COLORS[i % MULTI_COLORS.length]}
                          onChange={(e) => {
                            const updated = [...(item.colors ?? item.keys!.map((_, idx) => MULTI_COLORS[idx % MULTI_COLORS.length]))];
                            updated[i] = e.target.value;
                            onUpdate(index, "colors", updated);
                          }}
                          className="w-4 h-4 rounded-full cursor-pointer border-0 p-0 bg-transparent"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Decimal per key */}
              <div>
                <label className={lbl}>Desimal Per Garis</label>
                <div className="space-y-2 mt-1.5">
                  {item.keys!.map((k, i) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-blue-600 dark:text-blue-400 w-16 truncate shrink-0">{k}</span>
                      <div className="flex gap-1 flex-wrap">
                        {DECIMAL_OPTIONS.map((d) => {
                          const current = item.keyDecimals?.[i] ?? -1;
                          return (
                            <button
                              key={d.value}
                              onClick={() => {
                                const updated = [...(item.keyDecimals ?? item.keys!.map(() => -1))];
                                updated[i] = d.value;
                                onUpdate(index, "keyDecimals", updated);
                              }}
                              className={`px-2 py-0.5 rounded-md text-[9px] font-black border transition-all cursor-pointer ${
                                current === d.value
                                  ? "bg-blue-500 border-blue-500 text-white"
                                  : "bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300"
                              }`}
                            >
                              {d.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Range — untuk semua chart */}
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
  chartData: any[];
  sparkData: { val: number }[];
  activeRangeLabel: string;
}) {
  return (
    <div className="p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOnline ? "animate-pulse" : ""}`}
            style={{ backgroundColor: isOnline ? "#10b981" : "#f87171" }}
          />
          <span className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate">
            {item.label || "SENSOR"}
          </span>
        </div>
        {(item.type === "chart" || item.type === "bar") && (
          <span className="text-[8px] font-black uppercase text-slate-300 dark:text-slate-600 bg-slate-50 dark:bg-slate-900/40 px-1.5 py-0.5 rounded-md shrink-0 ml-2">
            {activeRangeLabel}
          </span>
        )}
      </div>

      {item.type === "value"  && <ValueDisplay  value={latestValue} unit={item.unit} color={color} isOnline={isOnline} />}
      {item.type === "trend"  && <TrendDisplay  value={latestValue} unit={item.unit} color={color} isOnline={isOnline} sparkData={sparkData} decimals={item.decimals} />}
      {item.type === "gauge"  && <GaugeDisplay  value={latestValue} unit={item.unit} color={color} min={item.min ?? 0} max={item.max ?? 100} decimals={item.decimals} />}
      {item.type === "status" && <StatusDisplay value={latestValue} label={item.label} color={color} onValue={item.onValue} isOnline={isOnline} />}
      {item.type === "chart"  && <AreaDisplay   data={chartData} color={color} item={item} />}
      {item.type === "bar"    && <BarDisplay    data={chartData} color={color} />}
    </div>
  );
}

// ─── VALUE ───────────────────────────────────────────────────────────────────

function ValueDisplay({ value, unit, color, isOnline }: { value: any; unit?: string; color: string; isOnline: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-1.5">
      <span
        className={`text-6xl font-black tracking-tighter transition-all ${isOnline ? "" : "opacity-25"}`}
        style={{ color: isOnline ? color : undefined }}
      >
        {value ?? "—"}
      </span>
      {unit && (
        <span className="text-sm font-black text-slate-400 dark:text-slate-500 tracking-wider">{unit}</span>
      )}
    </div>
  );
}

// ─── TREND ───────────────────────────────────────────────────────────────────

function TrendDisplay({ value, unit, color, isOnline, sparkData, decimals }: {
  value: any; unit?: string; color: string; isOnline: boolean; sparkData: { val: number }[]; decimals?: number;
}) {
  const prev      = sparkData.length > 1 ? sparkData[sparkData.length - 2].val : null;
  const curr      = Number(value ?? 0);
  const delta     = prev !== null ? curr - prev : null;
  const displayed = formatVal(value, decimals);

  return (
    <div className="flex flex-col gap-1 mt-auto">
      <div className="flex items-baseline gap-1.5">
        <span
          className={`text-5xl font-black tracking-tighter ${isOnline ? "" : "opacity-25"}`}
          style={{ color: isOnline ? color : undefined }}
        >
          {displayed}
        </span>
        {unit && <span className="text-sm font-black text-slate-400">{unit}</span>}
        {delta !== null && Math.abs(delta) >= 0.005 && (
          <span className={`text-[10px] font-black ml-1 ${delta > 0 ? "text-rose-500" : "text-emerald-500"}`}>
            {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(decimals !== undefined && decimals >= 0 ? decimals : 1)}
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

function GaugeDisplay({ value, unit, color, min, max, decimals }: {
  value: any; unit?: string; color: string; min: number; max: number; decimals?: number;
}) {
  const num       = Number(value ?? min);
  const pct       = Math.min(1, Math.max(0, (num - min) / (max - min)));
  const displayed = formatVal(value, decimals);

  const R  = 38;
  const cx = 55, cy = 55;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const arcX  = (deg: number) => cx + R * Math.cos(toRad(deg));
  const arcY  = (deg: number) => cy + R * Math.sin(toRad(deg));

  const startDeg = 135;
  const endDeg   = 45;
  const fillDeg  = startDeg + pct * 270;

  const bgPath   = `M ${arcX(startDeg)} ${arcY(startDeg)} A ${R} ${R} 0 1 1 ${arcX(endDeg)} ${arcY(endDeg)}`;
  const fillPath = pct > 0
    ? `M ${arcX(startDeg)} ${arcY(startDeg)} A ${R} ${R} 0 ${pct > 0.5 ? 1 : 0} 1 ${arcX(fillDeg)} ${arcY(fillDeg)}`
    : null;

  return (
    <div className="flex flex-col items-center mt-1">
      <svg width="140" height="100" viewBox="0 0 110 80">
        <path d={bgPath} fill="none" stroke="#e2e8f0" strokeWidth="8" strokeLinecap="round" className="dark:stroke-slate-700" />
        {fillPath && <path d={fillPath} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" />}
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="20" fontWeight="900" fill={color}>{displayed}</text>
        {unit && <text x={cx} y={cy + 26} textAnchor="middle" fontSize="10" fontWeight="700" fill="#94a3b8">{unit}</text>}
        <text x="10" y="76" fontSize="8" fontWeight="700" fill="#cbd5e1">{min}</text>
        <text x="92" y="76" fontSize="8" fontWeight="700" fill="#cbd5e1" textAnchor="end">{max}</text>
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
      <div
        className={`relative w-16 h-8 rounded-full transition-all duration-300 ${on ? "" : "bg-slate-200 dark:bg-slate-700"}`}
        style={{ backgroundColor: on ? color : undefined }}
      >
        <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${on ? "left-9" : "left-1"}`} />
      </div>
      <span className="text-base font-black uppercase tracking-widest" style={{ color: on ? color : "#94a3b8" }}>
        {on ? "ON" : "OFF"}
      </span>
    </div>
  );
}

// ─── AREA CHART ──────────────────────────────────────────────────────────────

function AreaDisplay({ data, color, item }: {
  data: any[];
  color: string;
  item: WidgetItem;
}) {
  const isMulti = item.type === "chart" && (item.keys?.length ?? 0) > 1;
  const keys    = isMulti ? item.keys! : [item.key];

  const indexed = React.useMemo(() => data.map((d, i) => ({ ...d, _idx: i })), [data]);

  const getColor = (i: number) => {
    if (!isMulti) return color;
    return item.colors?.[i] ?? MULTI_COLORS[i % MULTI_COLORS.length];
  };

  const getDecimals = (i: number): number | undefined => {
    if (!isMulti) return undefined;
    const d = item.keyDecimals?.[i] ?? -1;
    return d < 0 ? undefined : d;
  };

  return (
    <div className="h-36 w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={indexed} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <defs>
            {keys.map((k, i) => (
              <linearGradient key={k} id={`grad-${k}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={getColor(i)} stopOpacity={0.2} />
                <stop offset="100%" stopColor={getColor(i)} stopOpacity={0}   />
              </linearGradient>
            ))}
          </defs>
          <XAxis dataKey="_idx" tick={{ fontSize: 8, fill: "#94a3b8" }} tickLine={false} axisLine={false}
            tickFormatter={(idx) => indexed[idx]?.time ?? ""}
            interval="preserveStartEnd"
          />
          <YAxis tick={{ fontSize: 8, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
          <Tooltip
            allowEscapeViewBox={{ x: false, y: false }}
            contentStyle={{
              fontSize: "10px",
              fontWeight: 700,
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
              padding: "6px 10px",
              backgroundColor: "#fff",
            }}
            formatter={(value: any, name: string, props: any) => {
              // cari index key untuk ambil decimals yang sesuai
              const keyIdx = isMulti ? keys.indexOf(name) : 0;
              const dec    = getDecimals(keyIdx);
              return [formatVal(value, dec), isMulti ? name : item.key];
            }}
            labelFormatter={(idx) => indexed[Number(idx)]?.time ?? ""}
            labelStyle={{ color: "#94a3b8", marginBottom: 4 }}
          />
          {keys.map((k, i) => (
            <Area
              key={k}
              type="monotone"
              dataKey={isMulti ? k : "val"}
              name={k}
              stroke={getColor(i)}
              strokeWidth={2}
              fill={`url(#grad-${k}-${i})`}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── BAR CHART ───────────────────────────────────────────────────────────────

function BarDisplay({ data, color }: { data: { time: string; val: number }[]; color: string }) {
  const indexed = React.useMemo(() => data.map((d, i) => ({ ...d, _idx: i })), [data]);

  return (
    <div className="h-36 w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={indexed} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barCategoryGap="25%">
          <XAxis dataKey="_idx" tick={{ fontSize: 8, fill: "#94a3b8" }} tickLine={false} axisLine={false}
            tickFormatter={(idx) => indexed[idx]?.time ?? ""}
            interval="preserveStartEnd"
          />
          <YAxis tick={{ fontSize: 8, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
          <Tooltip
            allowEscapeViewBox={{ x: false, y: false }}
            contentStyle={{ fontSize: "10px", fontWeight: 700, borderRadius: "10px", border: "1px solid #e2e8f0", padding: "4px 8px", backgroundColor: "#fff" }}
            formatter={(value: any) => [value, "val"]}
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