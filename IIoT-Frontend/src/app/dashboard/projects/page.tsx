"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Edit2, X, Loader2, Trash2, RefreshCcw, Building2, MapPin, AlertTriangle, Plus, Search, Check, ChevronDown, ChevronUp } from "lucide-react";
import * as Select from "@radix-ui/react-select";
import { AssetMap } from "@/components/maps/AssetMap";
import { getLocalUser, canManageAssets } from "@/lib/api";

import { useProjects, useCreateProject, useUpdateProject, useDeleteProject } from "@/hooks/useProjects";
import { useCompanies } from "@/hooks/useCompanies";

const DEFAULT_NEW_FORM = {
  display_name: "",
  description: "",
  company_id: "",
  latitude: "-6.1944",
  longitude: "106.8229",
};

// ─── Reusable styled company dropdown (Radix Select, portal-based) ─────────
function CompanySelect({
  value,
  onValueChange,
  companiesList,
  placeholder = "Pilih company...",
}: {
  value: string;
  onValueChange: (val: string) => void;
  companiesList: any[];
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
          <Select.ScrollUpButton className="flex items-center justify-center py-1.5 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-default">
            <ChevronUp className="w-3.5 h-3.5" />
          </Select.ScrollUpButton>

          <Select.Viewport className="p-1">
            {companiesList.length === 0 && (
              <div className="px-3 py-2 text-[11px] font-bold text-slate-400">Loading companies...</div>
            )}
            {companiesList.map((company) => (
              <Select.Item
                key={company.id}
                value={String(company.id)}
                className="px-3 py-2.5 text-[11px] font-black rounded-lg cursor-pointer outline-none flex items-center justify-between gap-2 text-slate-700 dark:text-slate-200 data-[highlighted]:bg-blue-50 dark:data-[highlighted]:bg-blue-950/40 data-[highlighted]:text-blue-700 dark:data-[highlighted]:text-blue-400 data-[state=checked]:font-black"
              >
                <Select.ItemText>{company.name.toUpperCase()}</Select.ItemText>
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

export default function ProjectsPage() {
  const router = useRouter();

  const projectsQuery = useProjects();
  const companiesQuery = useCompanies();

  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const companiesList = companiesQuery.data ?? [];

  // Same sort AssetMap/ProjectsPage previously did after fetch — keep it
  // client-side via useMemo so it re-derives whenever the query data changes.
  const projects = useMemo(() => {
    const raw = projectsQuery.data ?? [];
    return [...raw].sort((a, b) =>
      (a.display_name ?? "").localeCompare(b.display_name ?? "")
    );
  }, [projectsQuery.data]);

  const loading = projectsQuery.isLoading;
  const error = projectsQuery.error?.message ?? null;

  const [editingProject, setEditingProject] = useState<any>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProjectForm, setNewProjectForm] = useState({ ...DEFAULT_NEW_FORM });

  const [searchQuery, setSearchQuery] = useState("");

  // 🔒 Halaman ini soal konfigurasi Project, bukan alarm — jadi pakai
  // canManageAssets (admin/rasindo_operator saja), client_operator tetap
  // diperlakukan read-only di sini walau dia boleh acknowledge alarm.
  const isReadOnly = !canManageAssets(getLocalUser()?.role);

  // Default the create-form's company_id to the first company once the
  // companies list loads — mirrors the old fetchCompaniesList behavior.
  useEffect(() => {
    if (companiesList.length > 0 && !newProjectForm.company_id) {
      setNewProjectForm((prev) => ({
        ...prev,
        company_id: String(companiesList[0].id),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companiesList]);

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
      await createProject.mutateAsync(payload);
      alert("Project berhasil didaftarkan!");
      setIsCreateModalOpen(false);
      setNewProjectForm({ ...DEFAULT_NEW_FORM });
    } catch (err: any) {
      alert(err.message ?? "Gagal menyimpan project.");
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
      await updateProject.mutateAsync({ id: editingProject.project_id, payload });
      alert("Data berhasil diperbarui!");
      setEditingProject(null);
    } catch (err: any) {
      alert(err.message ?? "Gagal memperbarui data.");
    }
  };

  const handleDelete = async (projectId: number, displayName: string) => {
    if (isReadOnly) return alert("Akses ditolak!");
    if (!confirm(`Hapus project "${displayName}"?`)) return;

    try {
      await deleteProject.mutateAsync(projectId);
    } catch (err: any) {
      alert(err.message ?? "Gagal menghapus. Periksa koneksi.");
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
            onClick={() => projectsQuery.refetch()}
            className="p-2.5 bg-slate-50 dark:bg-slate-900/80 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border-none cursor-pointer"
          >
            <RefreshCcw className={`w-3.5 h-3.5 text-slate-500 dark:text-slate-400 ${projectsQuery.isFetching ? "animate-spin" : ""}`} />
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
                <th className="p-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Description</th>
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
                <CompanySelect
                  value={newProjectForm.company_id}
                  onValueChange={(val) => setNewProjectForm({ ...newProjectForm, company_id: val })}
                  companiesList={companiesList}
                  placeholder="Pilih company..."
                />
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
                <label className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 ml-1">Description</label>
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
                  disabled={createProject.isPending}
                  className="flex-1 bg-blue-600 text-white font-black py-3 rounded-xl text-[9px] uppercase shadow-lg border-none tracking-[0.2em] cursor-pointer hover:bg-blue-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  {createProject.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
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
                <CompanySelect
                  value={String(editingProject.company_id ?? "")}
                  onValueChange={(val) => setEditingProject({ ...editingProject, company_id: val })}
                  companiesList={companiesList}
                  placeholder="Pilih company..."
                />
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
                  disabled={updateProject.isPending}
                  className="flex-1 bg-blue-600 text-white font-black py-3 rounded-xl text-[9px] uppercase shadow-lg border-none tracking-[0.2em] cursor-pointer hover:bg-blue-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  {updateProject.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
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