"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Cpu, PlusCircle, ServerCrash } from "lucide-react";

/**
 * Generic in-dashboard error/empty-state page.
 *
 * Usage: router.replace(`/dashboard/error404?reason=no-gateway&projectId=${projectId}`)
 *
 * Query params:
 * - reason: "no-gateway" | "load-failed" | anything else (falls back to a generic message)
 * - projectId: optional, only used to personalize the "no-gateway" message
 * - back: optional override for where the primary button goes (default: /dashboard/projects)
 */

const REASONS: Record<string, { icon: any; title: string; message: (projectId: string | null) => string }> = {
  "no-gateway": {
    icon: Cpu,
    title: "Belum Ada Gateway",
    message: (projectId) =>
      `Project ${projectId ? `#${projectId}` : ""} belum punya gateway yang terhubung. Tambahkan gateway dulu untuk mulai melihat data telemetri.`,
  },
  "load-failed": {
    icon: ServerCrash,
    title: "Gagal Memuat Data",
    message: () => "Terjadi masalah saat mengambil data dari server. Coba muat ulang halaman ini.",
  },
};

const DEFAULT_REASON = {
  icon: ServerCrash,
  title: "404 · Halaman Tidak Ditemukan",
  message: () => "Halaman atau data yang kamu cari tidak tersedia.",
};

export default function Error404Page() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const reasonKey = searchParams.get("reason") ?? "";
  const projectId = searchParams.get("projectId");
  const backTarget = searchParams.get("back") ?? "/dashboard/projects";

  const reason = REASONS[reasonKey] ?? DEFAULT_REASON;
  const Icon = reason.icon;
  const isNoGateway = reasonKey === "no-gateway";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-slate-400" />
      </div>
      <h1 className="text-2xl font-black tracking-tighter text-slate-800 dark:text-slate-100 uppercase italic">
        {reason.title}
      </h1>
      <p className="mt-2 max-w-sm text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
        {reason.message(projectId)}
      </p>
      <div className="mt-6 flex items-center gap-2">
        <button
          onClick={() => router.push(backTarget)}
          className="flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer border border-slate-200 dark:border-slate-700 shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Semua Project
        </button>
        {isNoGateway && (
          <button
            onClick={() => router.push("/dashboard/gateways")}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer border-none shadow"
          >
            <PlusCircle className="w-3.5 h-3.5" /> Tambah Gateway
          </button>
        )}
      </div>
    </div>
  );
}