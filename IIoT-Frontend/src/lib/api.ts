// src/lib/api.ts
// Satu sumber kebenaran untuk API base URL & helper auth.
// Semua page.tsx tinggal import dari sini, tidak perlu define ulang.

const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const API_BASE = `${RAW_API_URL}/api`;
// Base buat asset statis (foto gateway dll) yang di-serve dari /uploads,
// BUKAN /api — jadi tidak boleh pakai API_BASE.
export const ASSET_BASE = RAW_API_URL;

/** Ubah path relatif ("/uploads/gateways/xxx.jpg") jadi URL absolut ke backend. */
export function resolveAssetUrl(path?: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${ASSET_BASE}${path}`;
}

export interface LocalUser {
  id: number;
  name: string;
  role: string;
  company_id: number;
}

export function getLocalUser(): LocalUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("iiot_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getLocalToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("iiot_token") ?? "";
}

export function getAuthHeaders(): Record<string, string> {
  const token = getLocalToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  // 🌟 X-User-Id dihapus total — itu jalur bypass auth kedua.
  // Backend sekarang HANYA percaya JWT bertanda tangan lewat Authorization header.
  if (token) headers["Authorization"] = `Bearer ${token}`;

  return headers;
}

/** Auth headers TANPA Content-Type — dipakai buat FormData/file upload,
 *  soalnya browser wajib set Content-Type multipart/form-data + boundary
 *  sendiri. Kalau kita set manual di sini, boundary-nya hilang & request gagal. */
export function getAuthHeadersMultipart(): Record<string, string> {
  const token = getLocalToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export function getUserRole(): string {
  return getLocalUser()?.role ?? "client_user";
}

export function isReadOnlyRole(role?: string): boolean {
  const r = role ?? getUserRole();
  return r === "rasindo_user" || r === "client_user";
}

export function canManageAssets(role?: string): boolean {
  const r = role ?? getUserRole();
  return r === "admin" || r === "rasindo_operator";
}