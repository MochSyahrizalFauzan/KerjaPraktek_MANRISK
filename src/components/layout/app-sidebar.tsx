"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarFooter,
} from "@/components/ui/sidebar";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import {
  LayoutDashboard,
  User,
  ShieldAlert,
  ServerCog,
  FileText,
  ChevronDown,
  LogOut,
  Shield,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

type PermKey =
  | "can_create"
  | "can_read"
  | "can_view"
  | "can_update"
  | "can_approve"
  | "can_delete"
  | "can_provision";

type SubMenuItem = {
  name: string;
  href: string;
  icon?: LucideIcon;
  permKey?: PermKey;
};

type MenuItem = {
  icon: LucideIcon;
  title: string;
  href?: string;
  submenu?: SubMenuItem[];
  permKey?: PermKey;
};

function NavItemWithSubmenu({
  icon: Icon,
  title,
  submenu,
}: {
  icon: LucideIcon;
  title: string;
  submenu: SubMenuItem[];
}) {
  const pathname = usePathname();

  const isAnySubmenuActive = submenu.some(
    (item) =>
      item.href !== "#" &&
      (pathname === item.href || pathname.startsWith(item.href + "/"))
  );

  const [isOpen, setIsOpen] = useState(isAnySubmenuActive);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => setIsClient(true), []);

  useEffect(() => {
    if (isClient) setIsOpen(isAnySubmenuActive);
  }, [isAnySubmenuActive, isClient]);

  if (!isClient) {
    return (
      <SidebarMenuButton
        className="justify-between w-full"
        isActive={isAnySubmenuActive}
      >
        <div className="flex items-center gap-2">
          <Icon />
          <span>{title}</span>
        </div>
        <ChevronDown className="h-4 w-4" />
      </SidebarMenuButton>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <SidebarMenuButton
          className="justify-between w-full"
          isActive={isAnySubmenuActive}
        >
          <div className="flex items-center gap-2">
            <Icon />
            <span>{title}</span>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </SidebarMenuButton>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <SidebarMenuSub>
          {submenu.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");

            const SubIcon = item.icon;

            return (
              <SidebarMenuSubItem key={item.name}>
                <SidebarMenuSubButton asChild isActive={isActive}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-2 whitespace-normal h-auto"
                  >
                    {SubIcon && (
                      <SubIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>{item.name}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            );
          })}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  );
}

function NavItem({ item }: { item: MenuItem }) {
  const { icon: Icon, title, submenu, href } = item;
  const pathname = usePathname();

  if (submenu) {
    return <NavItemWithSubmenu icon={Icon} title={title} submenu={submenu} />;
  }

  const isActive = !!href && (pathname === href || pathname.startsWith(href + "/"));

  return (
    <SidebarMenuButton asChild isActive={isActive}>
      <Link href={href || "#"}>
        <Icon />
        <span>{title}</span>
      </Link>
    </SidebarMenuButton>
  );
}

export function AppSidebar() {
  const { user, logout, isReady } = useAuth();
  const [showConfirm, setShowConfirm] = useState(false);
  const [collapsed] = useState(false);
  const pathname = usePathname();

  if (!isReady) return null;

  // ===== RBAC (BERDASARKAN PERMISSIONS DARI /me) =====
  const perms = user?.permissions || ({} as Record<string, any>);

  const hasPerm = (key?: PermKey) => {
    if (!key) return true;
    return !!perms?.[key];
  };

  const isAdminPanelAllowed = hasPerm("can_provision");
  const canApprove = hasPerm("can_approve");

  // ===== MENU USER (PIC / Unit Staff / Unit Supervisor / Staff) =====
  // Admin juga tetap boleh lihat menu user
  const userNavItems: MenuItem[] = useMemo(() => {
    const items: MenuItem[] = [
      { icon: FileText, title: "Risk Control Self-Assessment", href: "/rcsa" },
    ];

    if (canApprove) {
      items.push({ icon: FileText, title: "Review RCSA", href: "/rcsa-review" });
    }

    return items;
  }, [canApprove]);

  // ===== MENU ADMIN PANEL =====
  const adminNavItems: MenuItem[] = useMemo(() => {
    const items: MenuItem[] = [
      {
        icon: LayoutDashboard,
        title: "RCSA",
        submenu: [
          { icon: Shield, name: "Kelola Master RCSA", href: "/admin/rcsa-management", permKey: "can_provision" },
          { icon: ShieldAlert, name: "Approval Master RCSA", href: "/admin/rcsa-master-approval", permKey: "can_approve" },
          { icon: FileText, name: "Review RCSA", href: "/admin/rcsa-review", permKey: "can_approve" },
          { icon: FileText, name: "Laporan RCSA", href: "/admin/rcsa-report", permKey: "can_read" },
        ],
      },
      { icon: ServerCog, title: "Management", href: "/setting", permKey: "can_provision" },
    ];

    // Filter berdasarkan permKey
    return items
      .filter((it) => hasPerm(it.permKey))
      .map((it) => {
        if (!it.submenu) return it;
        const filteredSub = it.submenu.filter((s) => hasPerm(s.permKey));
        return { ...it, submenu: filteredSub };
      })
      .filter((it) => !it.submenu || it.submenu.length > 0);
  }, [perms]); // perms berubah -> menu berubah

  const displayName =
    user?.name ||
    user?.user_id ||
    (user?.email ? user.email.split("@")[0] : "Profile");

  const handleLogout = () => {
    logout();
    setShowConfirm(false);
  };

  return (
    <>
      <Sidebar collapsible="icon">
        <div className="flex h-full flex-col">
          <SidebarHeader className="p-4 border-b border-sidebar-border">
            <Link
              href="#"
              className="flex items-center gap-3 text-sidebar-foreground transition-all"
            >
              <div
                className={cn(
                  "flex items-center justify-center rounded-xl bg-white/4 ring-2 ring-white/4 shadow-sm transition-all duration-300",
                  collapsed ? "h-14 w-14" : "h-16 w-16"
                )}
              >
                <img
                  src="/images/logo_bjbs.png"
                  alt="SMART Logo"
                  className={cn(
                    "object-contain transition-all duration-300",
                    collapsed ? "h-11 w-11" : "h-13 w-12"
                  )}
                />
              </div>

              {!collapsed && (
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-semibold tracking-wide">RCSA</span>
                  <span className="text-xs text-sidebar-foreground/70">
                    Management System
                  </span>
                </div>
              )}
            </Link>
          </SidebarHeader>

          <SidebarContent>
            <SidebarMenu>
              {/* USER SIDE: selalu tampil untuk semua role */}
              {userNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <NavItem item={item} />
                </SidebarMenuItem>
              ))}

              {/* ADMIN PANEL: hanya jika can_provision */}
              {isAdminPanelAllowed && (
                <>
                  <div className="p-2 pt-4">
                    <motion.h4
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{
                        opacity: collapsed ? 0 : 1,
                        scale: collapsed ? 0.8 : 1,
                      }}
                      transition={{ duration: 0.2 }}
                      className="text-xs font-semibold text-gray-400 uppercase tracking-widest pl-2"
                    >
                      Admin Control Panel
                    </motion.h4>
                  </div>

                  {adminNavItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <NavItem item={item} />
                    </SidebarMenuItem>
                  ))}
                </>
              )}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter>
            <SidebarMenu>
              {/* PROFILE */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/setting/profile"}>
                  <Link href="/setting/profile">
                    <User />
                    <span className="truncate">{displayName}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* LOGOUT */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setShowConfirm(true)}
                  className="text-red-500 hover:text-red-700"
                >
                  <LogOut />
                  <span>Logout</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </div>
      </Sidebar>

      {/* Modal Konfirmasi Logout */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Logout</DialogTitle>
          </DialogHeader>
          <p>Apakah Anda yakin ingin logout?</p>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              Ya, Logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
