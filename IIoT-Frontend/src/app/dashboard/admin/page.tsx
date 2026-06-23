"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, Building2, CheckCircle, Search, Loader2,
  AlertTriangle, RefreshCcw, Trash2, Edit2, X, AlertCircle, Plus, Link2, ShieldAlert
} from "lucide-react";
import { API_BASE, getAuthHeaders, getLocalUser } from "@/lib/api";

type TabType = 'users' | 'companies';

export default function MasterAdminPage() {
  const router = useRouter();

  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('users');
  const [data, setData] = useState<any[]>([]);
  const [companiesList, setCompaniesList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCompanyForm, setNewCompanyForm] = useState({
    name: "",
    address: "",
    invitation_code: ""
  });

  const [isLinkGenerating, setIsLinkGenerating] = useState(false);

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

  // 2. FETCH DATA UTAMA TABEL
  const fetchData = async () => {
    if (isAuthorized === false) return;
    setIsLoading(true);
    setError(null);

    try {
      const url = `${API_BASE}/${activeTab}/`;

      const res = await fetch(url, {
        method: "GET",
        cache: "no-store",
        headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error(`Gagal mengambil data ${activeTab} dari FastAPI`);

      const result = await res.json();
      setData(result.data || []);
    } catch (err: any) {
      setError(err.message);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCompaniesList = async () => {
    if (isAuthorized === false) return;
    try {
      const res = await fetch(`${API_BASE}/companies/`, { headers: getAuthHeaders() });
      if (res.ok) {
        const result = await res.json();
        setCompaniesList(result.data || []);
      }
    } catch (err) {
      console.error("Gagal sinkronisasi daftar perusahaan:", err);
    }
  };

  useEffect(() => {
    if (isAuthorized === true) {
      fetchData();
      fetchCompaniesList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isAuthorized]);

  const handleDelete = async (id: any, displayName: string) => {
    const confirmDelete = confirm(`Apakah Anda yakin ingin menghapus "${displayName}"? Data ini tidak bisa dikembalikan.`);

    if (confirmDelete) {
      try {
        const url = `${API_BASE}/${activeTab}/${id}`;
        const res = await fetch(url, { method: 'DELETE', headers: getAuthHeaders() });
        const resData = await res.json();

        if (res.ok) {
          alert("Data berhasil dihapus!");
          setData(data.filter(item => item.id !== id));
        } else {
          alert(resData.detail || "Gagal menghapus.");
        }
      } catch (err) {
        alert("Error koneksi ke server FastAPI.");
      }
    }
  };

  const openEditModal = (item: any) => {
    setEditingItem({ ...item });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (e?: React.FormEvent, customPayload?: any) => {
    if (e) e.preventDefault();

    const payload = customPayload || editingItem;
    const idParam = payload.id;

    try {
      const res = await fetch(`${API_BASE}/${activeTab}/${idParam}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const resData = await res.json();

      if (res.ok) {
        if (!customPayload) {
          alert("Data berhasil diperbarui!");
          setIsEditModalOpen(false);
        }
        fetchData();
      } else {
        alert(resData.detail || "Gagal memperbarui data ke database.");
      }
    } catch (err) {
      alert("Error koneksi server FastAPI.");
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch(`${API_BASE}/companies/`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: newCompanyForm.name.trim(),
          address: newCompanyForm.address.trim(),
          invitation_code: newCompanyForm.invitation_code.trim().toUpperCase()
        })
      });

      const resData = await res.json();

      if (res.ok) {
        alert("Organisasi Tenant Baru Berhasil Didaftarkan!");
        setIsCreateModalOpen(false);
        setNewCompanyForm({ name: "", address: "", invitation_code: "" });
        fetchData();
        fetchCompaniesList();
      } else {
        alert(resData.detail || "Gagal menyimpan organisasi baru.");
      }
    } catch (err) {
      alert("Gagal menghubungi server FastAPI.");
    }
  };

  const handleGenerateResetLink = async () => {
    if (!editingItem?.id) return;

    try {
      setIsLinkGenerating(true);
      const res = await fetch(`${API_BASE}/users/generate-reset-token/${editingItem.id}`, {
        method: "POST",
        headers: getAuthHeaders(),
      });

      const resData = await res.json();

      if (res.ok && resData.reset_link) {
        await navigator.clipboard.writeText(resData.reset_link);
        alert(
          `SUCCESS: SECURE LINK GENERATED!\n\n` +
          `Tautan pemulihan mandiri berhasil disalin otomatis ke clipboard.\n` +
          `Silakan teruskan token durasi 15 menit ini ke pengguna:\n\n` +
          `${resData.reset_link}`
        );
        setIsEditModalOpen(false);
      } else {
        alert(resData.detail || "Gagal menjahit token keamanan baru.");
      }
    } catch (err) {
      alert("Gagal berkomunikasi dengan server FastAPI.");
    } finally {
      setIsLinkGenerating(false);
    }
  };

  const handleToggleApproveQuick = (item: any) => {
    const updatedUser = {
      ...item,
      is_approved: !item.is_approved
    };
    handleUpdate(undefined, updatedUser);
  };

  const filteredData = data.filter(item => {
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

          <button onClick={fetchData} className="p-2.5 bg-slate-50 dark:bg-slate-900/80 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border-none cursor-pointer">
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
                {filteredData.length > 0 ? filteredData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors group text-[11px]">

                    {activeTab === 'users' && (
                      <>
                        <td className="p-4">
                          <p className="font-black text-slate-800 dark:text-slate-200 uppercase">{item.name}</p>
                          <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500">{item.email}</p>
                        </td>
                        <td className="p-4">
                          <span className="text-[9px] font-black uppercase text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-1 rounded-lg border border-blue-100 dark:border-blue-900/50">
                            {companiesList.find(c => c.id === item.company_id)?.name || `ID: ${item.company_id}`}
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
                          <span className="font-mono text-blue-600 dark:text-blue-400 font-black tracking-widest bg-blue-50/40 dark:bg-blue-950/20 px-2.5 py-1 rounded-lg text-[10px] border border-blue-100/50 dark:border-blue-900/30">
                            {item.invitation_code}
                          </span>
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
                <button type="submit" className="flex-1 bg-blue-600 text-white font-black py-3 rounded-xl text-[9px] uppercase shadow-lg shadow-blue-100/40 dark:shadow-none border-none tracking-[0.2em] cursor-pointer hover:bg-blue-700 transition-all">Register Tenant</button>
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
                      {companiesList.map((company) => (
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
                      <option value="admin" className="dark:bg-slate-800">👑 SUPER ADMIN</option>
                      <option value="rasindo_operator" className="dark:bg-slate-800">🛠️ RASINDO OPERATOR</option>
                      <option value="rasindo_user" className="dark:bg-slate-800">👁️ RASINDO USER</option>
                      <option value="client_user" className="dark:bg-slate-800">🏢 CLIENT USER</option>
                    </select>
                  </div>

                  <div className="pt-1">
                    <button
                      type="button"
                      disabled={isLinkGenerating}
                      onClick={handleGenerateResetLink}
                      className="w-full bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-black py-3 rounded-xl text-[9px] uppercase tracking-widest transition-all border border-blue-200 dark:border-blue-900/60 cursor-pointer flex justify-center items-center gap-1.5 disabled:opacity-50"
                    >
                      {isLinkGenerating ? (
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
                <button type="submit" className="flex-1 bg-blue-600 text-white font-black py-3 rounded-xl text-[9px] uppercase shadow-lg shadow-blue-100/40 dark:shadow-none border-none tracking-[0.2em] cursor-pointer hover:bg-blue-700 transition-all">Update Data</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}