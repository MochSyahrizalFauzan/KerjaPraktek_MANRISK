"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!user.permissions?.can_provision) {
      router.replace("/rcsa"); // atau halaman user utama
    }
  }, [isReady, user, router]);

  if (!isReady) return null;
  if (!user) return null;
  if (!user.permissions?.can_provision) return null;

  return <>{children}</>;
}
