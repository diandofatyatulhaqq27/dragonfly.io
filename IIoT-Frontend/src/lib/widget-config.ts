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

// ─── Value transform helper ───────────────────────────────────────────────────

/**
 * Terapkan divisor lalu format ke decimalPlaces.
 * Contoh: applyTransform(300, 10, 1) → "30.0"
 *         applyTransform(300, 1, -1)  → "300"
 *         applyTransform(300, 10, 0)  → "30"
 */
export function applyTransform(
  value: any,
  divisor?: number,
  decimalPlaces?: number
): string {
  if (value === null || value === undefined) return "—";
  const num = Number(value);
  if (isNaN(num)) return String(value);

  const div    = divisor && divisor !== 0 ? divisor : 1;
  const result = num / div;

  if (decimalPlaces === undefined || decimalPlaces < 0) {
    // Auto: hilangkan trailing zero yang tidak perlu
    return String(parseFloat(result.toPrecision(10)));
  }
  return result.toFixed(decimalPlaces);
}


/**
 * Cek apakah raw value valid (bukan null, undefined, string kosong, atau non-numerik).
 */
export function isValidValue(value: any): boolean {
  if (value === null || value === undefined) return false;
  const str = String(value).trim();
  if (str === "" || str === "-") return false;
  return !isNaN(Number(str));
}

/**
 * Terapkan divisor ke nilai numerik (tanpa format string).
 * Dipakai untuk kalkulasi threshold, gauge fill, dll.
 */
export function applyDivisor(value: any, divisor?: number): number {
  const num = Number(value ?? 0);
  if (isNaN(num)) return 0;
  const div = divisor && divisor !== 0 ? divisor : 1;
  return num / div;
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

/**
 * Threshold dibandingkan terhadap nilai SETELAH dibagi divisor.
 */
export function resolveThresholdColor(
  value: any,
  thresholds: ThresholdItem[] | undefined,
  baseColor: string,
  divisor?: number
): string {
  if (!thresholds || thresholds.length === 0) return baseColor;
  const num = applyDivisor(value, divisor);
  if (isNaN(num)) return baseColor;
  const sorted = [...thresholds].sort((a, b) => a.value - b.value);
  let active = baseColor;
  for (const t of sorted) {
    if (num >= t.value) active = t.color;
  }
  return active;
}

// ─── Chart data dengan time-bucketing ────────────────────────────────────────
//
// Bucket size per range (standar Grafana/InfluxDB):
//   1h  → per 1 menit  → max ~60 titik
//   6h  → per 5 menit  → max ~72 titik
//   24h → per 15 menit → max ~96 titik
//   7d  → per 1 jam    → max ~168 titik
//   30d → per 6 jam    → max ~120 titik
//
// Setiap bucket = rata-rata semua data dalam window tersebut.
// Bucket aktif (terakhir/belum penuh) update real-time otomatis.

const BUCKET_MS: Record<string, number> = {
  "1h":  1  * 60 * 1000,
  "6h":  60  * 60 * 1000,
  "24h": 60 * 60 * 1000,
  "7d":  24 * 60 * 60 * 1000,
  "30d": 24 * 60 * 60 * 1000,
};

function formatBucketTime(ts: number, rangeMs: number): string {
  const d = new Date(ts);
  if (rangeMs >= 7 * 24 * 60 * 60 * 1000) {
    // 7d / 30d: tampilkan tanggal "12 Jun"
    return d.toLocaleDateString("id-ID", { 
      day: "2-digit", 
      month: "short",
      timeZone: "Asia/Jakarta"
    });
  }
  if (rangeMs >= 24 * 60 * 60 * 1000) {
    // 24h / 6h: tampilkan jam "14:00"
    return d.toLocaleTimeString("id-ID", { 
      hour: "2-digit", 
      minute: "2-digit",
      timeZone: "Asia/Jakarta"
    });
  }
  // 1h: tampilkan menit "14:05"
  return d.toLocaleTimeString("id-ID", { 
    hour: "2-digit", 
    minute: "2-digit",
    timeZone: "Asia/Jakarta"
  });
}

export function getChartData(item: WidgetItem, logs: any[]) {
  const rangeOpt = getActiveRange(item.range);
  const bucketMs = BUCKET_MS[item.range ?? "1h"] ?? BUCKET_MS["1h"];
  const isMulti  = item.type === "chart" && (item.keys?.length ?? 0) > 1;

  const latestTs = logs.length > 0
    ? new Date(logs[logs.length - 1].created_at).getTime()
    : Date.now();
  const cutoff = latestTs - rangeOpt.ms;

  const filtered = logs.filter(
    (l) => l.created_at && new Date(l.created_at).getTime() >= cutoff
  );
  if (filtered.length === 0) return [];

  // Kelompokkan ke bucket
  const buckets = new Map<number, any[]>();
  for (const l of filtered) {
    const ts     = new Date(l.created_at).getTime();
    const bucket = Math.floor(ts / bucketMs) * bucketMs;
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket)!.push(l);
  }

  // Sort ascending dan hitung rata-rata per bucket
  return Array.from(buckets.keys())
    .sort((a, b) => a - b)
    .map((bucketTs) => {
      const group = buckets.get(bucketTs)!;
      const time  = formatBucketTime(bucketTs, rangeOpt.ms);

      if (isMulti) {
        const point: any = { time };
        item.keys!.forEach((k, i) => {
          const div    = item.keyDivisors?.[i] ?? 1;
          const vals   = group
            .map((l) => l.payload?.[k])
            .filter((v) => isValidValue(v))
            .map((v) => Number(v) / (div || 1));
          point[k] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
        });
        return point;
      }

      const div  = item.divisor ?? 1;
      const vals = group
        .map((l) => l.payload?.[item.key])
        .filter((v) => isValidValue(v))
        .map((v) => Number(v) / (div || 1));

      return {
        time,
        val: vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
      };
    });
}

export function getSparklineData(item: WidgetItem, logs: any[]) {
  return logs.slice(-20).map((l) => {
    const raw = Number(l.payload?.[item.key] ?? 0);
    const div = item.divisor ?? 1;
    return { val: div && div !== 0 ? raw / div : raw };
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