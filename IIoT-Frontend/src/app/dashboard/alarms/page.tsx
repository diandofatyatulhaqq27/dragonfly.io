"use client";
import React, { useState, useMemo } from "react";
import { Edit2, X, Loader2, Trash2, RefreshCcw, AlertTriangle, Plus, Search, BellRing, ShieldAlert, Tag, CheckCircle2, Network, Check, ChevronDown, ChevronUp } from "lucide-react";
import * as Select from "@radix-ui/react-select";
import { getUserRole, getLocalUser, isReadOnlyRole } from "@/lib/api";
import { useGateways } from "@/hooks/useGateways";
import { useAlarms, useCreateAlarm, useUpdateAlarm, useDeleteAlarm } from "@/hooks/useAlarms";

const DEFAULT_FORM = {
  gateway_id: "",
  mqtt_key: "",
  name: "",
  message: "",
};

// Helper: classify alarm status into 3 states based on raw MQTT value
// AND the actual online/offline status of the bound gateway.
// - "1" / "ACTIVE"  -> alarm is actively triggered (danger)
// - gateway is not online (heartbeat lost) -> force "offline", regardless
//   of whatever stale status value is stored on the alarm record itself
// - "0" / "NORMAL"  -> gateway is sending data, value is normal (online)
// - anything else (null/undefined/no recent data) -> truly offline, no data received
// FIX: previously this only looked at `alarm.status`, which is just the
// LAST value ever received for that alarm. If the gateway went offline
// after sending a "NORMAL" reading, the alarm stayed stuck showing
// "online" forever because nothing here checked the gateway's real
// heartbeat-derived status. Now we cross-reference the gateway record.
function getAlarmState(alarm: any, gateway: any): "active" | "online" | "offline" {
  const status = alarm.status;
  if (status === "ACTIVE" || status === "1" || status === 1) return "active";

  // Kalau gateway-nya nggak ditemukan atau statusnya bukan "online"
  // (artinya heartbeat sudah berhenti), langsung anggap offline —
  // walaupun status terakhir yang tersimpan di alarm masih "normal".
  if (!gateway || gateway.status !== "online") return "offline";

  if (status === "0" || status === 0 || status === "NORMAL" || status === "RESOLVED") return "online";
  return "offline";
}

// ─── Reusable styled gateway dropdown (Radix Select, portal-based) ─────────
function GatewaySelect({
  value,
  onValueChange,
  gatewaysList,
  placeholder = "Pilih gateway...",
  focusRing = "focus:ring-blue-600",
}: {
  value: string;
  onValueChange: (val: string) => void;
  gatewaysList: any[];
  placeholder?: string;
  focusRing?: string;
}) {
  return (
    <Select.Root value={value || undefined} onValueChange={onValueChange}>
      <Select.Trigger
        className={`w-full p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-[11px] font-black border-none ring-1 ring-slate-100 dark:ring-slate-700/50 text-slate-800 dark:text-slate-100 flex items-center justify-between cursor-pointer outline-none focus:ring-2 ${focusRing} data-[placeholder]:text-slate-400`}
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          className="z-[80] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden w-[var(--radix-select-trigger-width)] max-h-60"
        >
          <Select.ScrollUpButton className="flex items-center justify-center py-1.5 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-default">
            <ChevronUp className="w-3.5 h-3.5" />
          </Select.ScrollUpButton>

          <Select.Viewport className="p-1">
            {gatewaysList.length === 0 && (
              <div className="px-3 py-2 text-[11px] font-bold text-slate-400">Loading gateways...</div>
            )}
            {gatewaysList.map((g) => (
              <Select.Item
                key={g.gateway_id}
                value={String(g.gateway_id)}
                className="px-3 py-2.5 text-[11px] font-black rounded-lg cursor-pointer outline-none flex items-center justify-between gap-2 text-slate-700 dark:text-slate-200 data-[highlighted]:bg-blue-50 dark:data-[highlighted]:bg-blue-950/40 data-[highlighted]:text-blue-700 dark:data-[highlighted]:text-blue-400 data-[state=checked]:font-black"
              >
                <Select.ItemText>{g.name.toUpperCase()} (#ID: {g.gateway_id})</Select.ItemText>
                <Select.ItemIndicator>
                  <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>

          <Select.ScrollDownButton className="flex items-center justify-center py-1.5 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-default">
            <ChevronDown className="w-3.5 h-3.5" />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

export default function AlarmsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingAlarm, setEditingAlarm] = useState<any>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newAlarmForm, setNewAlarmForm] = useState({ ...DEFAULT_FORM });

  const loggedInUser = getLocalUser();
  const userRole = getUserRole();
  const isReadOnly = isReadOnlyRole(userRole);
  const canViewMqttKey = userRole === "admin" || userRole === "rasindo_operator";

  // Roles that can see ALL companies' data. Everyone else is scoped to
  // their own company_id — same convention used on the monitoring page.
  const isCompanyScoped = !["admin", "rasindo_operator", "rasindo_user"].includes(userRole ?? "");
  const userCompanyId = String(loggedInUser?.company_id ?? "");

  // ── React Query hooks replace the old useState/useEffect/fetch trio ──
  // Gateway list is scoped server-side (query param) when the user is
  // company-scoped; admins/operators get the unscoped ("all") query.
  const gatewaysQuery = useGateways(isCompanyScoped ? userCompanyId : undefined);
  const gatewaysList = gatewaysQuery.data ?? [];

  const alarmsQuery = useAlarms();
  const rawAlarms = alarmsQuery.data ?? [];

  const createAlarm = useCreateAlarm();
  const updateAlarm = useUpdateAlarm();
  const deleteAlarm = useDeleteAlarm();

  // Company-scoping for alarms: only keep alarms whose gateway_id belongs
  // to the (already company-scoped) gatewaysList. Recomputed only when
  // the underlying data actually changes, not on every render.
  const alarms = useMemo(() => {
    if (!isCompanyScoped) return rawAlarms;
    const scopedGatewayIds = new Set<number>(gatewaysList.map((g: any) => g.gateway_id));
    return rawAlarms.filter((a: any) => scopedGatewayIds.has(a.gateway_id));
  }, [rawAlarms, gatewaysList, isCompanyScoped]);

  // FIX: quick-lookup map so we don't do a linear .find() per row on
  // every render. Keyed by gateway_id -> gateway object.
  const gatewaysById = useMemo(() => {
    const map = new Map<number, any>();
    gatewaysList.forEach((g: any) => map.set(g.gateway_id, g));
    return map;
  }, [gatewaysList]);

  const loading = gatewaysQuery.isLoading || alarmsQuery.isLoading;
  const error = gatewaysQuery.error?.message || alarmsQuery.error?.message || null;
  const isRefetching = gatewaysQuery.isFetching || alarmsQuery.isFetching;

  const refreshAll = () => {
    gatewaysQuery.refetch();
    alarmsQuery.refetch();
  };

  // Default the "Bind to Gateway" field to the first available gateway
  // once the list loads, without fighting the user's own selection.
  React.useEffect(() => {
    if (gatewaysList.length > 0 && !newAlarmForm.gateway_id) {
      setNewAlarmForm((prev) => ({ ...prev, gateway_id: String(gatewaysList[0].gateway_id) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gatewaysList]);

  const handleCreateAlarm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return alert("Akses ditolak!");

    try {
      await createAlarm.mutateAsync({
        gateway_id: parseInt(newAlarmForm.gateway_id, 10),
        mqtt_key: newAlarmForm.mqtt_key.trim(),
        name: newAlarmForm.name.trim(),
        message: newAlarmForm.message.trim(),
      });
      alert("Master konfigurasi alarm berhasil didaftarkan!");
      setIsCreateModalOpen(false);
      setNewAlarmForm({ ...DEFAULT_FORM, gateway_id: gatewaysList[0]?.gateway_id ? String(gatewaysList[0].gateway_id) : "" });
    } catch (err: any) {
      alert(err.message ?? "Gagal mendaftarkan alarm baru.");
    }
  };

  const handleUpdateAlarm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return alert("Akses ditolak!");

    try {
      await updateAlarm.mutateAsync({
        id: editingAlarm.id,
        payload: {
          gateway_id: parseInt(String(editingAlarm.gateway_id), 10),
          mqtt_key: editingAlarm.mqtt_key.trim(),
          name: editingAlarm.name?.trim() ?? "",
          message: editingAlarm.message.trim(),
          severity: editingAlarm.severity || "CRITICAL",
          status: editingAlarm.status || "ACTIVE",
        },
      });
      alert("Konfigurasi Alarm Berhasil Diperbarui!");
      setEditingAlarm(null);
    } catch {
      alert("Gagal memperbarui konfigurasi sistem alarm.");
    }
  };

  const handleVerifyAlarm = async (alarm: any) => {
    if (isReadOnly) return alert("Akses ditolak!");

    try {
      await updateAlarm.mutateAsync({
        id: alarm.id,
        payload: {
          gateway_id: alarm.gateway_id,
          mqtt_key: alarm.mqtt_key,
          name: alarm.name ?? "",
          message: alarm.message,
          severity: "NORMAL",
          status: "RESOLVED",
        },
      });
    } catch {
      alert("Gagal memverifikasi alarm.");
    }
  };

  const handleDelete = async (alarmId: string, name: string) => {
    if (isReadOnly) return alert("Akses ditolak!");
    if (!confirm(`Hapus master konfigurasi alarm: "${name}"?`)) return;

    try {
      await deleteAlarm.mutateAsync(alarmId);
      alert("Master konfigurasi alarm berhasil dihapus dari sistem!");
    } catch {
      alert("Gagal menghapus master alarm dari database.");
    }
  };

  const getGatewayName = (gatewayId: number) => {
    const gw = gatewaysById.get(gatewayId);
    return gw ? gw.name.toUpperCase() : `GATEWAY ID: ${gatewayId}`;
  };

  const filteredAlarms = alarms.filter((alarm: any) => {
    const q = searchQuery.toLowerCase();
    return (
      (alarm.name ?? "").toLowerCase().includes(q) ||
      (alarm.message ?? "").toLowerCase().includes(q) ||
      (alarm.severity ?? "").toLowerCase().includes(q) ||
      (alarm.status ?? "").toLowerCase().includes(q) ||
      (alarm.mqtt_key ?? "").toLowerCase().includes(q) ||
      getGatewayName(alarm.gateway_id).toLowerCase().includes(q)
    );
  });

  const columnCount = canViewMqttKey ? 8 : 7;

  return (
    <div className="p-6 bg-transparent min-h-screen font-sans text-slate-900 dark:text-slate-100">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden transition-all duration-300">

        {/* TOOLBAR */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3 bg-white dark:bg-slate-800">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search alarm name, gateway, severity, mqtt key..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-900/60 text-slate-800 dark:text-slate-200 rounded-xl text-[11px] font-bold outline-none focus:ring-2 ring-blue-100 dark:ring-blue-900/40 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 border-none"
            />
          </div>

          {!isReadOnly && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider shadow-md active:scale-95 transition-all border-none cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" /> Add Alarm
            </button>
          )}

          <button onClick={refreshAll} className="p-2.5 bg-slate-50 dark:bg-slate-900/80 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border-none cursor-pointer">
            <RefreshCcw className={`w-3.5 h-3.5 text-slate-500 dark:text-slate-400 ${isRefetching ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-700">
                <th className="p-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest w-14">No.</th>
                <th className="p-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Alarm Name</th>
                <th className="p-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Bound Gateway</th>
                {canViewMqttKey && (
                  <th className="p-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">MQTT Key Bind</th>
                )}
                <th className="p-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Description / Event</th>
                <th className="p-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Incident Time</th>
                <th className="p-4 text-center text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest w-28">Status</th>
                <th className="p-4 text-center text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Control Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/40">
              {loading ? (
                <tr><td colSpan={columnCount} className="p-20 text-center"><Loader2 className="w-7 h-7 animate-spin text-blue-600 dark:text-blue-400 mx-auto" /></td></tr>
              ) : error ? (
                <tr><td colSpan={columnCount} className="p-16 text-center text-rose-500 dark:text-rose-400 font-bold text-[11px]"><AlertTriangle className="w-4 h-4 mx-auto mb-2" /> {error}</td></tr>
              ) : filteredAlarms.length > 0 ? (
                filteredAlarms.map((alarm: any, index: number) => {
                  // FIX: look up the actual gateway record so getAlarmState
                  // can check its real (heartbeat-derived) online/offline
                  // status instead of trusting only the alarm's own last
                  // stored value.
                  const gateway = gatewaysById.get(alarm.gateway_id);
                  const alarmState = getAlarmState(alarm, gateway);
                  const isActive = alarmState === "active";

                  return (
                    <tr key={alarm.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors text-[11px]">
                      <td className="p-4 font-mono text-slate-400 dark:text-slate-500 font-black">{index + 1}</td>
                      <td className="p-4 font-black text-slate-800 dark:text-slate-200 uppercase">
                        {alarm.name || <span className="text-slate-300 dark:text-slate-600 italic font-normal normal-case">— Belum diberi nama —</span>}
                      </td>
                      <td className="p-4">
                        <span className="text-[9px] font-black uppercase text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 px-2 py-1 rounded-lg border border-teal-100 dark:border-teal-900/50 flex items-center gap-1 w-fit">
                          <Network className="w-2.5 h-2.5" /> {getGatewayName(alarm.gateway_id)}
                        </span>
                      </td>
                      {canViewMqttKey && (
                        <td className="p-4">
                          <span className="font-mono text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 px-2 py-1 rounded-md font-bold flex items-center gap-1 w-fit">
                            <Tag className="w-2.5 h-2.5" /> {alarm.mqtt_key || "UNMAPPED"}
                          </span>
                        </td>
                      )}
                      <td className="p-4 font-bold text-slate-600 dark:text-slate-300">{alarm.message}</td>

                      <td className="p-4 font-mono font-bold text-slate-400 dark:text-slate-500">
                        {isActive && alarm.created_at
                          ? new Date(alarm.created_at).toLocaleString("id-ID")
                          : "—"
                        }
                      </td>

                      <td className="p-4 text-center font-black uppercase tracking-widest text-[9px]">
                        {alarmState === "active" ? (
                          <span className="px-2 py-1 rounded-md border inline-flex items-center gap-1.5 whitespace-nowrap leading-none bg-rose-500 text-white border-rose-600 animate-pulse shadow-[0_0_8px_#ef4444]">
                            <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                            <span className="leading-none">active</span>
                          </span>
                        ) : alarmState === "online" ? (
                          <span className="px-2 py-1 rounded-md border inline-flex items-center gap-1.5 whitespace-nowrap leading-none bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/40">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            <span className="leading-none">online</span>
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-md border inline-flex items-center gap-1.5 whitespace-nowrap leading-none bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                            <span className="leading-none">offline</span>
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex justify-center gap-1.5 items-center">
                          {isActive && !isReadOnly && (
                            <button
                              onClick={() => handleVerifyAlarm(alarm)}
                              title="Verify/Acknowledge Alarm"
                              className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-md border-none bg-transparent cursor-pointer transition-all"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                          )}

                          {!isReadOnly && (
                            <>
                              <button onClick={() => setEditingAlarm({ ...alarm })} className="p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-md border-none bg-transparent cursor-pointer"><Edit2 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDelete(alarm.id, alarm.name || alarm.message)} className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-md border-none bg-transparent cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan={columnCount} className="p-20 text-center text-slate-400 dark:text-slate-500 text-[9px] font-black uppercase italic tracking-[0.2em]">No dangerous leakages or critical alarms triggered.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL: CREATE ALARM ── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-700">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/40 rounded-t-2xl">
              <h2 className="font-black text-[11px] uppercase tracking-widest text-slate-800 dark:text-slate-100 italic flex items-center gap-2">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" /> Add new alarm
              </h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 border-none bg-transparent cursor-pointer"><X className="w-3.5 h-3.5" /></button>
            </div>
            <form onSubmit={handleCreateAlarm} className="p-6 space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Alarm Name (Judul Singkat)</label>
                <input type="text" placeholder="e.g., Gas Leak Zone A" className="w-full p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-[11px] font-black border-none ring-1 ring-slate-100 dark:ring-slate-700/50 outline-none text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-600" value={newAlarmForm.name} onChange={(e) => setNewAlarmForm({ ...newAlarmForm, name: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-1 flex items-center gap-1">
                  <Network className="w-2.5 h-2.5 text-teal-500" /> Bind to Gateway
                </label>
                <GatewaySelect
                  value={newAlarmForm.gateway_id}
                  onValueChange={(val) => setNewAlarmForm({ ...newAlarmForm, gateway_id: val })}
                  gatewaysList={gatewaysList}
                  placeholder="Pilih gateway..."
                  focusRing="focus:ring-blue-600"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">MQTT Telemetry Key Bind</label>
                <input type="text" placeholder="e.g., kd12b_gas_ppm, ahu_temp_level" className="w-full p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-[11px] font-mono font-bold border-none ring-1 ring-slate-100 dark:ring-slate-700/50 outline-none text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-600" value={newAlarmForm.mqtt_key} onChange={(e) => setNewAlarmForm({ ...newAlarmForm, mqtt_key: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Description / Event Detail</label>
                <input type="text" placeholder="CONTOH: KEBOCORAN GAS LIQUID AMMONIA DI AREA AHU PANEL" className="w-full p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-[11px] font-black border-none ring-1 ring-slate-100 dark:ring-slate-700/50 outline-none text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-600" value={newAlarmForm.message} onChange={(e) => setNewAlarmForm({ ...newAlarmForm, message: e.target.value })} required />
              </div>
              <div className="pt-3 flex gap-2">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-900 text-slate-500 rounded-xl text-[9px] font-black uppercase tracking-widest border-none cursor-pointer">Batal</button>
                <button type="submit" disabled={createAlarm.isPending} className="flex-1 bg-blue-600 text-white font-black py-3 rounded-xl text-[9px] uppercase shadow-lg border-none tracking-[0.2em] cursor-pointer hover:bg-blue-700 disabled:opacity-60">
                  {createAlarm.isPending ? "Menyimpan..." : "Register Alarm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: EDIT ALARM ── */}
      {editingAlarm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-700">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/40 rounded-t-2xl">
              <h2 className="font-black text-[11px] uppercase tracking-widest text-slate-800 dark:text-slate-100 italic flex items-center gap-2">
                <BellRing className="w-3.5 h-3.5 text-amber-600" /> Modify Alarm Configuration
              </h2>
              <button onClick={() => setEditingAlarm(null)} className="text-slate-400 border-none bg-transparent cursor-pointer"><X className="w-3.5 h-3.5" /></button>
            </div>
            <form onSubmit={handleUpdateAlarm} className="p-6 space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Alarm Name (Judul Singkat)</label>
                <input type="text" className="w-full p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-[11px] font-black border-none ring-1 ring-slate-100 dark:ring-slate-700/50 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500" value={editingAlarm.name ?? ""} onChange={(e) => setEditingAlarm({ ...editingAlarm, name: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-1 flex items-center gap-1">
                  <Network className="w-2.5 h-2.5 text-teal-500" /> Bind to Gateway
                </label>
                <GatewaySelect
                  value={String(editingAlarm.gateway_id ?? "")}
                  onValueChange={(val) => setEditingAlarm({ ...editingAlarm, gateway_id: parseInt(val, 10) })}
                  gatewaysList={gatewaysList}
                  placeholder="Pilih gateway..."
                  focusRing="focus:ring-amber-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">MQTT Telemetry Key Bind</label>
                <input type="text" className="w-full p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-[11px] font-mono font-bold border-none ring-1 ring-slate-100 dark:ring-slate-700/50 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500" value={editingAlarm.mqtt_key ?? ""} onChange={(e) => setEditingAlarm({ ...editingAlarm, mqtt_key: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Description / Event Detail</label>
                <input type="text" className="w-full p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-[11px] font-black border-none ring-1 ring-slate-100 dark:ring-slate-700/50 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500" value={editingAlarm.message ?? ""} onChange={(e) => setEditingAlarm({ ...editingAlarm, message: e.target.value })} required />
              </div>
              <div className="pt-3 flex gap-2">
                <button type="button" onClick={() => setEditingAlarm(null)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-900 text-slate-500 rounded-xl text-[9px] font-black uppercase tracking-widest border-none cursor-pointer">Batal</button>
                <button type="submit" disabled={updateAlarm.isPending} className="flex-1 bg-blue-600 text-white font-black py-3 rounded-xl text-[9px] uppercase shadow-lg border-none tracking-[0.2em] cursor-pointer hover:bg-blue-700 disabled:opacity-60">
                  {updateAlarm.isPending ? "Menyimpan..." : "Update Alarm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}