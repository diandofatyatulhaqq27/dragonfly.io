"use client";

import "./globals.css";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/query-client';
import { ThemeProvider } from "../components/theme/ThemeProvider";
import ThemeToggle from "../components/theme/ThemeToggle";
import 'maplibre-gl/dist/maplibre-gl.css';
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  LayoutDashboard, Activity, BellRing, PieChart, LogOut,
  ShieldCheck, FolderKanban, Network, Menu, ChevronLeft,
  ChevronRight, ChevronDown, Bell, X, AlertTriangle,
  CheckCircle2, User,
} from "lucide-react";
import myLogo from '@/assets/logodragonfly2.png';
import { API_BASE, getAuthHeaders, getLocalUser } from "@/lib/api";

// ── NOTIFICATION DROPDOWN ────────────────────────────────────────────────────
function NotificationDropdown({
  onClose,
  triggerRef,
}: {
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const [alarms, setAlarms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchAlarms = async () => {
      try {
        const res = await fetch(`${API_BASE}/alarms/recent`, { headers: getAuthHeaders() });
        if (res.ok) {
          const result = await res.json();
          setAlarms((result.data ?? []).filter((a: any) => a.status === "ACTIVE"));
        }
      } catch { /* silent fail */ } finally {
        setLoading(false);
      }
    };
    fetchAlarms();
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current && !ref.current.contains(target) &&
          !(triggerRef.current && triggerRef.current.contains(target))) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose, triggerRef]);

  return (
    <div ref={ref} className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Active Alarms</span>
        {alarms.length > 0 && (
          <span className="text-xs font-medium bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full">
            {alarms.length} active
          </span>
        )}
      </div>

      <div className="max-h-72 overflow-y-auto">
        {loading ? (
          <div className="py-8 flex justify-center">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : alarms.length === 0 ? (
          <div className="py-8 flex flex-col items-center gap-2 text-gray-400">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            <p className="text-sm">All systems normal</p>
          </div>
        ) : (
          alarms.map((alarm: any) => (
            <div key={alarm.id} className="px-4 py-3 border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5 animate-pulse" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {alarm.name || "Unnamed Alarm"}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                    {alarm.message}
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 font-mono">
                    {alarm.created_at ? new Date(alarm.created_at).toLocaleString("id-ID") : "—"}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800">
        <Link
          href="/dashboard/alarms"
          onClick={onClose}
          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          View all alarms →
        </Link>
      </div>
    </div>
  );
}

// ── USER DROPDOWN ────────────────────────────────────────────────────────────
function UserDropdown({
  user,
  onClose,
  onSignOut,
  triggerRef,
}: {
  user: { name: string; role: string; company_id: number } | null;
  onClose: () => void;
  onSignOut: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const getRoleLabel = (role: string | undefined) => {
    switch (role) {
      case "admin": return "Administrator";
      case "rasindo_operator": return "Rasindo Operator";
      case "rasindo_user": return "Rasindo User";
      case "client_user": return "Client User";
      default: return "User";
    }
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current && !ref.current.contains(target) &&
          !(triggerRef.current && triggerRef.current.contains(target))) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose, triggerRef]);

  return (
    <div ref={ref} className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{user?.name || "User"}</p>
        <p className="text-xs text-gray-400 mt-0.5">{getRoleLabel(user?.role)}</p>
      </div>
      <div className="py-1">
        <div className="flex items-center gap-2.5 px-4 py-2.5 text-gray-500 dark:text-gray-400 text-sm select-none">
          <User className="w-4 h-4 shrink-0" />
          <span>Company ID: {user?.company_id ?? "—"}</span>
        </div>
        <button
          onClick={() => { onSignOut(); onClose(); }}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors border-none bg-transparent cursor-pointer"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign out
        </button>
      </div>
    </div>
  );
}

// ── MAIN LAYOUT ──────────────────────────────────────────────────────────────
function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<{ name: string; role: string; company_id: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeAlarmCount, setActiveAlarmCount] = useState(0);

  const bellButtonRef = useRef<HTMLButtonElement>(null);
  const userButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!user) return;
    const fetchAlarmCount = async () => {
      try {
        const res = await fetch(`${API_BASE}/alarms/recent`, { headers: getAuthHeaders() });
        if (res.ok) {
          const result = await res.json();
          const active = (result.data ?? []).filter((a: any) => a.status === "ACTIVE").length;
          setActiveAlarmCount(active);
        }
      } catch { /* silent */ }
    };
    fetchAlarmCount();
    const interval = setInterval(fetchAlarmCount, 15000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const savedUser = localStorage.getItem("iiot_user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    } else if (
      pathname !== '/login' &&
      pathname !== '/register' &&
      pathname !== '/reset-password'
    ) {
      router.push("/login");
    }
    setIsLoading(false);
  }, [pathname]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const isAuthPage =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/reset-password';

  const showNavigation = !!user && !isAuthPage;

  const handleSignOut = () => {
    localStorage.removeItem("iiot_user");
    localStorage.removeItem("iiot_token");
    setUser(null);
    router.push("/login");
  };

  const getRoleBadgeColor = (role: string | undefined) => {
    switch (role) {
      case "admin": return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
      case "rasindo_operator": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "rasindo_user": return "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400";
      default: return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
    }
  };

  const getRoleLabel = (role: string | undefined) => {
    switch (role) {
      case "admin": return "Admin";
      case "rasindo_operator": return "Operator";
      case "rasindo_user": return "Rasindo";
      case "client_user": return "Client";
      default: return "User";
    }
  };

  const getPageTitle = () => {
    if (pathname === '/dashboard') return 'Dashboard';
    if (pathname.includes('/dashboard/admin')) return 'Administrator';
    if (pathname.includes('/dashboard/monitoring')) return 'Monitoring';
    if (pathname.includes('/dashboard/projects')) return 'Projects';
    if (pathname.includes('/dashboard/gateways')) return 'Gateways';
    if (pathname.includes('/dashboard/alarms')) return 'Alarms';
    if (pathname.includes('/dashboard/datalogger')) return 'Data Logger';
    return 'Dashboard';
  };

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true, adminOnly: false },
    { href: '/dashboard/monitoring', label: 'Monitoring', icon: Activity, exact: false, adminOnly: false },
    { href: '/dashboard/projects', label: 'Projects', icon: FolderKanban, exact: false, adminOnly: false },
    { href: '/dashboard/gateways', label: 'Gateways', icon: Network, exact: false, adminOnly: false },
    { href: '/dashboard/alarms', label: 'Alarms', icon: BellRing, exact: false, adminOnly: false },
    { href: '/dashboard/datalogger', label: 'Data Logger', icon: PieChart, exact: false, adminOnly: false },
    { href: '/dashboard/admin', label: 'Administrator', icon: ShieldCheck, exact: false, adminOnly: true },
  ];

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex flex-col h-full">
      <div className={`flex items-center border-b border-gray-100 dark:border-gray-800 transition-all duration-300 ${
        collapsed && !isMobile ? 'px-3 py-[17px] justify-center' : 'px-5 py-[17px] gap-3'
      }`}>
        <div className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0">
          <Image 
            src={myLogo} 
            alt="Logo" 
            fill 
            className="object-cover" 
            priority 
          />
        </div>
        {(!collapsed || isMobile) && (
          <span className="text-xl tracking-tighter text-slate-900 dark:text-white shrink-0 leading-none antialiased" style={{ fontFamily: '"Arial Black", "Impact", sans-serif', fontWeight: 900 }}>
            Dragonfly<span className="text-zinc-400">.</span>
            <span className="text-blue-600">io</span>
          </span>
        )}
      </div>

      <nav className={`flex-1 py-3 space-y-0.5 overflow-y-auto transition-all duration-300 ${
        collapsed && !isMobile ? 'px-2' : 'px-3'
      }`}>
        {(!collapsed || isMobile) && (
          <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-3 mb-2">
            Menu
          </p>
        )}

        {navLinks
          .filter(link => !link.adminOnly || user?.role === 'admin')
          .map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                title={collapsed && !isMobile ? label : undefined}
                className={`flex items-center rounded-lg text-sm font-medium transition-all group ${
                  collapsed && !isMobile ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
                } ${
                  active
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                <Icon className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                  active
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                }`} />
                {(!collapsed || isMobile) && (
                  <>
                    <span className="flex-1">{label}</span>
                  </>
                )}
              </Link>
            );
          })}
      </nav>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-gray-50 dark:bg-gray-900 font-sans text-gray-900 dark:text-gray-100 overflow-hidden">
      {showNavigation && (
        <aside className={`bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 hidden md:flex flex-col shrink-0 transition-all duration-300 ${
          collapsed ? 'w-[60px]' : 'w-64'
        }`}>
          <SidebarContent />
        </aside>
      )}

      {showNavigation && sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="fixed top-0 left-0 h-full w-64 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex flex-col z-50 md:hidden">
            <SidebarContent isMobile />
          </aside>
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {showNavigation && (
          <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center px-4 md:px-6 justify-between shrink-0 gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors md:hidden border-none bg-transparent cursor-pointer"
              >
                <Menu className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>

              <button
                onClick={() => setCollapsed(!collapsed)}
                className="hidden md:flex p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border-none bg-transparent cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>

              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {getPageTitle()}
              </h2>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Fitur Search Bar Selesai Dihapus Sepenuhnya Agar Header Terlihat Bersih dan Ringkas */}

              <div className="relative">
                <button
                  ref={bellButtonRef}
                  onClick={() => { setShowNotifications((prev) => !prev); setShowUserMenu(false); }}
                  className="relative p-2.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors border-none bg-transparent cursor-pointer"
                >
                  <Bell className="w-5 h-5" />
                  {activeAlarmCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full" />
                  )}
                </button>
                {showNotifications && (
                  <NotificationDropdown
                    onClose={() => setShowNotifications(false)}
                    triggerRef={bellButtonRef}
                  />
                )}
              </div>

              <ThemeToggle />

              <div className="relative">
                <button
                  ref={userButtonRef}
                  onClick={() => { setShowUserMenu((prev) => !prev); setShowNotifications(false); }}
                  className="flex items-center gap-2 pl-2 border-l border-gray-100 dark:border-gray-800 cursor-pointer hover:opacity-80 transition-opacity border-none bg-transparent"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {user?.name?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:block">
                    {user?.name?.split(" ")[0] || "User"}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-gray-400 hidden sm:block transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
                </button>
                {showUserMenu && (
                  <UserDropdown
                    user={user}
                    onClose={() => setShowUserMenu(false)}
                    onSignOut={handleSignOut}
                    triggerRef={userButtonRef}
                  />
                )}
              </div>
            </div>
          </header>
        )}

        <main className="flex-1 relative overflow-auto bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body className="antialiased text-sm">
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <LayoutContent>{children}</LayoutContent>
          </ThemeProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}