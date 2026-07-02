"use client";

import React, { useState } from 'react';
import { Mail, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import myLogo from '@/assets/logodragonfly2.png';
import NetworkBackground from '@/components/NetworkBackground2';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          setError("Akun Anda belum disetujui Admin.");
        } else if (response.status === 401) {
          setError("Email atau Password salah.");
        } else {
          setError(result.detail || "Gagal masuk ke sistem.");
        }
        setIsLoading(false);
        return;
      }

      const userData = result.user ? result.user : result;
      localStorage.setItem("iiot_user", JSON.stringify(userData));

      if (result.access_token) {
        localStorage.setItem("iiot_token", result.access_token);
      }

      router.push("/dashboard");
      router.refresh();

    } catch (err) {
      setError("Koneksi ke backend FastAPI gagal.");
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-50 flex items-center justify-center p-6 overflow-hidden">
      {/* Ambient IIoT network background */}
      <NetworkBackground />

      {/* Login card — z-10 keeps it above the canvas */}
      <div className="relative z-10 w-full max-w-[360px] bg-white/95 backdrop-blur-sm rounded-xl border border-slate-200 shadow-xl p-6">

        {/* BRANDING LOGO SECTION */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="relative w-12 h-11 rounded-lg overflow-hidden shrink-0 mb-3">
            <Image
              src={myLogo}
              alt="Logo"
              fill
              className="object-cover"
              priority
            />
          </div>

          <span
            className="text-2xl tracking-[0.05em] text-slate-900 dark:text-slate-900 leading-none antialiased"
            style={{ fontFamily: '"Arial Black", "Impact", sans-serif', fontWeight: 900 }}
          >
            Dragonfly<span className="text-zinc-400">.</span>
            <span className="text-blue-600">io</span>
          </span>

          <p className="text-[9px] font-black tracking-[0.2em] text-slate-400 mt-2">
            Your Monitoring Platform Solution
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 text-rose-600 text-xs font-bold rounded-xl border border-rose-100 flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
            <div className="relative mt-1.5">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                required
                type="email"
                className="w-full p-4 pl-12 bg-slate-50 border-none rounded-2xl text-sm outline-none focus:ring-2 ring-blue-100 text-slate-800 font-sans"
                placeholder="name@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
            <div className="relative mt-1.5">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                required
                type="password"
                className="w-full p-4 pl-12 bg-slate-50 border-none rounded-2xl text-sm outline-none focus:ring-2 ring-blue-100 text-slate-800 font-sans"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {/* LINK FORGOT PASSWORD */}
            <div className="flex justify-end mt-2">
              <Link
                href="/reset-password"
                className="text-[13px] font-black text-blue-600 hover:underline tracking-widest"
              >
                Forgot Password?
              </Link>
            </div>
          </div>

          <button
            disabled={isLoading}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
          >
            {isLoading ? "Memproses..." : "Login"}
          </button>
        </form>

         <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 text-center mt-6">
            <p className="text-sm text-gray-500">
              Don't have an account?{" "}
            <Link href="/register" className="text-[15px] font-black text-blue-600 hover:underline tracking-widest">
               Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}