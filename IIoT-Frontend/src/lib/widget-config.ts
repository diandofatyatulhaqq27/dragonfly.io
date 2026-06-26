// src/lib/widget-config.ts

export type WidgetType = "value" | "chart" | "bar" | "gauge" | "status" | "trend";

export interface ThresholdItem {
  value: number;
  color: string;
  label?: string;
}

export interface GridPos {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WidgetItem {
  key: string;
  keys?: string[];
  colors?: string[];
  keyDecimals?: number[];
  keyDivisors?: number[];
  label: string;
  type: WidgetType;
  unit?: string;
  size?: string;
  range?: string;
  min?: number;
  max?: number;
  onValue?: string;
  color?: string;
  offColor?: string;
  divisor?: number;
  decimalPlaces?: number;
  thresholds?: ThresholdItem[];
  gridPos?: GridPos;
}

// ─── Widget type metadata ─────────────────────────────────────────────────────

export const WIDGET_TYPES: {
  value: WidgetType;
  label: string;
  desc: string;
  icon: string;
  defaultSize: string;
}[] = [
  { value: "value",  label: "Nilai",  desc: "Angka real-time besar",   icon: "hash",        defaultSize: "small"  },
  { value: "trend",  label: "Tren",   desc: "Nilai + sparkline mini",   icon: "trending-up", defaultSize: "small"  },
  { value: "gauge",  label: "Gauge",  desc: "Meter setengah lingkaran", icon: "gauge",       defaultSize: "small"  },
  { value: "status", label: "Status", desc: "Indikator ON / OFF",       icon: "toggle",      defaultSize: "small"  },
  { value: "chart",  label: "Area",   desc: "Grafik area historis",     icon: "area",        defaultSize: "medium" },
  { value: "bar",    label: "Bar",    desc: "Grafik batang historis",   icon: "bar",         defaultSize: "medium" },
];

// ─── Value transform helpers ──────────────────────────────────────────────────

/**
 * Cek apakah raw value valid (bukan null, undefined, string kosong, atau whitespace).
 * HMI Haiwell kadang kirim string kosong "" saat nilai belum terbaca dari PLC.
 */
function isValidValue(value: any): boolean {
  if (value === null || value === undefined) return false;
  const str = String(value).trim();
  if (str === "" || str === "-") return false;
  return !isNaN(Number(str));
}

/**
 * Terapkan divisor ke raw value. Return NaN jika value tidak valid.
 * Aman terhadap string kosong dari HMI.
 */
export function applyDivisor(value: any, divisor?: number): number {
  if (!isValidValue(value)) return NaN;
  const num = Number(String(value).trim());
  const div = divisor && divisor !== 0 ? divisor : 1;
  return num / div;
}

/**
 * Format raw value untuk display. Return "—" jika value tidak valid.
 * Handles: null, undefined, string kosong "", whitespace " ", non-numeric.
 */
export function applyTransform(
  value: any,
  divisor?: number,
  decimalPlaces?: number
): string {
  if (!isValidValue(value)) return "—";
  const num    = Number(String(value).trim());
  const div    = divisor && divisor !== 0 ? divisor : 1;
  const result = num / div;

  if (decimalPlaces === undefined || decimalPlaces < 0) {
    return String(parseFloat(result.toPrecision(10)));
  }
  return result.toFixed(decimalPlaces);
}

// ─── Default grid sizes ───────────────────────────────────────────────────────

export function defaultGridPos(type: WidgetType, index: number): GridPos {
  const isWide = type === "chart" || type === "bar";
  if (isWide) {
    const col = index % 2;
    const row = Math.floor(index / 2);
    return { x: col * 40, y: row * 4, w: 40, h: 4 };
  } else {
    const col = index % 4;
    const row = Math.floor(index / 4);
    return { x: col * 20, y: row * 3, w: 20, h: 3 };
  }
}

// ─── Size (legacy) ────────────────────────────────────────────────────────────

export const SIZE_OPTIONS = [
  { value: "small",  label: "Kecil",  colSpan: "col-span-1"                  },
  { value: "medium", label: "Sedang", colSpan: "md:col-span-2"               },
  { value: "large",  label: "Besar",  colSpan: "md:col-span-2 xl:col-span-3" },
];

export function getSizeClass(size: string | undefined, type: WidgetType): string {
  const found = SIZE_OPTIONS.find((s) => s.value === size);
  if (found) return found.colSpan;
  return type === "chart" || type === "bar" ? "md:col-span-2" : "col-span-1";
}

// ─── Range ────────────────────────────────────────────────────────────────────

export const RANGE_OPTIONS = [
  { value: "1h",  label: "1 Jam",   ms: 60 * 60 * 1000           },
  { value: "6h",  label: "6 Jam",   ms: 6 * 60 * 60 * 1000       },
  { value: "24h", label: "24 Jam",  ms: 24 * 60 * 60 * 1000      },
  { value: "7d",  label: "7 Hari",  ms: 7 * 24 * 60 * 60 * 1000  },
  { value: "30d", label: "30 Hari", ms: 30 * 24 * 60 * 60 * 1000 },
];

export function getActiveRange(rangeValue?: string) {
  return RANGE_OPTIONS.find((r) => r.value === (rangeValue ?? "1h")) ?? RANGE_OPTIONS[0];
}

// ─── Threshold ────────────────────────────────────────────────────────────────

export function resolveThresholdColor(
  value: any,
  thresholds: ThresholdItem[] | undefined,
  baseColor: string,
  divisor?: number
): string {
  if (!thresholds || thresholds.length === 0) return baseColor;
  const num = applyDivisor(value, divisor);
  if (isNaN(num)) return baseColor; // value kosong → pakai warna base
  const sorted = [...thresholds].sort((a, b) => a.value - b.value);
  let active = baseColor;
  for (const t of sorted) {
    if (num >= t.value) active = t.color;
  }
  return active;
}

// ─── Chart data ───────────────────────────────────────────────────────────────

export function getChartData(item: WidgetItem, logs: any[]) {
  const rangeOpt = getActiveRange(item.range);
  const cutoff   = Date.now() - rangeOpt.ms;
  const isMulti  = item.type === "chart" && (item.keys?.length ?? 0) > 1;

  const filtered = logs.filter((l) => l.created_at && new Date(l.created_at).getTime() >= cutoff);
  const sampled  = filtered.length > 200 ? filtered.slice(-200) : filtered;

  return sampled.map((l) => {
    const time = rangeOpt.ms > 24 * 60 * 60 * 1000
      ? new Date(l.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })
      : new Date(l.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

    if (isMulti) {
      const point: any = { time };
      item.keys!.forEach((k, i) => {
        const raw = l.payload?.[k];
        const div = item.keyDivisors?.[i] ?? 1;
        // Skip nilai kosong di chart — null agar recharts tidak plot titik
        point[k] = isValidValue(raw) ? Number(raw) / (div || 1) : null;
      });
      return point;
    }

    const raw = l.payload?.[item.key];
    const div = item.divisor ?? 1;
    // null agar recharts tidak plot titik untuk data kosong
    return { time, val: isValidValue(raw) ? Number(raw) / (div || 1) : null };
  });
}

export function getSparklineData(item: WidgetItem, logs: any[]) {
  return logs.slice(-20).map((l) => {
    const raw = l.payload?.[item.key];
    const div = item.divisor ?? 1;
    return { val: isValidValue(raw) ? Number(raw) / (div || 1) : 0 };
  });
}

export function getLatestPayload(logs: any[]): Record<string, any> {
  if (logs.length === 0) return {};
  const raw = logs[logs.length - 1].payload;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw ?? {};
}

export function isStatusOn(value: any, onValue?: string): boolean {
  if (value === null || value === undefined) return false;
  const v = String(value).toLowerCase().trim();
  if (v === "") return false; // string kosong dari HMI → OFF
  if (onValue) return v === onValue.toLowerCase().trim();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

export function defaultColor(type: WidgetType): string {
  const map: Record<WidgetType, string> = {
    value: "#3b82f6", trend: "#8b5cf6", gauge: "#f59e0b",
    status: "#10b981", chart: "#3b82f6", bar: "#6366f1",
  };
  return map[type] ?? "#3b82f6";
}