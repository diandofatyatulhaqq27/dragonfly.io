// src/lib/api.ts
// Satu sumber kebenaran untuk API base URL & helper auth.
// Semua page.tsx tinggal import dari sini, tidak perlu define ulang.

export const API_BASE = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api`;

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

export function getUserRole(): string {
  return getLocalUser()?.role ?? "client_user";
}

export function isReadOnlyRole(role?: string): boolean {
  const r = role ?? getUserRole();
  return r === "rasindo_user" || r === "client_user";
}