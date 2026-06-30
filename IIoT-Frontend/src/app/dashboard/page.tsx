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

  return (
    <div className="relative flex flex-col items-center h-full min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      {/* MAP Background */}
      <div className="absolute inset-0 w-full h-full z-0">
        <AssetMap isFullScreen={true} />
      </div>

      {/* TOP CENTER PANEL */}
      <div className="relative z-10 w-full max-w-[340px] flex flex-col gap-3">

        {/* Header text (see-through, no box) */}
        <div className="px-1">
          <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {greeting()} 👋
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Here's your network status right now.
          </p>
        </div>

        {/* ── Offline gateway list ── */}
        {!isLoading && recentOffline.length > 0 && (
          <div className="rounded-2xl border border-white/60 dark:border-gray-700/60 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
              <WifiOff className="w-3.5 h-3.5 text-rose-500" />
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Offline Gateways
              </span>
              <span className="ml-auto text-[11px] bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full font-medium">
                {offlineGateways}
              </span>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-800/80">
              {recentOffline.map((gw) => (
                <div key={gw.id} className="px-4 py-2.5 flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                      {gw.name ?? gw.id}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      Last seen {timeAgo(gw.last_ping)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 py-2.5 border-t border-gray-50 dark:border-gray-800">
              <Link
                href="/dashboard/gateways"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                View all gateways <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}

        {/* ── Active alarms list ── */}
        {!isLoading && activeAlarms.length > 0 && (
          <div className="rounded-2xl border border-white/60 dark:border-gray-700/60 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
              <BellRing className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Active Alarms
              </span>
              <span className="ml-auto text-[11px] bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">
                {activeAlarms.length}
              </span>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-800/80 max-h-44 overflow-y-auto">
              {activeAlarms.slice(0, 5).map((alarm) => (
                <div key={alarm.id} className="px-4 py-2.5 flex items-start gap-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                      {alarm.name || alarm.mqtt_key || "Unnamed Alarm"}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate">{alarm.message}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 py-2.5 border-t border-gray-50 dark:border-gray-800">
              <Link
                href="/dashboard/alarms"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                View all alarms <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}

        {/* ── All clear state ── */}
        {!isLoading && offlineGateways === 0 && activeAlarms.length === 0 && totalGateways > 0 && (
          <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/80 dark:bg-emerald-950/30 backdrop-blur-md px-5 py-4 flex items-center gap-3">
            <Wifi className="w-4 h-4 text-emerald-500 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                All systems normal
              </p>
              <p className="text-[11px] text-emerald-600/70 dark:text-emerald-500 mt-0.5">
                {totalGateways} gateways online · No active alarms
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}