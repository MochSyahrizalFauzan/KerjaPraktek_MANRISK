"use client";

import { useEffect } from "react";
import NProgress from "nprogress";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import AppLayout from "@/components/layout/app-layout";
import GlobalLoading from "@/components/common/GlobalLoading";

const publicRoutes = ["/login", "/register"];

export default function LayoutContent({ children }: { children: React.ReactNode }) {
  const { isReady } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    NProgress.start();
    const timer = setTimeout(() => NProgress.done(), 300);
    return () => clearTimeout(timer);
  }, [pathname]);

  if (publicRoutes.includes(pathname)) {
    return <>{children}</>;
  }

  if (!isReady) return <GlobalLoading />;

  return <AppLayout>{children}</AppLayout>;
}
