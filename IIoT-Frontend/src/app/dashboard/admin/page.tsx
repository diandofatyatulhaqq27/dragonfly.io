"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, Building2, CheckCircle, Search, Loader2, Eye, EyeOff,
  AlertTriangle, RefreshCcw, Trash2, Edit2, X, AlertCircle, Plus, Link2, ShieldAlert
} from "lucide-react";
import { getLocalUser } from "@/lib/api";

import { useUsers, useUpdateUser, useDeleteUser, useGenerateResetLink } from "@/hooks/useUsers";
import { useCompanies, useCreateCompany, useUpdateCompany, useDeleteCompany } from "@/hooks/useCompanies";

type TabType = 'users' | 'companies';

function InvitationCodeCell({ code }: { code: string }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (isVisible) {
      // Set timer untuk otomatis menyembunyikan kembali setelah 10 detik (10000 ms)
      timer = setTimeout(() => {
        setIsVisible(false);
      }, 10000);
    }

    // Bersihkan timer jika user menutup manual sebelum 10 detik atau komponen di-unmount
    return () => clearTimeout(timer);
  }, [isVisible]);

  return (
    <div className="flex items-center gap-2 w-full h-full min-h-[32px]">
      <span className={`font-mono text-blue-600 dark:text-blue-400 font-black tracking-widest bg-blue-50/40 dark:bg-blue-950/20 px-2.5 py-1 rounded-lg text-[10px] border border-blue-100/50 dark:border-blue-900/30 transition-all duration-300 ${
        isVisible ? "blur-none" : "blur-sm select-none"
      }`}>
        {code}
      </span>

      <button
        onClick={() => setIsVisible(!isVisible)}
        className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors flex items-center justify-center"
      >
        {isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

export default function MasterAdminPage() {
  const router = useRouter();

  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('users');
  const [search, setSearch] = useState("");

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCompanyForm, setNewCompanyForm] = useState({
    name: "",
    address: "",
    invitation_code: ""
  });

  // 1. VALIDASI SECURITY GUARD
  useEffect(() => {
    const checkAdminAuthorization = () => {
      try {
        const loggedInUser = getLocalUser();

        if (!loggedInUser || loggedInUser.role !== "admin") {
          console.warn("Akses Ilegal Terdeteksi! Bukan Admin.");
          setIsAuthorized(false);
          router.replace("/dashboard");
        } else {
          setIsAuthorized(true);
        }
      } catch (err) {
        setIsAuthorized(false);
        router.replace("/login");
      }
    };

    checkAdminAuthorization();
  }, [router]);

  // 2. DATA
  // Both queries are gated on isAuthorized so we never hit the API before
  // the guard above has confirmed the user is an admin. companiesList is
  // needed regardless of activeTab (used for the users-tab company
  // lookup + dropdown), so it stays enabled across both tabs.
  const usersQuery = useUsers({ enabled: isAuthorized === true });
  const companiesQuery = useCompanies({ enabled: isAuthorized === true });

  const createCompany = useCreateCompany();
  const updateCompany = useUpdateCompany();
  const deleteCompany = useDeleteCompany();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const generateResetLink = useGenerateResetLink();

  const companiesList = companiesQuery.data ?? [];
  const data = activeTab === 'users' ? (usersQuery.data ?? []) : companiesList;
  const isLoading = activeTab === 'users' ? usersQuery.isLoading : companiesQuery.isLoading;
  const error = (activeTab === 'users' ? usersQuery.error?.message : companiesQuery.error?.message) ?? null;

  const handleRefresh = () => {
    if (activeTab === 'users') usersQuery.refetch();
    else companiesQuery.refetch();
  };

  const handleDelete = async (id: any, displayName: string) => {
    const confirmDelete = confirm(`Apakah Anda yakin ingin menghapus "${displayName}"? Data ini tidak bisa dikembalikan.`);
    if (!confirmDelete) return;

    try {
      if (activeTab === 'users') await deleteUser.mutateAsync(id);
      else await deleteCompany.mutateAsync(id);
      alert("Data berhasil dihapus!");
    } catch (err: any) {
      alert(err.message ?? "Gagal menghapus.");
    }
  };

  const openEditModal = (item: any) => {
    setEditingItem({ ...item });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (e?: React.FormEvent, customPayload?: any) => {
    if (e) e.preventDefault();

    const payload = customPayload || editingItem;

    try {
      if (activeTab === 'users') await updateUser.mutateAsync(payload);
      else await updateCompany.mutateAsync(payload);

      if (!customPayload) {
        alert("Data berhasil diperbarui!");
        setIsEditModalOpen(false);
      }
    } catch (err: any) {
      alert(err.message ?? "Gagal memperbarui data ke database.");
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await createCompany.mutateAsync({
        name: newCompanyForm.name.trim(),
        address: newCompanyForm.address.trim(),
        invitation_code: newCompanyForm.invitation_code.trim().toUpperCase(),
      });
      alert("Organisasi Tenant Baru Berhasil Didaftarkan!");
      setIsCreateModalOpen(false);
      setNewCompanyForm({ name: "", address: "", invitation_code: "" });
    } catch (err: any) {
      alert(err.message ?? "Gagal menyimpan organisasi baru.");
    }
  };

  const handleGenerateResetLink = async () => {
    if (!editingItem?.id) return;

    try {
      const resData = await generateResetLink.mutateAsync(editingItem.id);
      await navigator.clipboard.writeText(resData.reset_link);
      alert(
        `SUCCESS: SECURE LINK GENERATED!\n\n` +
        `Tautan pemulihan mandiri berhasil disalin otomatis ke clipboard.\n` +
        `Silakan teruskan token durasi 15 menit ini ke pengguna:\n\n` +
        `${resData.reset_link}`
      );
      setIsEditModalOpen(false);
    } catch (err: any) {
      alert(err.message ?? "Gagal berkomunikasi dengan server FastAPI.");
    }
  };

  const handleToggleApproveQuick = (item: any) => {
    const updatedUser = {
      ...item,
      is_approved: !item.is_approved
    };
    handleUpdate(undefined, updatedUser);
  };

  const filteredData = data.filter((item: any) => {
    const s = search.toLowerCase();
    return Object.values(item).some(val => String(val).toLowerCase().includes(s));
  });

  // ========================================================
  // RENDERING
  // ========================================================
  if (isAuthorized === null) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col justify-center items-center gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-slate-800 dark:text-slate-200" />
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Verifying Admin Clearance...</p>
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col justify-center items-center gap-3 font-sans">
        <ShieldAlert className="w-10 h-10 text-rose-600 animate-bounce" />
        <h2 className="text-[13px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">Access Denied</h2>
        <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Halaman Master Control dikunci khusus kasta Admin tertinggi.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-transparent min-h-screen font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">

      {/* Tab Selector */}
      <div className="flex gap-1.5 p-1 bg-slate-200/50 dark:bg-slate-800/60 w-fit rounded-xl border border-slate-200 dark:border-slate-700 transition-all">
        {[
          { id: 'users', label: 'Users System', icon: Users },
          { id: 'companies', label: 'Companies Tenant', icon: Building2 },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer border-none ${
              activeTab === tab.id
                ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:bg-white/40 dark:hover:bg-slate-700/40'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Main Table Container */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-all duration-300">

        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3 bg-white dark:bg-slate-800">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder={`Search ${activeTab} records...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-900/60 text-slate-800 dark:text-slate-200 rounded-xl text-[11px] font-bold outline-none focus:ring-2 ring-blue-100 dark:ring-blue-900/40 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 border-none"
            />
          </div>

          {activeTab === 'companies' && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider shadow-md active:scale-95 transition-all border-none cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-white stroke-[3]" /> Add Organization
            </button>
          )}

          <button onClick={handleRefresh} className="p-2.5 bg-slate-50 dark:bg-slate-900/80 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border-none cursor-pointer">
            <RefreshCcw className={`w-3.5 h-3.5 text-slate-500 dark:text-slate-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-20 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
              <p className="mt-3 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Syncing with FastAPI...</p>
            </div>
          ) : error ? (
            <div className="p-16 text-center text-rose-500 font-bold flex flex-col items-center gap-2 italic text-[11px] uppercase">
              <AlertTriangle className="w-5 h-5" /> {error}
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-900/40">
                  {activeTab === 'users' && (
                    <>
                      <th className="p-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">User Identity</th>
                      <th className="p-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Company/Tenant Name</th>
                      <th className="p-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Role Level</th>
                      <th className="p-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Status Access</th>
                    </>
                  )}
                  {activeTab === 'companies' && (
                    <>
                      <th className="p-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Company/Tenant Name</th>
                      <th className="p-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Address</th>
                      <th className="p-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Invitation Code</th>
                    </>
                  )}
                  <th className="p-4 text-center text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Control Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/40">
                {filteredData.length > 0 ? filteredData.map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors group text-[11px]">

                    {activeTab === 'users' && (
                      <>
                        <td className="p-4">
                          <p className="font-black text-slate-800 dark:text-slate-200 uppercase">{item.name}</p>
                          <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500">{item.email}</p>
                        </td>
                        <td className="p-4">
                          <span className="text-[9px] font-black uppercase text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-1 rounded-lg border border-blue-100 dark:border-blue-900/50">
                            {companiesList.find((c: any) => c.id === item.company_id)?.name || `ID: ${item.company_id}`}
                          </span>
                        </td>
                        <td className="p-4 font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 text-[9px]">{item.role}</td>
                        <td className="p-4 font-black uppercase text-[9px]">
                          <span className={item.is_approved ? 'text-emerald-500 dark:text-emerald-400' : 'text-amber-500 dark:text-amber-400'}>
                            {item.is_approved ? '✓ Active' : '⏳ Pending Approval'}
                          </span>
                        </td>
                      </>
                    )}

                    {activeTab === 'companies' && (
                      <>
                        <td className="p-4 font-black uppercase text-slate-800 dark:text-slate-200 tracking-tight">{item.name}</td>
                        <td className="p-4 font-bold text-slate-500 dark:text-slate-400 uppercase">{item.address}</td>
                        <td className="p-4">
                          <div className="font-mono text-blue-600 dark:text-blue-400 font-black tracking-widest bg-blue-50/40 dark:bg-blue-950/20 px-2.5 py-1 rounded-lg text-[10px] border border-blue-100/50 dark:border-blue-900/30">
                          <InvitationCodeCell code={item.invitation_code} />
                          </div>
                        </td>
                      </>
                    )}

                    <td className="p-4">
                      <div className="flex justify-center gap-1.5">
                        {activeTab === 'users' && (
                          <button
                            onClick={() => handleToggleApproveQuick(item)}
                            className={`p-1.5 rounded-md transition-all border-none bg-transparent cursor-pointer ${item.is_approved ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30' : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'}`}
                            title={item.is_approved ? "Revoke Access" : "Quick Approve"}
                          >
                            {item.is_approved ? <AlertCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        <button onClick={() => openEditModal(item)} className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-md transition-all border-none bg-transparent cursor-pointer" title="Edit Info">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(item.id, item.name)} className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-md transition-all border-none bg-transparent cursor-pointer" title="Purge Record">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={activeTab === 'users' ? 5 : 4} className="p-20 text-center text-slate-400 dark:text-slate-500 text-[9px] font-black uppercase italic tracking-[0.2em]">Zero Records Found</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* --- MODAL: REGISTER NEW ORGANIZATION --- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className="p-4 border-b border-slate-50 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/40">
              <h2 className="font-black text-[11px] uppercase tracking-widest text-slate-800 dark:text-slate-100 italic flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Add New Organization
              </h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-400 border-none bg-transparent cursor-pointer"><X className="w-3.5 h-3.5" /></button>
            </div>

            <form onSubmit={handleCreateCompany} className="p-6 space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 ml-1">Company / Industry Name</label>
                <input type="text" placeholder="CONTOH: PT UNILEVER INDONESIA TBK" value={newCompanyForm.name} onChange={(e) => setNewCompanyForm({...newCompanyForm, name: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-[11px] font-black border-none ring-1 ring-slate-100 dark:ring-slate-700/50 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-600 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600" required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 ml-1">Physical Site Address</label>
                <input type="text" placeholder="CONTOH: KAWASAN INDUSTRI JABABEKA V, BEKASI" value={newCompanyForm.address} onChange={(e) => setNewCompanyForm({...newCompanyForm, address: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-[11px] font-bold border-none ring-1 ring-slate-100 dark:ring-slate-700/50 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-600 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600" required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 ml-1">Invitation Secure Code</label>
                <input type="text" placeholder="CONTOH: ULVR-JBBK-2026" value={newCompanyForm.invitation_code} onChange={(e) => setNewCompanyForm({...newCompanyForm, invitation_code: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-[11px] font-mono font-black tracking-widest text-blue-600 dark:text-blue-400 border-none ring-1 ring-slate-100 dark:ring-slate-700/50 focus:ring-2 focus:ring-blue-600 outline-none placeholder:text-blue-200 dark:placeholder:text-blue-900/40" required />
              </div>
              <div className="pt-3 flex gap-2">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 rounded-xl text-[9px] font-black uppercase tracking-widest border-none cursor-pointer">Batal</button>
                <button
                  type="submit"
                  disabled={createCompany.isPending}
                  className="flex-1 bg-blue-600 text-white font-black py-3 rounded-xl text-[9px] uppercase shadow-lg shadow-blue-100/40 dark:shadow-none border-none tracking-[0.2em] cursor-pointer hover:bg-blue-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  {createCompany.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                  Register Tenant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL EDIT DATA EXISTING --- */}
      {isEditModalOpen && editingItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className="p-4 border-b border-slate-50 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/40">
              <h2 className="font-black text-[11px] uppercase tracking-widest text-slate-800 dark:text-slate-100 italic flex items-center gap-2">
                <Edit2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Edit {activeTab}
              </h2>
              <button onClick={() => setIsEditModalOpen(false)} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-400 border-none bg-transparent cursor-pointer"><X className="w-3.5 h-3.5" /></button>
            </div>

            <form onSubmit={handleUpdate} className="p-6 space-y-3">
              {activeTab === 'users' && (
                <>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 ml-1">Full Name</label>
                    <input type="text" value={editingItem.name} onChange={(e) => setEditingItem({...editingItem, name: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-[11px] font-black border-none ring-1 ring-slate-100 dark:ring-slate-700/50 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-600 outline-none transition-all" />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 ml-1">Bound Company Assignment</label>
                    <select
                      value={editingItem.company_id}
                      onChange={(e) => setEditingItem({...editingItem, company_id: parseInt(e.target.value)})}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-[11px] font-black border-none ring-1 ring-slate-100 dark:ring-slate-700/50 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-600 outline-none cursor-pointer"
                    >
                      {companiesList.map((company: any) => (
                        <option key={company.id} value={company.id} className="dark:bg-slate-800">
                          {company.name.toUpperCase()} (ID: {company.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 ml-1">Account Approval Status</label>
                    <select
                      value={editingItem.is_approved ? "true" : "false"}
                      onChange={(e) => setEditingItem({...editingItem, is_approved: e.target.value === "true"})}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-[11px] font-black border-none ring-1 ring-slate-100 dark:ring-slate-700/50 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-600 outline-none cursor-pointer"
                    >
                      <option value="false" className="dark:bg-slate-800">⏳ PENDING APPROVAL</option>
                      <option value="true" className="dark:bg-slate-800">✓ ACTIVE / APPROVED</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 ml-1">Access Level Role</label>
                    <select
                      value={editingItem.role}
                      onChange={(e) => setEditingItem({...editingItem, role: e.target.value})}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-[11px] font-black border-none ring-1 ring-slate-100 dark:ring-slate-700/50 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-600 outline-none cursor-pointer"
                    >
                      <option value="admin" className="dark:bg-slate-800"> SUPER ADMIN</option>
                      <option value="rasindo_operator" className="dark:bg-slate-800"> RASINDO OPERATOR</option>
                      <option value="rasindo_user" className="dark:bg-slate-800"> RASINDO USER</option>
                      <option value="client_operator" className="dark:bg-slate-800"> CLIENT OPERATOR</option>
                      <option value="client_user" className="dark:bg-slate-800"> CLIENT USER</option>
                    </select>
                  </div>

                  <div className="pt-1">
                    <button
                      type="button"
                      disabled={generateResetLink.isPending}
                      onClick={handleGenerateResetLink}
                      className="w-full bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-black py-3 rounded-xl text-[9px] uppercase tracking-widest transition-all border border-blue-200 dark:border-blue-900/60 cursor-pointer flex justify-center items-center gap-1.5 disabled:opacity-50"
                    >
                      {generateResetLink.isPending ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" /> Generating Token...
                        </>
                      ) : (
                        <>
                          <Link2 className="w-3 h-3" /> Generate & Copy Reset Link
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}

              {activeTab === 'companies' && (
                <>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 ml-1">Company Name</label>
                    <input type="text" value={editingItem.name} onChange={(e) => setEditingItem({...editingItem, name: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-[11px] font-black border-none ring-1 ring-slate-100 dark:ring-slate-700/50 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-600 outline-none transition-all" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 ml-1">Physical Address</label>
                    <input type="text" value={editingItem.address} onChange={(e) => setEditingItem({...editingItem, address: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-[11px] font-black border-none ring-1 ring-slate-100 dark:ring-slate-700/50 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-600 outline-none transition-all" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 ml-1">Invitation Code</label>
                    <input type="text" value={editingItem.invitation_code} onChange={(e) => setEditingItem({...editingItem, invitation_code: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-[11px] font-mono font-black tracking-widest text-blue-600 dark:text-blue-400 border-none ring-1 ring-slate-100 dark:ring-slate-700/50 focus:ring-2 focus:ring-blue-600 outline-none" />
                  </div>
                </>
              )}

              <div className="pt-3 flex gap-2">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 rounded-xl text-[9px] font-black uppercase tracking-widest border-none cursor-pointer">Batal</button>
                <button
                  type="submit"
                  disabled={updateUser.isPending || updateCompany.isPending}
                  className="flex-1 bg-blue-600 text-white font-black py-3 rounded-xl text-[9px] uppercase shadow-lg shadow-blue-100/40 dark:shadow-none border-none tracking-[0.2em] cursor-pointer hover:bg-blue-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  {(updateUser.isPending || updateCompany.isPending) && <Loader2 className="w-3 h-3 animate-spin" />}
                  Update Data
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}