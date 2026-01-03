"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { fetchUsersWithAuth } from "@/lib/user";
import { User } from "@/types/user";

import UserTable from "@/components/admin/setting/Users/user-manag";
import UserLoginHistory from "@/components/admin/setting/Users/user-history";
import UserRolePermission from '@/components/admin/setting/Users/user-RP';

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

type UserLogin = {
  id: number;
  user_id: number;
  user_name: string;
  login_time: string;
  logout_time: string | null;
  ip_address: string;
  user_agent: string;
  role_name: string;
  unit_name: string;
};

export default function UserSettingPage() {
  const { fetchWithAuth, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("users");
  const [users, setUsers] = useState<User[]>([]);
  const [userLogins, setUserLogins] = useState<UserLogin[]>([]);
  const [loading, setLoading] = useState(true);

  // Ambil data user + user_logins
  useEffect(() => {
    const loadData = async () => {
      try {
        const [userData, logData] = await Promise.all([
          fetchUsersWithAuth(fetchWithAuth),
          fetchUserLogins(fetchWithAuth),
        ]);
        setUsers(userData);
        setUserLogins(logData);
      } catch (err: any) {
        console.error("Gagal memuat data:", err);
        if (err.message?.includes("Token")) {
          alert("Sesi Anda telah berakhir. Silakan login kembali.");
          logout();
        }
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [fetchWithAuth, logout]);

  if (loading) {
    return <p className="p-6 text-gray-600">⏳ Memuat data...</p>;
  }

  return (
    <div className="p-8 lg:p-12 w-full">
      {/* Container Utama untuk Header & Tombol yang Sejajar */}
      <div className="flex justify-between items-start mb-8 w-full">
        
        {/* Kolom Kiri: Header & Deskripsi */}
        <div>
          <h1 className="text-3xl font-bold">RBAC Admin Settings</h1>
          <p className="text-gray-500 text-lg mt-1">
            Kelola pengguna, Aktivitas pengguna, dan izin untuk Sistem Informasi SMART bjb Syariah
          </p>
        </div>

        <Button
          onClick={() => router.push("/setting")}>
          <ArrowLeft size={18} className="mr-1" />
          Kembali
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8 w-full mx-auto">
        <TabsList className="bg-white border border-gray-200 rounded-lg p-1 flex shadow-md overflow-hidden">
          <TabsTrigger
            value="users"
            className="flex-1 px-4 py-2 text-sm font-semibold text-gray-600 transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:rounded-[5px] data-[state=active]:translate-y-0 hover:text-primary-dark">
            Users
          </TabsTrigger>
          <TabsTrigger
            value="login_history"
            className="flex-1 px-4 py-2 text-sm font-semibold text-gray-600 transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:rounded-[5px] data-[state=active]:translate-y-0 hover:text-primary-dark">
            Login History
          </TabsTrigger>
          <TabsTrigger
            value="roles_permission"
            className="flex-1 px-4 py-2 text-sm font-semibold text-gray-600 transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:rounded-[5px] data-[state=active]:shadow-lg data-[state=active]:translate-y-0 hover:text-primary-dark">
            Roles & Permissions
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* PANGGIL KOMPONENT IEU teh */}
      {activeTab === "users" && <UserTable users={users} />}
      {activeTab === "login_history" && <UserLoginHistory userLogins={userLogins} />}
      {activeTab === "roles_permission" && <UserRolePermission />}

    </div>
  );
}

/*  Fungsi bantu */
async function fetchUserLogins(fetchWithAuth: any) {
  const res = await fetchWithAuth("http://localhost:5000/user-logins");
  if (!res.ok) throw new Error("Gagal mengambil data user_logins");
  return res.json();
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleString("id-ID", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
