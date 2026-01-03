"use client";

import { useAuth } from "@/context/auth-context";
import { SidebarProvider, Sidebar, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import GlobalLoading from "@/components/common/GlobalLoading";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

const publicRoutes = ["/login", "/register"];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isReady } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  if (publicRoutes.includes(pathname)) {
    return <>{children}</>;
  }

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      router.replace("/login"); // replace supaya tidak bisa back ke halaman private
    }
  }, [isReady, user, router]);

  if (!isReady) return <GlobalLoading />;
  
  if (!user) return <GlobalLoading />;

  return (
    <SidebarProvider>
      <div className="flex h-screen w-screen overflow-hidden">
        <Sidebar className="flex-shrink-0 z-10">
          <AppSidebar />
        </Sidebar>

        <SidebarInset className="flex flex-1 flex-col bg-gray-50 overflow-hidden">
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
