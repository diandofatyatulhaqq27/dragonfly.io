"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Edit2, X, Loader2, Trash2, RefreshCcw, AlertTriangle, Plus, HardDrive, Search, Eye, FolderKanban, Check, ChevronDown } from "lucide-react";
import * as Select from "@radix-ui/react-select";
import { API_BASE, getAuthHeaders, getLocalUser, isReadOnlyRole } from "@/lib/api";

const DEFAULT_FORM = {
  hmi_code: "",
  name: "",
  project_id: "",
};

// ─── Reusable styled project dropdown (Radix Select, portal-based) ─────────
function ProjectSelect({
  value,
  onValueChange,
  projectsList,
  placeholder = "Pilih project...",
}: {
  value: string;
  onValueChange: (val: string) => void;
  projectsList: any[];
  placeholder?: string;
}) {
  return (
    <Select.Root value={value || undefined} onValueChange={onValueChange}>
      <Select.Trigger
        className="w-full p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-[11px] font-black border-none ring-1 ring-slate-100 dark:ring-slate-700/50 text-slate-800 dark:text-slate-200 flex items-center justify-between cursor-pointer outline-none focus:ring-2 focus:ring-blue-600 data-[placeholder]:text-slate-400"
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
          <Select.Viewport className="p-1">
            {projectsList.length === 0 && (
              <div className="px-3 py-2 text-[11px] font-bold text-slate-400">Loading projects...</div>
            )}
            {projectsList.map((p) => (
              <Select.Item
                key={p.project_id}
                value={String(p.project_id)}
                className="px-3 py-2.5 text-[11px] font-black rounded-lg cursor-pointer outline-none flex items-center justify-between gap-2 text-slate-700 dark:text-slate-200 data-[highlighted]:bg-blue-50 dark:data-[highlighted]:bg-blue-950/40 data-[highlighted]:text-blue-700 dark:data-[highlighted]:text-blue-400 data-[state=checked]:font-black"
              >
                <Select.ItemText>{p.display_name.toUpperCase()}</Select.ItemText>
                <Select.ItemIndicator>
                  <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

export default function GatewaysPage() {
  const router = useRouter();

  const [gateways, setGateways] = useState<any[]>([]);
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [editingGateway, setEditingGateway] = useState<any>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newGatewayForm, setNewGatewayForm] = useState({ ...DEFAULT_FORM });

  const isReadOnly = isReadOnlyRole(getLocalUser()?.role);

  // ─── 1. FETCH GATEWAYS ──────────────────────────────────────────────────
  const fetchGateways = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const currentUser = getLocalUser();
      const currentRole: string = currentUser?.role ?? "client_user";
      const currentCompanyId: string = String(currentUser?.company_id ?? "");

      let url = `${API_BASE}/gateways/`;
      if (
        currentRole !== "admin" &&
        currentRole !== "rasindo_operator" &&
        currentRole !== "rasindo_user" &&
        currentCompanyId
      ) {
        url += `?company_id=${currentCompanyId}`;
      }

      const res = await fetch(url, { method: "GET", cache: "no-store", headers: getAuthHeaders() });

      if (!res.ok) throw new Error(`Gagal menarik data hardware. Status: ${res.status}`);

      const result = await res.json();
      const sorted = [...(result.data ?? [])].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
      setGateways(sorted);
    } catch (err: any) {
      setError(err.message ?? "Terjadi kesalahan.");
      setGateways([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── 2. FETCH MASTER DATA ────────────────────────────────────────────────
  const fetchMasterData = useCallback(async () => {
    try {
      const resProj = await fetch(`${API_BASE}/projects/`, { headers: getAuthHeaders() });
      if (resProj.ok) {
        const r = await resProj.json();
        const projs = r.data ?? [];
        setProjectsList(projs);
        if (projs.length > 0) {
          setNewGatewayForm((prev) => ({ ...prev, project_id: String(projs[0].project_id) }));
        }
      }
    } catch (err) {
      console.error("fetchMasterData error:", err);
    }
  }, []);

  useEffect(() => {
    fetchGateways();
    fetchMasterData();
  }, [fetchGateways, fetchMasterData]);

  // ─── 3. CREATE ───────────────────────────────────────────────────────────
  const handleCreateGateway = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return alert("Akses ditolak!");
    if (!newGatewayForm.name.trim()) return alert("Nama gateway wajib diisi.");
    if (!newGatewayForm.project_id) return alert("Pilih project terlebih dahulu.");

    try {
      const res = await fetch(`${API_BASE}/gateways/`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          hmi_code: newGatewayForm.hmi_code.trim().toUpperCase() || null,
          name: newGatewayForm.name.trim(),
          project_id: parseInt(newGatewayForm.project_id, 10),
          status: "offline",
        }),
      });

      if (res.ok) {
        alert("IoT Gateway Terminal Berhasil Didaftarkan!");
        setIsCreateModalOpen(false);
        setNewGatewayForm({ ...DEFAULT_FORM, project_id: projectsList[0]?.project_id ? String(projectsList[0].project_id) : "" });
        fetchGateways();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData?.detail ?? "Gagal mendaftarkan gateway.");
      }
    } catch { alert("Gagal berkomunikasi dengan server."); }
  };

  // ─── 4. UPDATE ───────────────────────────────────────────────────────────
  const handleUpdateGateway = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return alert("Akses ditolak!");
    if (!editingGateway?.gateway_id) return;

    try {
      const res = await fetch(`${API_BASE}/gateways/${editingGateway.gateway_id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          hmi_code: editingGateway.hmi_code?.trim() || null,
          name: editingGateway.name.trim(),
          project_id: editingGateway.project_id ? parseInt(String(editingGateway.project_id), 10) : null,
          status: editingGateway.status,
        }),
      });

      if (res.ok) {
        alert("Konfigurasi hardware terminal berhasil diperbarui!");
        setEditingGateway(null);
        fetchGateways();
      } else {
        alert("Gagal memperbarui hardware.");
      }
    } catch { alert("Terjadi kesalahan koneksi saat memperbarui data."); }
  };

  // ─── 5. DELETE ───────────────────────────────────────────────────────────
  const handleDelete = async (gatewayId: number, displayName: string) => {
    if (isReadOnly) return alert("Akses ditolak!");
    if (!confirm(`Hapus Gateway "${displayName}"? Koneksi MQTT terminal ini akan terputus permanen.`)) return;

    try {
      const res = await fetch(`${API_BASE}/gateways/${gatewayId}`, { method: "DELETE", headers: getAuthHeaders() });
      if (res.ok) fetchGateways();
      else alert("Gagal menghapus gateway.");
    } catch { alert("Terjadi kesalahan koneksi."); }
  };

  // ─── FILTER ──────────────────────────────────────────────────────────────
  const filteredGateways = gateways.filter((gw) => {
    const q = searchQuery.toLowerCase();
    return (
      (gw.name ?? "").toLowerCase().includes(q) ||
      (gw.hmi_code ?? "").toLowerCase().includes(q)
    );
  });

  // ─── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div className="p-6 bg-transparent min-h-screen font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden transition-all duration-300">

        {/* ── TOOLBAR INTERNAL ── */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3 bg-white dark:bg-slate-800">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search gateway records..."
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
              <Plus className="w-3.5 h-3.5 stroke-[3]" /> Add Gateway
            </button>
          )}

          <button
            onClick={fetchGateways}
            className="p-2.5 bg-slate-50 dark:bg-slate-900/80 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border-none cursor-pointer"
          >
            <RefreshCcw className={`w-3.5 h-3.5 text-slate-500 dark:text-slate-400 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-700">
                <th className="p-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest w-16">No.</th>
                <th className="p-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">HMI Code</th>
                <th className="p-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Gateway Name</th>
                <th className="p-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Assigned Site Project</th>
                <th className="p-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Link Status</th>
                <th className="p-4 text-center text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Control Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/40">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-20 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-7 h-7 animate-spin text-blue-600 dark:text-blue-400" />
                      <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1.5">Syncing hardware connectivity maps...</p>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="p-16 text-center text-rose-500 dark:text-rose-400 font-bold uppercase tracking-wider text-[11px] italic">
                    <AlertTriangle className="w-4 h-4 mx-auto mb-2 text-rose-400" /> {error}
                  </td>
                </tr>
              ) : filteredGateways.length > 0 ? (
                filteredGateways.map((gateway: any, index: number) => (
                  <tr key={gateway.gateway_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors group text-[11px]">
                    <td className="p-4 font-mono text-slate-400 dark:text-slate-500 font-black">{index + 1}</td>
                    <td className="p-4 font-mono text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest">
                      {gateway.hmi_code || "—"}
                    </td>
                    <td className="p-4 font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">
                      {gateway.name}
                    </td>
                    <td className="p-4">
                      <span className="text-[9px] font-black uppercase text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2 py-1 rounded-lg border border-purple-100 dark:border-purple-900/50 flex items-center gap-1 w-fit">
                        <FolderKanban className="w-2.5 h-2.5" />
                        {projectsList.find((p) => p.project_id === gateway.project_id)?.display_name ?? `ID: ${gateway.project_id ?? "—"}`}
                      </span>
                    </td>
                    <td className="p-4 font-black uppercase tracking-widest text-[9px]">
                      <span className={`px-2 py-1 rounded-md border inline-flex items-center gap-1.5 whitespace-nowrap leading-none ${gateway.status === "online" ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/40" : "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/40"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${gateway.status === "online" ? "bg-emerald-500" : "bg-rose-500"}`} />
                        <span className="leading-none">{gateway.status}</span>
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex justify-center gap-1.5">
                        <button
                          onClick={() => router.push(`/dashboard/gateways/${gateway.gateway_id}`)}
                          className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-md transition-all border-none bg-transparent cursor-pointer"
                          title="Open Live Gateway Detail View"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {!isReadOnly && (
                          <>
                            <button onClick={() => setEditingGateway({ ...gateway })} className="p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-md transition-all border-none bg-transparent cursor-pointer" title="Modify Configuration">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDelete(gateway.gateway_id, gateway.name)} className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-md transition-all border-none bg-transparent cursor-pointer" title="Decommission Hardware">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-20 text-center text-slate-400 dark:text-slate-500 text-[9px] font-black uppercase italic tracking-[0.2em]">
                    Zero gateway controllers registered on this node link
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL: CREATE GATEWAY ─────────────────────────────────────────── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-700">
            <div className="p-4 border-b border-slate-50 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/40 rounded-t-2xl">
              <h2 className="font-black text-[11px] uppercase tracking-widest text-slate-800 dark:text-slate-100 italic flex items-center gap-2">
                <HardDrive className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Add new gateway
              </h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-400 border-none bg-transparent cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <form onSubmit={handleCreateGateway} className="p-6 space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 ml-1">HMI Code</label>
                <input type="text" placeholder="CONTOH: HMI-01" className="w-full p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-[11px] font-mono font-black tracking-widest text-blue-600 dark:text-blue-400 border-none ring-1 ring-slate-100 dark:ring-slate-700/50 focus:ring-2 focus:ring-blue-600 outline-none" value={newGatewayForm.hmi_code} onChange={(e) => setNewGatewayForm({ ...newGatewayForm, hmi_code: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 ml-1">Display Name</label>
                <input type="text" placeholder="CONTOH: MODBUS MASTER GATEWAY SEKTOR A" className="w-full p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-[11px] font-black border-none ring-1 ring-slate-100 dark:ring-slate-700/50 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-600 outline-none" value={newGatewayForm.name} onChange={(e) => setNewGatewayForm({ ...newGatewayForm, name: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 ml-1">Bind to Project Site</label>
                <ProjectSelect
                  value={newGatewayForm.project_id}
                  onValueChange={(val) => setNewGatewayForm({ ...newGatewayForm, project_id: val })}
                  projectsList={projectsList}
                  placeholder="Pilih project..."
                />
              </div>
              <div className="pt-2 flex gap-2">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 rounded-xl text-[9px] font-black uppercase tracking-widest border-none cursor-pointer">Batal</button>
                <button type="submit" className="flex-1 bg-blue-600 text-white font-black py-3 rounded-xl text-[9px] uppercase shadow-lg border-none tracking-[0.2em] cursor-pointer hover:bg-blue-700 transition-all">Register Link</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: EDIT GATEWAY ───────────────────────────────────────────── */}
      {editingGateway && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-700">
            <div className="p-4 border-b border-slate-50 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/40 rounded-t-2xl">
              <h2 className="font-black text-[11px] uppercase tracking-widest text-slate-800 dark:text-slate-100 italic flex items-center gap-2">
                <Edit2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Edit Hardware Meta
              </h2>
              <button onClick={() => setEditingGateway(null)} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-400 border-none bg-transparent cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <form onSubmit={handleUpdateGateway} className="p-6 space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 ml-1">HMI Code</label>
                <input type="text" className="w-full p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-[11px] font-mono font-black tracking-widest text-blue-600 dark:text-blue-400 border-none ring-1 ring-slate-100 dark:ring-slate-700/50 focus:ring-2 focus:ring-blue-600 outline-none" value={editingGateway.hmi_code ?? ""} onChange={(e) => setEditingGateway({ ...editingGateway, hmi_code: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 ml-1">Hardware Asset Name</label>
                <input type="text" className="w-full p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-[11px] font-black border-none ring-1 ring-slate-100 dark:ring-slate-700/50 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-600 outline-none transition-all" value={editingGateway.name ?? ""} onChange={(e) => setEditingGateway({ ...editingGateway, name: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 ml-1">Assigned Site Project</label>
                <ProjectSelect
                  value={String(editingGateway.project_id ?? "")}
                  onValueChange={(val) => setEditingGateway({ ...editingGateway, project_id: val })}
                  projectsList={projectsList}
                  placeholder="Pilih project..."
                />
              </div>
              <div className="pt-3 flex gap-2">
                <button type="button" onClick={() => setEditingGateway(null)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 rounded-xl text-[9px] font-black uppercase tracking-widest border-none cursor-pointer">Batal</button>
                <button type="submit" className="flex-1 bg-blue-600 text-white font-black py-3 rounded-xl text-[9px] uppercase shadow-lg border-none tracking-[0.2em] cursor-pointer hover:bg-blue-700 transition-all">Update Hardware</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}