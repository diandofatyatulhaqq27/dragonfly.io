"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const savedUser = localStorage.getItem("iiot_user");
    if (savedUser) {
      router.replace("/dashboard");
    } else {
      router.replace("/login");
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
    </div>
  );
}