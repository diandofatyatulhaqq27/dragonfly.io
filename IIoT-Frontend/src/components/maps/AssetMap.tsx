"use client";
import { getLocalUser } from "@/lib/api";
import { useProjects } from "@/hooks/useProjects";
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Search, Loader2, MapPin, X } from 'lucide-react';

interface Sensor {
  project_id: string;
  display_name: string;
  latitude: string | number;
  longitude: string | number;
  description: string;
  gateways?: any[];
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { resolvedTheme } = useTheme();

  // ─── 1. DATA PROJECT — via React Query (was: useState + useEffect + setInterval) ──
  // Cached under queryKey ["projects", ...] — shared with any other page/
  // component using useProjects(), so navigating away and back to the
  // dashboard shows cached data instantly instead of an empty map with a
  // "Loading map topology..." spinner. refetchInterval preserves the
  // original 5s live-polling behavior.
  const projectsQuery = useProjects({ refetchInterval: 5_000 });
  const sensors: Sensor[] = projectsQuery.data ?? [];
  const loading = projectsQuery.isLoading;

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const mapStyles = {
    light: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
  };

  // ─── 2. INISIALISASI PETA DASAR ──────────────────────────────────────
  // NOTE: this still creates a brand-new maplibregl.Map instance every
  // time this component mounts, and destroys it on unmount. That part is
  // unrelated to data fetching — it's a component lifecycle issue (the
  // map resets camera/zoom and reloads tiles whenever you navigate away
  // and back to a page that renders <AssetMap />). Fixing that would
  // require keeping AssetMap mounted persistently (e.g. in a layout)
  // instead of inside a page that unmounts on navigation — a separate,
  // bigger architectural change from the data-caching fix applied here.
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const initialStyle = resolvedTheme === "dark" ? mapStyles.dark : mapStyles.light;

    mapRef.current = new maplibregl.Map({
      container: mapContainer.current,
      style: initialStyle,
      center: [122.0, -2.5],
      zoom: 4.2
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

  // ─── 3. SAKLAR TEMA ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    const targetStyle = resolvedTheme === "dark" ? mapStyles.dark : mapStyles.light;
    mapRef.current.setStyle(targetStyle);
  }, [resolvedTheme]);

  // ─── 4. CLOSE DROPDOWN KLIK DI LUAR ─────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ─── 5. UPDATE MARKER ADMIN ──────────────────────────────────────────
  const updateAdminMarker = (lat: number, lng: number) => {
    if (!mapRef.current) return;
    if (adminMarkerRef.current) adminMarkerRef.current.remove();

    adminMarkerRef.current = new maplibregl.Marker({ color: "#ef4444", draggable: true })
      .setLngLat([lng, lat])
      .addTo(mapRef.current);

    adminMarkerRef.current.on('dragend', () => {
      const pos = adminMarkerRef.current!.getLngLat();
      if (onSelectLocation) onSelectLocation(pos.lat, pos.lng);
    });

    if (onSelectLocation) onSelectLocation(lat, lng);
  };

  // ─── 6. AUTOCOMPLETE NOMINATIM (DEBOUNCED) ───────────────────────────
  const handleInputChange = useCallback(async (value: string) => {
    setSearchQuery(value);

    if (!value.trim() || value.length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json` +
          `&q=${encodeURIComponent(value)}` +
          `&countrycodes=id` +
          `&limit=6` +
          `&addressdetails=1` +
          `&accept-language=id`,
          { headers: { "Accept-Language": "id" } }
        );
        const data = await res.json();
        setSuggestions(data);
        setShowDropdown(data.length > 0);
      } catch (err) {
        console.error("Nominatim error:", err);
        setSuggestions([]);
        setShowDropdown(false);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  }, []);

  // ─── 7. PILIH SUGGESTION ─────────────────────────────────────────────
  const handleSelectSuggestion = useCallback((item: any) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    setSearchQuery(item.display_name.split(",")[0]);
    setSuggestions([]);
    setShowDropdown(false);
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 16, speed: 1.6 });
    updateAdminMarker(lat, lng);
  }, []);

  // ─── 8. CLEAR SEARCH ─────────────────────────────────────────────────
  const handleClear = () => {
    setSearchQuery("");
    setSuggestions([]);
    setShowDropdown(false);
    if (adminMarkerRef.current) {
      adminMarkerRef.current.remove();
      adminMarkerRef.current = null;
    }
  };

  // ─── 9. HELPER SUBTITLE ──────────────────────────────────────────────
  const getSubtitle = (item: any): string => {
    const addr = item.address || {};
    const parts = [
      addr.suburb || addr.neighbourhood,
      addr.city || addr.town || addr.county,
      addr.state,
    ].filter(Boolean).slice(0, 2);
    return parts.join(", ") || item.display_name;
  };

  // ─── 10. RENDER MARKERS PROJECT ──────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const isDark = resolvedTheme === "dark";
    const popupBg = isDark ? "#1e293b" : "#ffffff";
    const popupTextTitle = isDark ? "#f8fafc" : "#1e293b";
    const btnBg = isDark ? "#3b82f6" : "#0f172a";
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

      const marker = new maplibregl.Marker({ color: staticBlueColor, scale: 0.85 })
        .setLngLat([lngFloat, latFloat])
        .setPopup(popup)
        .addTo(mapRef.current!);

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

      {/* ── SEARCH BAR ── */}
      {showSearch && (
        <div ref={searchWrapperRef} className="absolute top-4 left-4 z-30 w-full max-w-xs px-2">
          <div className="relative">
            {isSearching
              ? <Loader2 className="absolute left-3.5 top-3.5 w-3.5 h-3.5 text-blue-500 animate-spin" />
              : <Search className="absolute left-3.5 top-3.5 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            }
            <input
              type="text"
              className="w-full p-3 pl-10 pr-8 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-600 transition-all placeholder:text-slate-400"
              placeholder="Cari nama jalan / pabrik..."
              value={searchQuery}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setShowDropdown(false);
                if (e.key === "ArrowDown" && suggestions.length > 0) {
                  (document.querySelector('[data-suggestion="0"]') as HTMLElement)?.focus();
                }
              }}
              autoComplete="off"
            />
            {searchQuery && (
              <button
                onClick={handleClear}
                className="absolute right-2.5 top-3 text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer p-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Dropdown suggestions */}
          {showDropdown && suggestions.length > 0 && (
            <div className="mt-1.5 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {suggestions.map((item, i) => (
                <button
                  key={item.place_id}
                  data-suggestion={i}
                  onClick={() => handleSelectSuggestion(item)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      (document.querySelector(`[data-suggestion="${i + 1}"]`) as HTMLElement)?.focus();
                    }
                    if (e.key === "ArrowUp") {
                      i === 0
                        ? (document.querySelector("input") as HTMLInputElement)?.focus()
                        : (document.querySelector(`[data-suggestion="${i - 1}"]`) as HTMLElement)?.focus();
                    }
                  }}
                  className="w-full px-4 py-3 text-left flex items-start gap-3 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors border-none cursor-pointer border-b border-slate-50 dark:border-slate-800 last:border-b-0 bg-transparent focus:bg-blue-50 dark:focus:bg-blue-950/30 outline-none"
                >
                  <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-black text-slate-800 dark:text-slate-100 truncate">
                      {item.display_name.split(",")[0]}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                      {getSubtitle(item)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── LOADING ── */}
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