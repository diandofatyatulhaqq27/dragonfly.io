// src/app/dashboard/datalogger/page.tsx
//
// SERVER COMPONENT — tidak ada "use client" di sini.
// Fetch data awal (projects, gateways, dan log halaman pertama) terjadi
// di SERVER sebelum HTML dikirim ke browser. User langsung lihat tabel
// terisi, tanpa spinner "Re-indexing telemetry records...".
//
// Filter interaktif (ganti project/gateway/tanggal/pagination) ditangani
// oleh komponen client kecil <DataLoggerClient>, yang menerima data awal
// ini sebagai props dan hanya re-fetch saat user benar-benar mengubah filter.

import { cookies } from "next/headers";
import { DataLoggerClient } from "./DataLoggerClient";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:8000/api";

async function getAuthHeadersServer(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value; // sesuaikan nama cookie auth kamu
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchInitialData() {
  const headers = await getAuthHeadersServer();

  // Fetch projects & gateways secara paralel di server
  const [resProjects, resGateways] = await Promise.all([
    fetch(`${API_BASE}/projects/`, { headers, cache: "no-store" }),
    fetch(`${API_BASE}/gateways/`, { headers, cache: "no-store" }),
  ]);

  const projects = resProjects.ok ? (await resProjects.json()).data ?? [] : [];
  const gateways = resGateways.ok ? (await resGateways.json()).data ?? [] : [];

  // Project pertama jadi default selection
  const firstProjectId = projects[0]?.project_id ? String(projects[0].project_id) : "";

  let initialLogs: any[] = [];
  let initialPagination = { page: 1, page_size: 25, total_records: 0, total_pages: 0 };

  if (firstProjectId) {
    // Ambil gateway pertama di project pertama untuk initial fetch logs
    // (Endpoint /gateways/{id}/logs butuh gateway_id spesifik;
    //  kalau mau "semua gateway dalam project" sejak awal, ganti ke
    //  endpoint project-level kalau backend kamu punya, atau looping
    //  beberapa gateway sekaligus — tergantung kebutuhan.)
    const gatewaysInProject = gateways.filter(
      (g: any) => String(g.project_id) === firstProjectId
    );

    if (gatewaysInProject.length > 0) {
      const firstGatewayId = gatewaysInProject[0].gateway_id;
      const resLogs = await fetch(
        `${API_BASE}/gateways/${firstGatewayId}/logs?page=1&page_size=25`,
        { headers, cache: "no-store" }
      );
      if (resLogs.ok) {
        const json = await resLogs.json();
        initialLogs = json.data?.logs ?? [];
        initialPagination = json.data?.pagination ?? initialPagination;
      }
    }
  }

  return { projects, gateways, firstProjectId, initialLogs, initialPagination };
}

export default async function DataLoggerPage() {
  const { projects, gateways, firstProjectId, initialLogs, initialPagination } =
    await fetchInitialData();

  return (
    <DataLoggerClient
      initialProjects={projects}
      initialGateways={gateways}
      initialSelectedProject={firstProjectId}
      initialLogs={initialLogs}
      initialPagination={initialPagination}
    />
  );
}