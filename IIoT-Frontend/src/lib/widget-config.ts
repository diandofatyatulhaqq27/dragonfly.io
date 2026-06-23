// src/lib/widget-config.ts

export type WidgetType = "value" | "chart" | "bar" | "gauge" | "status" | "trend";

export interface WidgetItem {
  key: string;
  label: string;
  type: WidgetType;
  unit?: string;
  size?: string;
  range?: string;
  /** Untuk gauge: nilai minimum (default 0) */
  min?: number;
  /** Untuk gauge: nilai maksimum (default 100) */
  max?: number;
  /** Untuk status: nilai yang dianggap "ON" (default "1" / "true" / "on") */
  onValue?: string;
  /** Warna aksen widget, hex. Default otomatis per tipe. */
  color?: string;
}

// ─── Widget type metadata (untuk picker UI) ─────────────────────────────────

export const WIDGET_TYPES: {
  value: WidgetType;
  label: string;
  desc: string;
  icon: string;
  defaultSize: string;
}[] = [
  { value: "value",  label: "Nilai",    desc: "Angka real-time besar",        icon: "hash",       defaultSize: "small"  },
  { value: "trend",  label: "Tren",     desc: "Nilai + sparkline mini",        icon: "trending-up", defaultSize: "small" },
  { value: "gauge",  label: "Gauge",    desc: "Meter setengah lingkaran",      icon: "gauge",      defaultSize: "small"  },
  { value: "status", label: "Status",   desc: "Indikator ON / OFF",            icon: "toggle",     defaultSize: "small"  },
  { value: "chart",  label: "Area",     desc: "Grafik area historis",          icon: "area",       defaultSize: "medium" },
  { value: "bar",    label: "Bar",      desc: "Grafik batang historis",        icon: "bar",        defaultSize: "medium" },
];

// ─── Size ────────────────────────────────────────────────────────────────────

export const SIZE_OPTIONS = [
  { value: "small",  label: "Kecil",  colSpan: "col-span-1"                    },
  { value: "medium", label: "Sedang", colSpan: "md:col-span-2"                 },
  { value: "large",  label: "Besar",  colSpan: "md:col-span-2 xl:col-span-3"   },
];

export function getSizeClass(size: string | undefined, type: WidgetType): string {
  const found = SIZE_OPTIONS.find((s) => s.value === size);
  if (found) return found.colSpan;
  return type === "chart" || type === "bar" ? "md:col-span-2" : "col-span-1";
}

// ─── Range ───────────────────────────────────────────────────────────────────

export const RANGE_OPTIONS = [
  { value: "1h",  label: "1 Jam",   ms: 60 * 60 * 1000             },
  { value: "6h",  label: "6 Jam",   ms: 6 * 60 * 60 * 1000         },
  { value: "24h", label: "24 Jam",  ms: 24 * 60 * 60 * 1000        },
  { value: "7d",  label: "7 Hari",  ms: 7 * 24 * 60 * 60 * 1000    },
  { value: "30d", label: "30 Hari", ms: 30 * 24 * 60 * 60 * 1000   },
];

export function getActiveRange(rangeValue?: string) {
  return RANGE_OPTIONS.find((r) => r.value === (rangeValue ?? "1h")) ?? RANGE_OPTIONS[0];
}

// ─── Chart data ──────────────────────────────────────────────────────────────

export function getChartData(item: WidgetItem, logs: any[]) {
  const rangeOpt = getActiveRange(item.range);
  const cutoff   = Date.now() - rangeOpt.ms;

  const filtered = logs.filter((l) => l.created_at && new Date(l.created_at).getTime() >= cutoff);

  const sampled = filtered.length > 200
    ? filtered.filter((_, i) => i % Math.ceil(filtered.length / 200) === 0)
    : filtered;

  return sampled.map((l) => ({
    time: rangeOpt.ms > 24 * 60 * 60 * 1000
      ? new Date(l.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })
      : new Date(l.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    val: Number(l.payload?.[item.key] ?? 0),
  }));
}

/** Ambil sparkline (max 20 titik terakhir) untuk widget trend */
export function getSparklineData(item: WidgetItem, logs: any[]) {
  const recent = logs.slice(-20);
  return recent.map((l) => ({ val: Number(l.payload?.[item.key] ?? 0) }));
}

/** Payload terbaru dari logs */
export function getLatestPayload(logs: any[]): Record<string, any> {
  if (logs.length === 0) return {};
  const raw = logs[logs.length - 1].payload;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw ?? {};
}

/** Cek apakah nilai dianggap ON untuk widget status */
export function isStatusOn(value: any, onValue?: string): boolean {
  if (value === null || value === undefined) return false;
  const v = String(value).toLowerCase().trim();
  if (onValue) return v === onValue.toLowerCase().trim();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

/** Warna default per tipe widget */
export function defaultColor(type: WidgetType): string {
  const map: Record<WidgetType, string> = {
    value:  "#3b82f6",
    trend:  "#8b5cf6",
    gauge:  "#f59e0b",
    status: "#10b981",
    chart:  "#3b82f6",
    bar:    "#6366f1",
  };
  return map[type] ?? "#3b82f6";
}