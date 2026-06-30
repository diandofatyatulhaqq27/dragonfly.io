"use client";
import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  Wifi,
  Loader2,
  WifiOff,
  BellRing,
  ChevronRight,
  Radio,
} from "lucide-react";
import { AssetMap } from "@/components/maps/AssetMap";
import { API_BASE, getAuthHeaders, getLocalUser } from "@/lib/api";
import Link from "next/link";

function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return "Never";
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diffSec < 5) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function greeting() {
  const h = new Date().getHours();

  if (h >= 0 && h < 5) {
    return "Good late night"; // Jam 00.00 - 04.59 (Larut malam/Dini hari)
  }
  if (h < 12) {
    return "Good morning";    // Jam 05.00 - 11.59 (Pagi)
  }
  if (h < 17) {
    return "Good afternoon";  // Jam 12.00 - 16.59 (Siang menjelang sore)
  }
  if (h < 22) {
    return "Good evening";    // Jam 17.00 - 21.59 (Sore menjelang malam)
  }

  return "Good night";        // Jam 22.00 - 23.59 (Waktu tidur)
}

export default function DashboardPage() {
  const [gateways, setGateways] = useState<any[]>([]);
  const [alarms, setAlarms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loggedInUser = getLocalUser();
  const userRole = loggedInUser?.role ?? "client_user";
  const userCompanyId = String(loggedInUser?.company_id ?? "");
  const isCompanyScoped = !["admin", "rasindo_operator", "rasindo_user"].includes(userRole);

  const fetchData = useCallback(async () => {
    try {
      const headers = getAuthHeaders();

      const gwUrl =
        isCompanyScoped && userCompanyId
          ? `${API_BASE}/gateways/?company_id=${userCompanyId}`
          : `${API_BASE}/gateways/`;

      const [resGw, resAlarm] = await Promise.allSettled([
        fetch(gwUrl, { headers, cache: "no-store" }),
        fetch(`${API_BASE}/alarms/`, { headers, cache: "no-store" }),
      ]);

      if (resGw.status === "fulfilled" && resGw.value.ok)
        setGateways((await resGw.value.json()).data ?? []);

      if (resAlarm.status === "fulfilled" && resAlarm.value.ok)
        setAlarms((await resAlarm.value.json()).data ?? []);
    } catch (err) {
      console.error("fetchData error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [isCompanyScoped, userCompanyId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const totalGateways = gateways.length;
  const onlineGateways = gateways.filter((g) => g.status === "online").length;
  const offlineGateways = totalGateways - onlineGateways;
  const activeAlarms = alarms.filter((a) => a.status === "ACTIVE");

  const recentOffline = gateways
    .filter((g) => g.status === "offline")
    .sort(
      (a, b) =>
        new Date(b.last_ping ?? 0).getTime() - new Date(a.last_ping ?? 0).getTime()
    )
    .slice(0, 4);

  const isAllClear = offlineGateways === 0 && activeAlarms.length === 0;

  return (
    <div className="relative flex flex-col items-center h-full min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      {/* MAP Background */}
      <div className="absolute inset-0 w-full h-full z-0">
        <AssetMap isFullScreen={true} />
      </div>

      {/* TOP CENTER PANEL */}
      <div className="relative z-10 w-full max-w-[340px]">

        {!isLoading && (
          <div
            className={
              isAllClear
                ? "rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/80 dark:bg-emerald-950/30 backdrop-blur-md shadow-lg px-5 py-4 flex items-center gap-3"
                : "rounded-2xl border border-white/60 dark:border-gray-700/60 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-lg px-5 py-4 flex items-center gap-3"
            }
          >
            {isAllClear ? (
              <Wifi className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            )}

            <div className="min-w-0">
              {isAllClear ? (
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  {greeting()} · All systems online
                </p>
              ) : (
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {greeting()} · {offlineGateways > 0 ? `${offlineGateways} gateway offline` : ""}
                  {offlineGateways > 0 && activeAlarms.length > 0 ? ", " : ""}
                  {activeAlarms.length > 0 ? `${activeAlarms.length} alarm aktif` : ""}
                </p>
              )}
              <p
                className={
                  isAllClear
                    ? "text-[11px] text-emerald-600/70 dark:text-emerald-500 mt-0.5"
                    : "text-[11px] text-gray-400 mt-0.5"
                }
              >
                {totalGateways} gateways online
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}