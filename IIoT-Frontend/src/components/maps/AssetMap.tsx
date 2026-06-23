"use client";
import { API_BASE, getAuthHeaders, getLocalUser } from "@/lib/api";
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes'; 
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Search, Loader2 } from 'lucide-react';

interface Sensor {
  project_id: string;
  display_name: string;
  latitude: string | number;
  longitude: string | number;
  description: string;
  gateways?: any[]; // 🌟 TAMBAHKAN: Array gateway bawaan dari payload API project Anda
  logs?: any[]; 
}

interface AssetMapProps {
  isFullScreen?: boolean;
  showSearch?: boolean; 
  onSelectLocation?: (lat: number, lng: number) => void; 
}

export function AssetMap({ isFullScreen, showSearch = false, onSelectLocation }: AssetMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const adminMarkerRef = useRef<maplibregl.Marker | null>(null);
  const router = useRouter();
  
  const { resolvedTheme } = useTheme();
  
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  const mapStyles = {
    light: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' 
  };

  // 1. FETCH DATA DARI FASTAPI
  useEffect(() => {
    const fetchData = () => {
      try {
        const loggedInUser = getLocalUser();
        const companyId = loggedInUser?.company_id || "";
        const userRole = loggedInUser?.role || "client_user";

        let url = `${API_BASE}/projects/`;
        if (userRole !== "admin" && companyId) {
          url = `${API_BASE}/projects/?company_id=${companyId}`;
        }

        fetch(url, {
          method: "GET",
          cache: "no-store",
          headers: getAuthHeaders(),
        })
          .then((res) => {
            if (!res.ok) throw new Error("Backend menolak permintaan atau sesi tidak sah");
            return res.json();
          })
          .then((result) => {
            const projectArray = result.data || [];
            setSensors(Array.isArray(projectArray) ? projectArray : []);
          })
          .catch((err) => {
            console.error("Gagal sinkronisasi data project:", err);
            setSensors([]);
          })
          .finally(() => setLoading(false));
      } catch (e) {
        console.error("Error membaca localStorage:", e);
        setSensors([]);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  // 2. INISIALISASI PETA DASAR
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const initialStyle = resolvedTheme === "dark" ? mapStyles.dark : mapStyles.light;

    mapRef.current = new maplibregl.Map({
      container: mapContainer.current,
      style: initialStyle, 
      center: [118.0, -2.5], 
      zoom: 4.5
    });

    if (showSearch) {
      mapRef.current.on('click', (e) => {
        const { lng, lat } = e.lngLat;
        updateAdminMarker(lat, lng);
      });
    }

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [showSearch]);

  // 3. SAKLAR TEMA UTAMA
  useEffect(() => {
    if (!mapRef.current) return;
    const targetStyle = resolvedTheme === "dark" ? mapStyles.dark : mapStyles.light;
    mapRef.current.setStyle(targetStyle);
  }, [resolvedTheme]);

  const updateAdminMarker = (lat: number, lng: number) => {
    if (!mapRef.current) return;
    if (adminMarkerRef.current) adminMarkerRef.current.remove();

    adminMarkerRef.current = new maplibregl.Marker({ color: "#ef4444", draggable: true })
      .setLngLat([lng, lat])
      .addTo(mapRef.current);

    if (onSelectLocation) onSelectLocation(lat, lng);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      setIsSearching(true);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`);
      const data = await res.json();
      if (data.length > 0) {
        const { lat, lon } = data[0];
        const nLat = parseFloat(lat);
        const nLng = parseFloat(lon);
        
        mapRef.current?.flyTo({ center: [nLng, nLat], zoom: 14 });
        updateAdminMarker(nLat, nLng);
      } else {
        alert("Lokasi tidak ditemukan! Coba cari nama jalan atau gedung yang lebih spesifik");
      }
    } catch (err) {
      console.error("Gagal mencari koordinat geocoding:", err);
    } finally {
      setIsSearching(false);
    }
  };

  // 4. LOGIKA RENDERING PINPOINT DAN RE-ROUTING BARU 🔒 (WARNA STATIS BIRU)
  useEffect(() => {
    if (!mapRef.current) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const isDark = resolvedTheme === "dark";
    const popupBg = isDark ? "#1e293b" : "#ffffff";
    const popupTextTitle = isDark ? "#f8fafc" : "#1e293b";
    const btnBg = isDark ? "#3b82f6" : "#0f172a";

    // 🔵 KUNCI WARNA STATIS: Warna biru penuh untuk semua pinpoint tombol
    const staticBlueColor = "#2563eb"; 

    sensors.forEach((sensor) => {
      const latFloat = parseFloat(String(sensor.latitude));
      const lngFloat = parseFloat(String(sensor.longitude));

      if (isNaN(latFloat) || isNaN(lngFloat)) return;

      let isOnline = false;
      const sensorLogs = sensor.logs || [];
      
      if (sensorLogs.length > 0) {
        const lastLog = sensorLogs[sensorLogs.length - 1];
        const now = new Date();
        const lastUpdate = new Date(lastLog.created_at);
        const diffInSeconds = Math.abs(now.getTime() - lastUpdate.getTime()) / 1000;
        isOnline = diffInSeconds < 60; 
      }

      const popupHtml = `
        <div style="padding: 14px; min-width: 200px; font-family: sans-serif; background: ${popupBg}; border-radius: 12px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <div style="width: 10px; height: 10px; border-radius: 50%; background: ${staticBlueColor}; box-shadow: 0 0 8px #2563eb;"></div>
            <h4 style="font-weight: 900; margin: 0; color: ${popupTextTitle}; font-size: 13px; text-transform: uppercase; letter-spacing: -0.5px;">${sensor.display_name}</h4>
          </div>
          <button id="btn-${sensor.project_id}" 
                  style="background: ${btnBg}; color: white; border: none; padding: 12px; 
                        border-radius: 12px; cursor: pointer; font-size: 10px; width: 100%; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">
            Inspect Live Node →
          </button>
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 30, closeButton: false }).setHTML(popupHtml);

      const marker = new maplibregl.Marker({ 
          color: staticBlueColor, // 🌟 Menggunakan warna biru statis untuk semua pin
          scale: 0.85
        })
        .setLngLat([lngFloat, latFloat])
        .setPopup(popup)
        .addTo(mapRef.current);
      
      markersRef.current.push(marker);

      marker.getElement().addEventListener('click', () => {
        setTimeout(() => {
          const btn = document.getElementById(`btn-${sensor.project_id}`);
          if (btn) {
            btn.onclick = (e) => {
              e.preventDefault();
              
              const gatewayList = sensor.gateways || [];
              
              if (gatewayList.length > 0) {
                const firstGatewayId = gatewayList[0].gateway_id || gatewayList[0].id;
                router.push(`/dashboard/projects/${sensor.project_id}/${firstGatewayId}`);
              } else {
                router.push(`/dashboard/projects/${sensor.project_id}/no-gateway`);
              }
            };
          }
          const popupContainer = document.querySelector('.maplibregl-popup-content') as HTMLDivElement;
          if (popupContainer && isDark) {
            popupContainer.style.backgroundColor = '#1e293b';
          }
        }, 250);
      });
    });
  }, [sensors, router, resolvedTheme]);

  return (
    <div className={`${isFullScreen ? 'h-screen w-screen' : 'h-full w-full'} overflow-hidden relative z-10`}>
      {showSearch && (
        <div className="absolute top-4 left-4 z-30 flex gap-2 w-full max-w-xs px-2">
          <div className="relative flex-1 group">
            <input 
              type="text"
              className="w-full p-3 pl-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-600 transition-all placeholder:text-slate-400"
              placeholder="Cari nama jalan / pabrik..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Search className="absolute left-3.5 top-3.5 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          </div>
          <button 
            onClick={handleSearch} 
            disabled={isSearching}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl shadow-lg text-[10px] font-black uppercase tracking-widest border-none cursor-pointer transition-all active:scale-95 flex items-center justify-center min-w-[55px]"
          >
            {isSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : "Cari"}
          </button>
        </div>
      )}

      {loading && sensors.length === 0 && (
        <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-20 flex flex-col justify-center items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Loading map topology...</p>
        </div>
      )}

      <div ref={mapContainer} className="w-full h-full relative z-10" />
    </div>
  );
}