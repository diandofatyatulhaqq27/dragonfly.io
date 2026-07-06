"use client";
import { useMemo, useState } from "react";
import {
  Wifi,
  WifiOff,
  BellRing,
  ChevronRight,
  ChevronDown,
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
  if (h >= 0 && h < 5) return "Good late night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Good night";
}

// ── Vertical divider between segments — encodes "these are separate readouts" ─
function Divider() {
  return <div className="w-px h-7 bg-slate-200 dark:bg-slate-700 shrink-0" />;
}

type ExpandedPanel = "offline" | "alarm" | null;

export default function DashboardPage() {
  const loggedInUser = getLocalUser();
  const userRole = loggedInUser?.role ?? "client_user";
  const userCompanyId = String(loggedInUser?.company_id ?? "");
  const isCompanyScoped = !["admin", "rasindo_operator", "rasindo_user"].includes(userRole);

  const gatewaysQuery = useGateways(isCompanyScoped ? userCompanyId : undefined, { refetchInterval: 10_000 });
  const gateways = gatewaysQuery.data ?? [];

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
    .slice(0, 6);

  const recentAlarms = activeAlarms.slice(0, 6);

  const isAllClear = offlineGateways === 0 && activeAlarms.length === 0;

  const [expanded, setExpanded] = useState<ExpandedPanel>(null);
  const toggle = (panel: ExpandedPanel) => setExpanded((cur) => (cur === panel ? null : panel));

  const statusColor = isAllClear ? "bg-emerald-500" : activeAlarms.length > 0 ? "bg-rose-500" : "bg-amber-500";

  return (
    <div className="relative flex flex-col items-center h-full w-full overflow-hidden bg-gray-50 dark:bg-gray-950 p-6">
      {/* MAP Background */}
      <div className="absolute inset-0 w-full h-full z-0">
        <AssetMap isFullScreen={true} />
      </div>

      {/* STATUS STRIP */}
      <div className="relative z-10 w-full max-w-[720px] flex flex-col">

        {!isLoading && (
          <div className="rounded-2xl border border-white/60 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-lg overflow-hidden">

            {/* Primary strip */}
            <div className="flex items-center gap-3 px-4 py-3">
              {/* Overall status dot */}
              <span className={`w-2 h-2 rounded-full shrink-0 ${statusColor} ${isAllClear ? "animate-pulse" : ""}`} />

              <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 shrink-0">
                {greeting()}
              </p>

              <div className="flex-1" />

              {/* Segmented readouts */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-[12px] font-mono font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                    {onlineGateways}/{totalGateways}
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    Online
                  </span>
                </div>

                {offlineGateways > 0 && (
                  <>
                    <Divider />
                    <button
                      onClick={() => toggle("offline")}
                      className="flex items-center gap-1.5 cursor-pointer border-none bg-transparent"
                    >
                      <WifiOff className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-[12px] font-mono font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                        {offlineGateways}
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                        Offline
                      </span>
                      <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${expanded === "offline" ? "rotate-180" : ""}`} />
                    </button>
                  </>
                )}

                {activeAlarms.length > 0 && (
                  <>
                    <Divider />
                    <button
                      onClick={() => toggle("alarm")}
                      className="flex items-center gap-1.5 cursor-pointer border-none bg-transparent"
                    >
                      <BellRing className="w-3.5 h-3.5 text-rose-500" />
                      <span className="text-[12px] font-mono font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                        {activeAlarms.length}
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-rose-400">
                        Alarm{activeAlarms.length !== 1 ? "s" : ""}
                      </span>
                      <ChevronDown className={`w-3 h-3 text-rose-400 transition-transform ${expanded === "alarm" ? "rotate-180" : ""}`} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Signature: telemetry pulse line — a live "heartbeat" under the
                strip, ticking continuously so it reads as "this data is
                alive", not decorative chrome. */}
            <div className="relative h-[2px] w-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`absolute inset-y-0 w-1/3 ${
                  isAllClear ? "bg-emerald-400" : activeAlarms.length > 0 ? "bg-rose-400" : "bg-amber-400"
                }`}
                style={{ animation: "pulse-sweep 3s ease-in-out infinite" }}
              />
            </div>

            {/* Expandable OFFLINE detail — chip row + explicit "view all" button */}
            {expanded === "offline" && offlineGateways > 0 && (
              <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {recentOffline.map((g: any) => (
                    <div
                      key={g.gateway_id}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 shrink-0"
                    >
                      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {g.name ?? `Gateway #${g.gateway_id}`}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                        {timeAgo(g.last_ping)}
                      </span>
                    </div>
                  ))}
                </div>
                <Link
                  href="/dashboard/gateways"
                  className="mt-2 flex items-center justify-center gap-1 w-full py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-700 transition-colors"
                >
                  Lihat Semua Gateway
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            )}

            {/* Expandable ALARM detail — message list + explicit "view all" button */}
            {expanded === "alarm" && activeAlarms.length > 0 && (
              <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-col gap-1">
                  {recentAlarms.map((a: any, i: number) => (
                    <div
                      key={a.id ?? i}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-rose-50/70 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40"
                    >
                      <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 truncate">
                        {a.message ?? "Alarm aktif"}
                      </span>
                      <span className="text-[10px] font-mono text-rose-400 shrink-0">
                        GW#{a.gateway_id}
                      </span>
                    </div>
                  ))}
                </div>
                <Link
                  href="/dashboard/alarms"
                  className="mt-2 flex items-center justify-center gap-1 w-full py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-rose-500 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/50 border border-rose-100 dark:border-rose-900/40 transition-colors"
                >
                  Lihat Semua Alarm
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        )}

      </div>

      <style jsx>{`
        @keyframes pulse-sweep {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(150%); }
          100% { transform: translateX(150%); }
        }
      `}</style>
    </div>
  );
}