"use client";
import React from "react";
import {
  AlertTriangle, Wifi, WifiOff, Loader2,
  Building2, Cpu, BellRing,
} from "lucide-react";
import { getLocalUser } from "@/lib/api";
import {
  AreaChart, Area,
  XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from "recharts";

import { useGateways } from "@/hooks/useGateways";
import { useProjects } from "@/hooks/useProjects";
import { useCompanies } from "@/hooks/useCompanies";
import { useAllAlarms } from "@/hooks/useAlarms";
import { useAlarmHistory } from "@/hooks/useAlarmHistory";

const POLL_INTERVAL = 5000;

function timeAgo(dateStr?: string | Date | number | null): string {
  if (!dateStr) return "Never";
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diffSec < 5) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

type Period = "hourly" | "daily" | "monthly";

function buildChartData(alarms: any[], period: Period) {
  if (period === "hourly") {
    const currentHour = new Date();
    currentHour.setMinutes(0, 0, 0);

    return Array.from({ length: 24 }, (_, i) => {
      const slotStart = currentHour.getTime() - (23 - i) * 3_600_000;
      const slotEnd = slotStart + 3_600_000;

      const count = alarms.filter((a) => {
        const t = new Date(a.triggered_at ?? 0).getTime();
        return t >= slotStart && t < slotEnd;
      }).length;

      const d = new Date(slotStart);
      return {
        label: `${d.getHours().toString().padStart(2, "0")}:00`,
        alarms: count,
      };
    });
  }

  if (period === "daily") {
    const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, i) => {
      const slotStart = startOfToday.getTime() - (6 - i) * 86_400_000;
      const slotEnd = slotStart + 86_400_000;

      const count = alarms.filter((a) => {
        const t = new Date(a.triggered_at ?? 0).getTime();
        return t >= slotStart && t < slotEnd;
      }).length;

      const d = new Date(slotStart);
      return { label: DAY_NAMES[d.getDay()], alarms: count };
    });
  }

  const MONTHS = [
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec"
  ];

  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (11 - i));

    const y = d.getFullYear();
    const m = d.getMonth();
    const slotStart = new Date(y, m, 1).getTime();
    const slotEnd = new Date(y, m + 1, 1).getTime();

    const count = alarms.filter((a) => {
      const t = new Date(a.triggered_at ?? 0).getTime();
      return t >= slotStart && t < slotEnd;
    }).length;

    return { label: MONTHS[m], alarms: count };
  });
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-gray-400 mb-0.5">{label}</p>
      <p className="text-blue-400 font-semibold">{payload[0].value} alarms</p>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  iconBg: string;
  valueColor?: string;
  loading?: boolean;
  pulse?: boolean;
}

function StatCard({ title, value, subtitle, icon, iconBg, valueColor, loading, pulse }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          {loading ? (
            <div className="mt-2 h-7 w-16 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
          ) : (
            <p className={`text-2xl font-bold mt-1 ${valueColor ?? "text-gray-900 dark:text-gray-100"} ${pulse ? "animate-pulse" : ""}`}>
              {value}
            </p>
          )}
          {subtitle && !loading && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function MonitoringPage() {
  const [chartPeriod, setChartPeriod] = React.useState<Period>("daily");

  const loggedInUser  = getLocalUser();
  const userRole      = loggedInUser?.role ?? "client_user";
  const userCompanyId = String(loggedInUser?.company_id ?? "");
  const isCompanyScoped = !["admin", "rasindo_operator", "rasindo_user"].includes(userRole);

  // NOTE: useProjects() scopes internally based on role === "admin" only,
  // which is narrower than isCompanyScoped here (which also treats
  // rasindo_operator/rasindo_user as unscoped). That mismatch already
  // existed in the hook as provided — for rasindo_operator/rasindo_user
  // this page will fetch unscoped gateways but company-scoped projects.
  // Flagging it here; align useProjects()'s scoping check if that's
  // not intended.
  const gatewaysQuery = useGateways(
    isCompanyScoped ? userCompanyId : undefined,
    { refetchInterval: POLL_INTERVAL }
  );
  const projectsQuery = useProjects({ refetchInterval: POLL_INTERVAL });
  const companiesQuery = useCompanies({ refetchInterval: POLL_INTERVAL });
  // NOTE: useAllAlarms/useAlarmHistory don't accept a company/scope filter,
  // so they always return data for every company. We scope them client-side
  // below against `gateways`, which is already correctly company-scoped.
  // If/when the backend supports a company filter for these two endpoints,
  // prefer passing it here instead so unscoped data never reaches the client.
  const alarmsQuery = useAllAlarms({ refetchInterval: POLL_INTERVAL });
  const alarmHistoryQuery = useAlarmHistory({ refetchInterval: POLL_INTERVAL });

  const gateways = gatewaysQuery.data ?? [];
  const projects = projectsQuery.data ?? [];
  const companies = companiesQuery.data ?? [];

  // Scope alarms & alarm history to gateways the current user can actually
  // see. `gateways` above is already filtered by company (via useGateways),
  // so we reuse that as the source of truth instead of trusting the raw
  // alarm endpoints, which return data across all companies.
  const gatewayIdSet = React.useMemo(
    () => new Set(gateways.map((g) => g.gateway_id)),
    [gateways]
  );

  const alarms = React.useMemo(
    () => (alarmsQuery.data ?? []).filter((a) => gatewayIdSet.has(a.gateway_id)),
    [alarmsQuery.data, gatewayIdSet]
  );

  const alarmHistory = React.useMemo(
    () => (alarmHistoryQuery.data ?? []).filter((a) => gatewayIdSet.has(a.gateway_id)),
    [alarmHistoryQuery.data, gatewayIdSet]
  );

  // Only show the full-page skeleton on the very first load of each
  // query, not on background refetches (mirrors old `loading` behavior,
  // which was only ever set to false once after first fetch).
  const loading =
    gatewaysQuery.isLoading ||
    projectsQuery.isLoading ||
    companiesQuery.isLoading ||
    alarmsQuery.isLoading ||
    alarmHistoryQuery.isLoading;

  const isFetching =
    gatewaysQuery.isFetching ||
    projectsQuery.isFetching ||
    companiesQuery.isFetching ||
    alarmsQuery.isFetching ||
    alarmHistoryQuery.isFetching;

  const error =
    gatewaysQuery.error?.message ??
    projectsQuery.error?.message ??
    companiesQuery.error?.message ??
    alarmsQuery.error?.message ??
    alarmHistoryQuery.error?.message ??
    null;

  const lastSync = Math.max(
    gatewaysQuery.dataUpdatedAt,
    projectsQuery.dataUpdatedAt,
    companiesQuery.dataUpdatedAt,
    alarmsQuery.dataUpdatedAt,
    alarmHistoryQuery.dataUpdatedAt
  );

  const totalGateways   = gateways.length;
  const onlineGateways  = gateways.filter((g) => g.status === "online").length;
  const offlineGateways = totalGateways - onlineGateways;
  const activeAlarms    = alarms.filter((a) => a.status === "ACTIVE");
  const uptimePct       = totalGateways > 0 ? Math.round((onlineGateways / totalGateways) * 100) : 0;

  const projectName = (id: any) =>
    projects.find((p) => p.project_id === id)?.display_name ?? `Project #${id ?? "—"}`;
  const companyName = (id: any) =>
    companies.find((c) => c.id === id)?.name ?? `Tenant #${id ?? "—"}`;

  // Memoized so the reference stays stable while the underlying data and
  // selected period haven't changed. Without this, every 5s poll produced a
  // brand-new array even when alarm counts were identical, which made the
  // recharts <Area> replay its enter animation on every tick.
  const chartData = React.useMemo(
    () => buildChartData(alarmHistory, chartPeriod),
    [alarmHistory, chartPeriod]
  );

  const periodLabel = {
    hourly: "Past 24 hours",
    daily: "Past 7 days",
    monthly: "Past 12 months",
  };

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50 dark:bg-gray-950">

      <div className="flex items-center justify-end gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${isFetching ? "bg-blue-400 animate-pulse" : "bg-emerald-500"}`} />
        <span className="text-[11px] text-gray-400 dark:text-gray-500">
          {lastSync ? `Updated ${timeAgo(lastSync)}` : "Connecting…"}
        </span>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Online Gateways"
          value={`${onlineGateways} / ${totalGateways}`}
          subtitle={`${uptimePct}% uptime`}
          icon={<Wifi className="w-5 h-5 text-emerald-600" />}
          iconBg="bg-emerald-50 dark:bg-emerald-950/40"
          valueColor="text-emerald-600 dark:text-emerald-400"
          loading={loading}
        />
        <StatCard
          title="Offline Gateways"
          value={offlineGateways}
          subtitle={offlineGateways > 0 ? "Requires attention" : "All systems up"}
          icon={<WifiOff className={`w-5 h-5 ${offlineGateways > 0 ? "text-rose-500" : "text-gray-400"}`} />}
          iconBg={offlineGateways > 0 ? "bg-rose-50 dark:bg-rose-950/40" : "bg-gray-50 dark:bg-gray-800"}
          valueColor={offlineGateways > 0 ? "text-rose-600 dark:text-rose-400" : undefined}
          loading={loading}
        />
        <StatCard
          title="Active Alarms"
          value={activeAlarms.length}
          subtitle={activeAlarms.length > 0 ? "Immediate action needed" : "All clear"}
          icon={<BellRing className={`w-5 h-5 ${activeAlarms.length > 0 ? "text-rose-500" : "text-gray-400"}`} />}
          iconBg={activeAlarms.length > 0 ? "bg-rose-50 dark:bg-rose-950/40" : "bg-gray-50 dark:bg-gray-800"}
          valueColor={activeAlarms.length > 0 ? "text-rose-600 dark:text-rose-400" : undefined}
          loading={loading}
          pulse={activeAlarms.length > 0}
        />
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Alarm Activity</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{periodLabel[chartPeriod]}</p>
          </div>
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg">
            {(["hourly", "daily", "monthly"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setChartPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all capitalize cursor-pointer ${
                  chartPeriod === p
                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                    : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                }`}
              >
                {p === "hourly" ? "Hourly" : p === "daily" ? "Daily" : "Monthly"}
              </button>
            ))}
          </div>
        </div>

        <div className="px-2 py-4" style={{ height: 220 }}>
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
            </div>
          ) : (
            <ResponsiveContainer
              width="100%"
              height="100%"
              initialDimension={{ width: 520, height: 220 }}
            >
              <AreaChart data={chartData} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#6366f1", strokeWidth: 1, strokeDasharray: "4 4" }} />
                <Area
                  type="monotone"
                  dataKey="alarms"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#areaGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#6366f1" }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Gateway Status</h2>
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 px-2.5 py-1 rounded-full">
              {totalGateways} total
            </span>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800 max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
            ) : gateways.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400">No gateways registered</div>
            ) : (
              gateways
                .slice()
                .sort((a, b) => (a.status === b.status ? 0 : a.status === "offline" ? -1 : 1))
                .map((gw) => (
                  <div key={gw.gateway_id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${gw.status === "online" ? "bg-emerald-500 shadow-[0_0_6px_#10b981]" : "bg-rose-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{gw.name}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-0.5 truncate">
                        <Building2 className="w-3 h-3 shrink-0" />
                        {projectName(gw.project_id)}
                      </p>
                    </div>
                    {gw.hmi_code && (
                      <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded-md shrink-0">
                        {gw.hmi_code}
                      </span>
                    )}
                    <div className="text-right shrink-0">
                      <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        gw.status === "online"
                          ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                          : "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400"
                      }`}>
                        {gw.status}
                      </span>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 font-mono">{timeAgo(gw.last_ping)}</p>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Site Summary</h2>
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 px-2.5 py-1 rounded-full">
              {projects.length} sites
            </span>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800 max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
            ) : projects.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400">No projects registered</div>
            ) : (
              projects.map((proj) => {
                const projGateways = gateways.filter((g) => g.project_id === proj.project_id);
                const projOnline   = projGateways.filter((g) => g.status === "online").length;
                const projAlarms   = activeAlarms.filter((a) =>
                  projGateways.some((g) => g.gateway_id === a.gateway_id)
                );
                const allOnline  = projOnline === projGateways.length && projGateways.length > 0;
                const allOffline = projOnline === 0 && projGateways.length > 0;

                return (
                  <div key={proj.project_id} className="px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{proj.display_name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{companyName(proj.company_id)}</p>
                      </div>
                      {projAlarms.length > 0 ? (
                        <span className="text-[11px] font-medium bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full shrink-0 animate-pulse">
                          {projAlarms.length} alarm
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 px-2 py-0.5 rounded-full shrink-0">
                          Normal
                        </span>
                      )}
                    </div>
                    <div className="mt-2.5 flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            allOnline ? "bg-emerald-500" : allOffline ? "bg-rose-400" : "bg-amber-400"
                          }`}
                          style={{ width: projGateways.length > 0 ? `${(projOnline / projGateways.length) * 100}%` : "0%" }}
                        />
                      </div>
                      <span className="text-[11px] text-gray-400 font-mono shrink-0">
                        {projOnline}/{projGateways.length}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}