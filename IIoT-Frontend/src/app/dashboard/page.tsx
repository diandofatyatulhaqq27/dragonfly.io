"use client";
import { useMemo } from "react";
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
import { getLocalUser } from "@/lib/api";
import { useGateways } from "@/hooks/useGateways";
import { useAllAlarms } from "@/hooks/useAlarms";
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
  const loggedInUser = getLocalUser();
  const userRole = loggedInUser?.role ?? "client_user";
  const userCompanyId = String(loggedInUser?.company_id ?? "");
  const isCompanyScoped = !["admin", "rasindo_operator", "rasindo_user"].includes(userRole);

  // ── React Query hooks replace the old useState/useEffect + setInterval ──
  // Gateways are scoped server-side (query param) when the user is
  // company-scoped, same convention as the alarms/monitoring pages.
  const gatewaysQuery = useGateways(isCompanyScoped ? userCompanyId : undefined, { refetchInterval: 10_000 });
  const gateways = gatewaysQuery.data ?? [];

  // /alarms/ returns alarms across all companies, so — same as the alarms
  // page — we scope it client-side against the (already scoped) gateway
  // list for non-admin/operator roles.
  const allAlarmsQuery = useAllAlarms({ refetchInterval: 10_000 });
  const rawAlarms = allAlarmsQuery.data ?? [];

  const alarms = useMemo(() => {
    if (!isCompanyScoped) return rawAlarms;
    const scopedGatewayIds = new Set<number>(gateways.map((g: any) => g.gateway_id));
    return rawAlarms.filter((a: any) => scopedGatewayIds.has(a.gateway_id));
  }, [rawAlarms, gateways, isCompanyScoped]);

  const isLoading = gatewaysQuery.isLoading || allAlarmsQuery.isLoading;

  const totalGateways = gateways.length;
  const onlineGateways = gateways.filter((g: any) => g.status === "online").length;
  const offlineGateways = totalGateways - onlineGateways;
  const activeAlarms = alarms.filter((a: any) => a.status === "ACTIVE");

  const recentOffline = gateways
    .filter((g: any) => g.status === "offline")
    .sort(
      (a: any, b: any) =>
        new Date(b.last_ping ?? 0).getTime() - new Date(a.last_ping ?? 0).getTime()
    )
    .slice(0, 4);

  const isAllClear = offlineGateways === 0 && activeAlarms.length === 0;

  return (
    <div className="relative flex flex-col items-center h-full w-full overflow-hidden bg-gray-50 dark:bg-gray-950 p-6">
      {/* MAP Background */}
      <div className="absolute inset-0 w-full h-full z-0">
        <AssetMap isFullScreen={true} />
      </div>

      {/* TOP CENTER PANEL */}
      <div className="relative z-10 w-full max-w-[340px] flex flex-col gap-3">

        {!isLoading && isAllClear && (
          <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/80 dark:bg-emerald-950/30 backdrop-blur-md shadow-lg px-5 py-4 flex items-center gap-3">
            <Wifi className="w-4 h-4 text-emerald-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                {greeting()} · All systems online
              </p>
              <p className="text-[11px] text-emerald-600/70 dark:text-emerald-500 mt-0.5">
                {onlineGateways} of {totalGateways} gateway{totalGateways !== 1 ? "s" : ""} online
              </p>
            </div>
          </div>
        )}

        {!isLoading && !isAllClear && (
          <>
            {/* Box khusus gateway offline */}
            {offlineGateways > 0 && (
              <div className="rounded-2xl border border-white/60 dark:border-gray-700/60 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-lg px-5 py-4">
                <div className="flex items-center gap-3">
                  <WifiOff className="w-4 h-4 text-amber-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {greeting()} · {offlineGateways} gateway{offlineGateways !== 1 ? "s" : ""} offline
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {onlineGateways} of {totalGateways} gateway{totalGateways !== 1 ? "s" : ""} online
                    </p>
                  </div>
                </div>

                {recentOffline.length > 0 && (
                  <div className="mt-3 flex flex-col gap-1.5 border-t border-gray-100 dark:border-gray-800 pt-3">
                    {recentOffline.map((g: any) => (
                      <div key={g.gateway_id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700 dark:text-gray-300 truncate">
                          {g.name ?? `Gateway #${g.gateway_id}`}
                        </span>
                        <span className="text-gray-400 shrink-0 ml-2">
                          {timeAgo(g.last_ping)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Box khusus alarm aktif */}
            {activeAlarms.length > 0 && (
              <Link
                href="/alarms"
                className="rounded-2xl border border-rose-100 dark:border-rose-900/40 bg-rose-50/90 dark:bg-rose-950/30 backdrop-blur-md shadow-lg px-5 py-4 flex items-center gap-3 hover:bg-rose-100/90 dark:hover:bg-rose-950/50 transition-colors"
              >
                <BellRing className="w-4 h-4 text-rose-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">
                    {activeAlarms.length} alarm{activeAlarms.length !== 1 ? "s" : ""} aktif
                  </p>
                  <p className="text-[11px] text-rose-500/70 dark:text-rose-500 mt-0.5 truncate">
                    {activeAlarms[0]?.message ?? "Lihat detail alarm"}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-rose-400 shrink-0" />
              </Link>
            )}
          </>
        )}

      </div>
    </div>
  );
}