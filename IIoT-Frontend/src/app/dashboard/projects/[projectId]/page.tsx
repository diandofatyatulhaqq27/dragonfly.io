"use client";
import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { API_BASE, getAuthHeaders } from "@/lib/api";

export default function ProjectRedirectPage() {
  const router = useRouter();
  const { projectId } = useParams();

  useEffect(() => {
    if (!projectId) return;

    const redirect = async () => {
      try {
        const res = await fetch(`${API_BASE}/projects/${projectId}`, {
          method: "GET",
          cache: "no-store",
          headers: getAuthHeaders(),
        });

        if (!res.ok) throw new Error("Gagal memuat project.");

        const result = await res.json();
        const gatewayList: any[] = result.data?.gateways ?? [];

        if (gatewayList.length > 0) {
          const sorted = [...gatewayList].sort(
            (a, b) => (a.gateway_id ?? a.id ?? 0) - (b.gateway_id ?? b.id ?? 0)
          );
          const firstId = sorted[0].gateway_id ?? sorted[0].id;
          router.replace(`/dashboard/projects/${projectId}/${firstId}`);
        } else {
          router.replace(`/dashboard/projects/${projectId}/no-gateway`);
        }
      } catch (err) {
        console.error("Redirect error:", err);
        router.replace("/dashboard/projects");
      }
    };

    redirect();
  }, [projectId, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
      <p className="mt-3 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
        Resolving topology gateway nodes...
      </p>
    </div>
  );
}