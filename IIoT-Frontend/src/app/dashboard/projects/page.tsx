"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Eye, Edit2, X, Loader2, Trash2, RefreshCcw, Building2, MapPin, AlertTriangle, Plus, Search } from "lucide-react";
import { AssetMap } from "@/components/maps/AssetMap";
import { API_BASE, getAuthHeaders, getLocalUser, isReadOnlyRole } from "@/lib/api";

const DEFAULT_NEW_FORM = {
  display_name: "",
  description: "",
  company_id: "",
  latitude: "-6.1944",
  longitude: "106.8229",
};

export default function ProjectsPage() {
  const router = useRouter();

  const [projects, setProjects] = useState<any[]>([]);
  const [companiesList, setCompaniesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingProject, setEditingProject] = useState<any>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProjectForm, setNewProjectForm] = useState({ ...DEFAULT_NEW_FORM });

  const [searchQuery, setSearchQuery] = useState("");

  const isReadOnly = isReadOnlyRole(getLocalUser()?.role);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const currentUser = getLocalUser();
      const currentRole: string = currentUser?.role ?? "client_user";
      const currentCompanyId: string = String(currentUser?.company_id ?? "");

      let url = `${API_BASE}/projects/`;
      if (currentRole !== "admin" && currentCompanyId) {
        url += `?company_id=${currentCompanyId}`;
      }

      const res = await fetch(url, {
        method: "GET",
        cache: "no-store",
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.detail ?? "Gagal menarik data project dari server.");
      }

      const result = await res.json();
      const rawData = result.data ?? [];

      const sortedData = [...rawData].sort((a, b) =>
        (a.display_name ?? "").localeCompare(b.display_name ?? "")
      );

      setProjects(sortedData);
    } catch (err: any) {
      console.error("fetchProjects error:", err);
      setError(err.message ?? "Terjadi kesalahan.");
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCompaniesList = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/companies/`, { headers: getAuthHeaders() });
      if (!res.ok) return;

      const result = await res.json();
      const compData: any[] = result.data ?? [];
      setCompaniesList(compData);

      if (compData.length > 0) {
        setNewProjectForm((prev) => ({
          ...prev,
          company_id: String(compData[0].id),
        }));
      }
    } catch (err) {
      console.error("fetchCompaniesList error:", err);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
    fetchCompaniesList();
  }, [fetchProjects, fetchCompaniesList]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return alert("Akses ditolak!");

    if (!newProjectForm.company_id) {
      return alert("Pilih company terlebih dahulu.");
    }

    const parsedCompanyId = parseInt(newProjectForm.company_id, 10);
    if (isNaN(parsedCompanyId)) {
      return alert("Company ID tidak valid.");
    }

    const cleanLat = newProjectForm.latitude.replace(",", ".");
    const cleanLng = newProjectForm.longitude.replace(",", ".");
    const parsedLat = parseFloat(cleanLat);
    const parsedLng = parseFloat(cleanLng);

    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      return alert("Koordinat latitude / longitude tidak valid.");
    }

    const payload = {
      display_name: newProjectForm.display_name.trim(),
      description: newProjectForm.description.trim(),
      company_id: parsedCompanyId,
      latitude: parsedLat,
      longitude: parsedLng,
      config: [],
    };

    try {
      const res = await fetch(`${API_BASE}/projects/`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert("Project berhasil didaftarkan!");
        setIsCreateModalOpen(false);
        setNewProjectForm({ ...DEFAULT_NEW_FORM });
        fetchProjects();
      } else {
        const rawText = await res.text();
        let errData: any = {};
        try { errData = JSON.parse(rawText); } catch {}
        alert(errData?.detail ?? rawText ?? "Gagal menyimpan project.");
      }
    } catch (err) {
      alert("Gagal komunikasi ke server.");
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return alert("Akses ditolak!");
    if (!editingProject?.project_id) return alert("Project ID tidak ditemukan.");

    const parsedCompanyId = parseInt(String(editingProject.company_id), 10);
    if (isNaN(parsedCompanyId)) return alert("Company ID tidak valid.");

    const cleanLat = String(editingProject.latitude ?? "0").replace(",", ".");
    const cleanLng = String(editingProject.longitude ?? "0").replace(",", ".");
    const parsedLat = parseFloat(cleanLat);
    const parsedLng = parseFloat(cleanLng);

    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      return alert("Koordinat tidak valid.");
    }

    const payload = {
      display_name: editingProject.display_name.trim(),
      description: editingProject.description.trim(),
      company_id: parsedCompanyId,
      latitude: parsedLat,
      longitude: parsedLng,
      config: [],
    };

    try {
      const res = await fetch(`${API_BASE}/projects/${editingProject.project_id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert("Data berhasil diperbarui!");
        setEditingProject(null);
        fetchProjects();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData?.detail ?? "Gagal memperbarui data.");
      }
    } catch (err) {
      alert("Gagal komunikasi ke server.");
    }
  };

  const handleDelete = async (projectId: number, displayName: string) => {
    if (isReadOnly) return alert("Akses ditolak!");
    if (!confirm(`Hapus project "${displayName}"?`)) return;

    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (res.ok) {
        fetchProjects();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData?.detail ?? "Gagal menghapus project.");
      }
    } catch (err) {
      alert("Gagal menghapus. Periksa koneksi.");
    }
  };

  const filteredProjects = projects.filter((project) => {
    const name = (project.display_name ?? "").toLowerCase();
    const desc = (project.description ?? "").toLowerCase();
    const query = searchQuery.toLowerCase();
    return name.includes(query) || desc.includes(query);
  });

  return (
    <div className="p-6 bg-transparent min-h-screen font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden transition-all duration-300">

        {/* TOOLBAR INTERNAL */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3 bg-white dark:bg-slate-800">

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search project records..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-900/60 text-slate-800 dark:text-slate-200 rounded-xl text-[11px] font-bold outline-none focus:ring-2 ring-blue-100 dark:ring-blue-900/40 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 border-none"
            />
          </div>

          {!isReadOnly && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider shadow-md active:scale-95 transition-all border-none cursor-pointer whitespace-nowrap h-full"
            >
              <Plus className="w-3.5 h-3.5 text-white stroke-[3]" /> Add Project
            </button>
          )}

          <button
            onClick={fetchProjects}
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
                <th className="p-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Project Name</th>
                <th className="p-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Company / Tenant</th>
                <th className="p-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Description / GIS</th>
                <th className="p-4 text-center text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Control Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/40">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-20 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-7 h-7 animate-spin text-blue-600 dark:text-blue-400" />
                      <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1.5">
                        Syncing with industrial database nodes...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={5} className="p-16 text-center text-rose-500 dark:text-rose-400 font-bold uppercase tracking-wider text-[11px] italic">
                    <AlertTriangle className="w-4 h-4 mx-auto mb-2 text-rose-400" /> {error}
                  </td>
                </tr>
              ) : filteredProjects.length > 0 ? (
                filteredProjects.map((project: any, index: number) => (
                  <tr key={project.project_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors group text-[11px]">
                    <td className="p-4 font-mono text-slate-400 dark:text-slate-500 font-black">
                      {index + 1}
                    </td>
                    <td className="p-4 font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">
                      {project.display_name}
                    </td>
                    <td className="p-4">
                      <span className="text-[9px] font-black uppercase text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-1 rounded-lg border border-blue-100 dark:border-blue-900/50 flex items-center gap-1 w-fit">
                        <Building2 className="w-2.5 h-2.5" />
                        {companiesList.find((c) => c.id === project.company_id)?.name ?? `Tenant ID: ${project.company_id}`}
                      </span>
                    </td>
                    <td className="p-4 text-slate-500 font-medium space-y-1">
                      <p className="text-slate-800 dark:text-slate-300 font-bold">
                        {project.description || "— No description —"}
                      </p>
                      <p className="text-[9px] font-mono font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5 text-slate-300 dark:text-slate-600" />
                        Lat: {project.latitude ?? 0} | Lng: {project.longitude ?? 0}
                      </p>
                    </td>
                    <td className="p-4">
                      <div className="flex justify-center gap-1.5">
                        <button
                          onClick={() => router.push(`/dashboard/projects/${project.project_id}`)}
                          className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-md transition-all border-none bg-transparent cursor-pointer"
                          title="Open Live Station Blueprint View"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {!isReadOnly && (
                          <>
                            <button
                              onClick={() => setEditingProject({ ...project })}
                              className="p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-md transition-all border-none bg-transparent cursor-pointer"
                              title="Modify Properties"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(project.project_id, project.display_name)}
                              className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-md transition-all border-none bg-transparent cursor-pointer"
                              title="Purge From System"
                            >
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
                  <td colSpan={5} className="p-20 text-center text-slate-400 dark:text-slate-500 text-[9px] font-black uppercase italic tracking-[0.2em]">
                    Zero projects registered on this tenant network
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL: CREATE PROJECT ─────────────────────────────────────────── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 max-h-[90vh]">
            <div className="relative bg-slate-100 dark:bg-slate-950 h-[260px] md:h-auto min-h-[260px] md:min-h-full border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700">
              <AssetMap
                isFullScreen={false}
                showSearch={true}
                onSelectLocation={(lat, lng) =>
                  setNewProjectForm((prev) => ({
                    ...prev,
                    latitude: String(lat),
                    longitude: String(lng),
                  }))
                }
              />
            </div>
            <form onSubmit={handleCreateProject} className="p-6 space-y-3 overflow-y-auto max-h-[40vh] md:max-h-[80vh]">
              <div className="border-b border-slate-100 dark:border-slate-700 pb-2.5 flex justify-between items-center">
                <h2 className="font-black text-[11px] uppercase tracking-widest text-slate-800 dark:text-slate-100 italic flex items-center gap-2">
                  <Plus className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 stroke-[3]" /> Add New Project Site
                </h2>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-400 border-none bg-transparent cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 ml-1">Project Site Name</label>
                <input
                  type="text"
                  placeholder="CONTOH: CHILLER PLANT GRAND INDONESIA"
                  className="w-full p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-[11px] font-black border-none ring-1 ring-slate-100 dark:ring-slate-700/50 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                  value={newProjectForm.display_name}
                  onChange={(e) => setNewProjectForm({ ...newProjectForm, display_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 ml-1">Assign Company Tenant</label>
                <select
                  className="w-full p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-[11px] font-black border-none ring-1 ring-slate-100 dark:ring-slate-700/50 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-600 outline-none cursor-pointer"
                  value={newProjectForm.company_id}
                  onChange={(e) => setNewProjectForm({ ...newProjectForm, company_id: e.target.value })}
                  required
                >
                  {companiesList.length === 0 && (
                    <option value="" disabled>Loading companies...</option>
                  )}
                  {companiesList.map((company) => (
                    <option key={company.id} value={String(company.id)}>
                      {company.name.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 ml-1">GIS Latitude</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="-6.1944"
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-[11px] font-bold border-none ring-1 ring-slate-100 dark:ring-slate-700/50 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-600 outline-none"
                    value={newProjectForm.latitude}
                    onChange={(e) => setNewProjectForm({ ...newProjectForm, latitude: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 ml-1">GIS Longitude</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="106.8229"
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-[11px] font-bold border-none ring-1 ring-slate-100 dark:ring-slate-700/50 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-600 outline-none"
                    value={newProjectForm.longitude}
                    onChange={(e) => setNewProjectForm({ ...newProjectForm, longitude: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 ml-1">Installation Description</label>
                <textarea
                  className="w-full p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-[11px] font-bold border-none ring-1 ring-slate-100 dark:ring-slate-700/50 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-600 outline-none transition-all resize-none"
                  rows={3}
                  placeholder="Sektor basement panel 3 area kompresor chiller..."
                  value={newProjectForm.description}
                  onChange={(e) => setNewProjectForm({ ...newProjectForm, description: e.target.value })}
                />
              </div>
              <div className="pt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 rounded-xl text-[9px] font-black uppercase tracking-widest border-none cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white font-black py-3 rounded-xl text-[9px] uppercase shadow-lg border-none tracking-[0.2em] cursor-pointer hover:bg-blue-700 transition-all"
                >
                  Create Site
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: EDIT PROJECT ───────────────────────────────────────────── */}
      {editingProject && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 max-h-[90vh]">
            <div className="relative bg-slate-100 dark:bg-slate-950 h-[260px] md:h-auto min-h-[260px] md:min-h-full border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700">
              <AssetMap
                isFullScreen={false}
                showSearch={true}
                onSelectLocation={(lat, lng) =>
                  setEditingProject((prev: any) => ({ ...prev, latitude: lat, longitude: lng }))
                }
              />
            </div>
            <form onSubmit={handleUpdate} className="p-6 space-y-3 overflow-y-auto max-h-[40vh] md:max-h-[80vh]">
              <div className="border-b border-slate-50 dark:border-slate-700 pb-2.5 flex justify-between items-center">
                <h2 className="font-black text-[11px] uppercase tracking-widest text-slate-800 dark:text-slate-100 italic flex items-center gap-2">
                  <Edit2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Modify Site Properties
                </h2>
                <button
                  type="button"
                  onClick={() => setEditingProject(null)}
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-400 border-none bg-transparent cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 ml-1 tracking-widest">Asset Display Name</label>
                <input
                  type="text"
                  className="w-full p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-[11px] font-black border-none ring-1 ring-slate-100 dark:ring-slate-700/50 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                  value={editingProject.display_name ?? ""}
                  onChange={(e) => setEditingProject({ ...editingProject, display_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 ml-1 tracking-widest">Tenant Owner Bind</label>
                <select
                  value={String(editingProject.company_id ?? "")}
                  onChange={(e) => setEditingProject({ ...editingProject, company_id: e.target.value })}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-[11px] font-black border-none ring-1 ring-slate-100 dark:ring-slate-700/50 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-600 outline-none cursor-pointer"
                  required
                >
                  {companiesList.map((company) => (
                    <option key={company.id} value={String(company.id)}>
                      {company.name.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 ml-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-[11px] font-bold border-none ring-1 ring-slate-100 dark:ring-slate-700/50 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-600 outline-none"
                    value={editingProject.latitude ?? ""}
                    onChange={(e) => setEditingProject({ ...editingProject, latitude: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 ml-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-[11px] font-bold border-none ring-1 ring-slate-100 dark:ring-slate-700/50 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-600 outline-none"
                    value={editingProject.longitude ?? ""}
                    onChange={(e) => setEditingProject({ ...editingProject, longitude: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 ml-1 tracking-widest">Installation Description</label>
                <textarea
                  className="w-full p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-[11px] font-bold border-none ring-1 ring-slate-100 dark:ring-slate-700/50 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-600 outline-none transition-all resize-none"
                  rows={3}
                  value={editingProject.description ?? ""}
                  onChange={(e) => setEditingProject({ ...editingProject, description: e.target.value })}
                />
              </div>
              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingProject(null)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 rounded-xl text-[9px] font-black uppercase tracking-widest border-none cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white font-black py-3 rounded-xl text-[9px] uppercase shadow-lg border-none tracking-[0.2em] cursor-pointer hover:bg-blue-700 transition-all"
                >
                  Update Site
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}