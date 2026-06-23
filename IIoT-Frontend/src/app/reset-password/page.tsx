"use client";
import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { KeyRound, Loader2, CheckCircle2, Mail, ArrowLeft, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import myLogo from '@/assets/logodragonfly2.png';

// ── STEP 1: User isi email ────────────────────────────────────────────────────
function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json();
        setError(data.detail || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="w-full max-w-[360px] bg-white rounded-xl border border-gray-200 shadow-lg p-8 text-center">
          <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <Mail className="w-7 h-7 text-blue-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Check your email</h2>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            We sent a password reset link to <strong className="text-gray-700">{email}</strong>.
            The link expires in 15 minutes.
          </p>
          <p className="text-xs text-gray-400 mt-4">
            Didn't receive it? Check your spam folder or{" "}
            <button
              onClick={() => setSent(false)}
              className="text-blue-600 hover:underline border-none bg-transparent cursor-pointer p-0"
            >
              try again
            </button>.
          </p>
          <Link
            href="/login"
            className="mt-6 block w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors text-center"
          >
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-[360px]">
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
            <h1 className="text-base font-semibold text-gray-900">Forgot your password?</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Enter your email and we'll send you a reset link.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {error && (
              <div className="flex items-center gap-2.5 p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-lg text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-gray-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending link...</>
                : <><Mail className="w-4 h-4" /> Send Reset Link</>
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── STEP 2: User set password baru (dari link email, ada ?token=...) ──────────
function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${baseUrl}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          new_password: newPassword,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setIsSuccess(true);
      } else {
        setError(data.detail || "Failed to reset password. The link may have expired.");
      }
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="w-full max-w-[360px] bg-white rounded-xl border border-gray-200 shadow-lg p-8 text-center">
          <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-7 h-7 text-emerald-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Password Updated</h2>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            Your password has been successfully reset. You can now sign in with your new password.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="mt-6 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer border-none"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-[360px]">
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
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-blue-600" />
              <h1 className="text-base font-semibold text-gray-900">Set new password</h1>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              Choose a strong password for your account.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {error && (
              <div className="flex items-center gap-2.5 p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-lg text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">New Password</label>
              <input
                required
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Confirm Password</label>
              <input
                required
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !token}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 border-none cursor-pointer"
            >
              {isLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</>
                : "Update Password"
              }
            </button>
          </form>
        </div>

        <p className="text-center mt-4 text-xs text-gray-400">
          Link expired?{" "}
          <Link href="/reset-password" className="text-blue-600 hover:underline">
            Request a new one
          </Link>
        </p>
      </div>
    </div>
  );
}

// ── ROUTER: deteksi ada token atau tidak ──────────────────────────────────────
function ResetPasswordRouter() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  if (token) {
    return <ResetPasswordForm token={token} />;
  }

  return <ForgotPasswordForm />;
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ResetPasswordRouter />
    </Suspense>
  );
}