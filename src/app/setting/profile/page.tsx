"use client";

import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import { User, ShieldCheck, Building2 } from "lucide-react";

function getInitials(name?: string) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase();
}

export default function ProfilePage() {
  const { user } = useAuth();

  if (!user) return null;

  const initials = getInitials(user.name);
  const isActive = user.status === "active";

  return (
    <div className="w-full space-y-7">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Profil Akun</h1>
          <p className="text-sm text-muted-foreground">
            Informasi akun yang sedang digunakan untuk mengakses sistem.
          </p>
        </div>
      </div>

      {/* Main Card */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-4 p-5 border-b bg-muted/30">
          {/* Avatar */}
          <div className="relative">
            <div className="h-14 w-14 rounded-2xl border bg-background flex items-center justify-center font-semibold">
              {initials}
            </div>
          </div>
          {/* Name + meta */}
          <div className="min-w-0">
            <p className="text-lg font-semibold truncate">{user.name}</p>
            <p className="text-sm text-muted-foreground truncate">
              {user.unit_name ? user.unit_name : "Unit kerja belum ditetapkan"}
            </p>
          </div>
          {/* Status badge */}
          <div className="ml-auto">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-5 py-1 text-xs font-medium",
                isActive
                  ? "border-emerald-500/20 bg-cyan-500/10 text-emerald-600"
                  : "border-red-500/20 bg-red-500/10 text-red-600"
              )}>
              <span
                className={cn(
                  "h-6 w-7 rounded-full",
                  isActive ? "bg-emerald-500" : "bg-red-500"
                )}
              />
              {isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Nama (ringkas, tapi tetap ada) */}
            <div className="rounded-xl border p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <User className="h-4 w-4 text-muted-foreground" />
                Nama
              </div>
              <p className="mt-2 text-base font-semibold">{user.name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Nama pengguna sesuai data master user.
              </p>
            </div>
            
            {/* Role */}
            <div className="rounded-xl border p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                Jabatan
              </div>
              <p className="mt-2 text-base font-semibold">{user.role_name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Hak akses ditentukan berdasarkan akun.
              </p>
            </div>

            {/* Unit */}
            <div className="rounded-xl border p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Unit Kerja
              </div>
              <p className="mt-2 text-base font-semibold">
                {user.unit_name ? user.unit_name : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Unit kerja digunakan untuk pembatasan data sesuai organisasi.
              </p>
            </div>

            {/* Status */}
            <div className="rounded-xl border p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <User className="h-4 w-4 text-muted-foreground" />
                Status Akun
              </div>
              <p className="mt-2 text-base font-semibold">
                {isActive ? "Active" : "Inactive"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Jika akun inactive, akses fitur dapat dibatasi.
              </p>
            </div>
          </div>

          {/* Note */}
          <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
            Jika ada data profil yang tidak sesuai (nama/unit), silakan hubungi Admin
            untuk pembaruan data master pengguna.
          </div>
        </div>
      </div>
    </div>
  );
}
