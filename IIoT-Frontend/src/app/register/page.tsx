"use client";
import React, { useState } from 'react';
import { Loader2, AlertCircle, ShieldCheck, ArrowLeft, Clock } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import myLogo from '@/assets/logodragonfly2.png';

export default function RegisterPage() {
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    invitationCode: '',
    password: '',
    confirmPassword: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (errorMsg) setErrorMsg("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setErrorMsg("Password confirmation doesn't match.");
      return;
    }

    setIsLoading(true);
    setErrorMsg("");

    const cleanInvitationCode = formData.invitationCode.trim().toUpperCase();

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          password: formData.password,
          invitation_code: cleanInvitationCode
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSubmitted(true);
      } else {
        setErrorMsg(result.detail || "Failed to create account.");
      }
    } catch (error) {
      setErrorMsg("Could not reach the server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── SUCCESS STATE ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="w-full max-w-[360px] bg-white rounded-xl border border-gray-200 shadow-lg p-8 text-center">
          <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <Clock className="w-7 h-7 text-amber-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Registration Submitted</h2>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            Your account is pending approval. Please contact your administrator to activate access.
          </p>
          <Link
            href="/login"
            className="mt-6 block w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  // ── MAIN FORM ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-[400px]">

        {/* Back to login */}
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to login
        </Link>

        <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">

          {/* Header */}
          <div className="px-6 pt-6 pb-5 border-b border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0">
                <Image src={myLogo} alt="Logo" fill className="object-cover" priority />
              </div>
              <span
                className="text-lg tracking-tighter text-slate-900 leading-none antialiased"
                style={{ fontFamily: '"Arial Black", "Impact", sans-serif', fontWeight: 900 }}
              >
                Dragonfly<span className="text-zinc-400">.</span>
                <span className="text-blue-600">io</span>
              </span>
            </div>
            <h1 className="text-base font-semibold text-gray-900">Create an account</h1>
            <p className="text-sm text-gray-500 mt-0.5">Enter your details to request access</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

            {errorMsg && (
              <div className="flex items-center gap-2.5 p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-lg text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {errorMsg}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Full Name</label>
              <input
                required
                name="name"
                value={formData.name}
                placeholder="John Doe"
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-gray-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Work Email</label>
              <input
                required
                name="email"
                type="email"
                value={formData.email}
                placeholder="you@company.com"
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-gray-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                Invitation Code
              </label>
              <input
                required
                name="invitationCode"
                type="text"
                value={formData.invitationCode}
                placeholder="Enter your invite code"
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 font-mono tracking-widest outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:font-sans placeholder:tracking-normal uppercase"
              />
              <p className="text-xs text-gray-400">
                Only for personnel with a valid company invitation code.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Password</label>
                <input
                  required
                  name="password"
                  type="password"
                  value={formData.password}
                  placeholder="••••••••"
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Confirm</label>
                <input
                  required
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  placeholder="••••••••"
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 mt-1"
            >
              {isLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</>
                : "Request Access"
              }
            </button>

          </form>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">
              Already have an account?{" "}
              <Link href="/login" className="text-blue-600 hover:underline font-medium">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}