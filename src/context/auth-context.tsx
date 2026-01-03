"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import type { User, UserPermissions } from "@/types/user";

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isReady: boolean;
  login: (user_id: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizePermissions(p: any): UserPermissions {
  return {
    can_create: !!p?.can_create,
    can_read: !!p?.can_read,
    can_view: !!p?.can_view,
    can_update: !!p?.can_update,
    can_approve: !!p?.can_approve,
    can_delete: !!p?.can_delete,
    can_provision: !!p?.can_provision,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();

  // Ambil session aktif (user) dari server via cookie
  const fetchSession = useCallback(async () => {
    const res = await fetch("http://localhost:5000/me", {
      method: "GET",
      credentials: "include",
      cache: "no-store", // ✅ penting biar gak 304 / cache
    });

    if (!res.ok) {
      setUser(null);
      return;
    }

    const data = await res.json();
    const permissions = normalizePermissions(data.permissions);

    setUser({ ...data, permissions });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await fetchSession();
      } catch (err) {
        console.error("❌ Gagal ambil sesi user:", err);
        setUser(null);
      } finally {
        setIsReady(true);
      }
    })();
  }, [fetchSession]);

  // 🔹 Login → server set cookie, lalu refresh session dari /me (source of truth)
  const login = async (user_id: string, password: string) => {
    try {
      const res = await fetch("http://localhost:5000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ user_id, password }),
      });

      if (!res.ok) return false;

      // ✅ jangan pakai response login sebagai sumber user utama
      // biar konsisten, langsung tarik /me
      await fetchSession();

      return true;
    } catch (err) {
      console.error("❌ Login error:", err);
      return false;
    }
  };

  // Logout → server hapus cookie
  const logout = useCallback(async () => {
    try {
      await fetch("http://localhost:5000/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setUser(null);
      router.push("/login");
    }
  }, [router]);

  // ✅ expose agar komponen lain bisa refresh permission kalau dibutuhkan
  const refreshSession = useCallback(async () => {
    try {
      await fetchSession();
    } catch (e) {
      console.error("refreshSession error:", e);
    }
  }, [fetchSession]);

  // fetchWithAuth → semua request pakai cookie otomatis
  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers || {});
    // hanya set json kalau body bukan FormData
    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
    if (!headers.has("Content-Type") && !isFormData) {
      headers.set("Content-Type", "application/json");
    }

    return fetch(url, {
      ...options,
      credentials: "include",
      cache: "no-store",
      headers,
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isReady,
        login,
        logout,
        refreshSession,
        fetchWithAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
