"use client";

import { Users, Shield, Crown, FileText } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";

export default function SettingPage() {
  const { logout } = useAuth();
  const router = useRouter();

  const menus = [
    {
      icon: <Users size={50} className="text-indigo-600" />,
      label: "Users",
      path: "/setting/user",
    },
    // {
    //   icon: <Shield size={50} className="text-indigo-600" />,
    //   label: "Account",
    //   path: "/setting/account",
    // },
    // {
    //   icon: <Crown size={50} className="text-yellow-500" />,
    //   label: "Plans & Billings",
    //   path: "/setting/plans",
    // },
    // {
    //   icon: <FileText size={50} className="text-indigo-600" />,
    //   label: "Audit Log",
    //   path: "/setting/audit",
    // },
  ];

  return (
    <div className="p-8 w-full min-h-screen bg-gray-50">
      <h1 className="text-2xl font-bold mb-8 text-gray-800">Admin Control Management System</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {menus.map((menu, idx) => (
          <div
            key={idx}
            onClick={() => router.push(menu.path)}
            className="flex flex-col items-center justify-center bg-white border rounded-2xl shadow-md hover:shadow-lg cursor-pointer transition transform hover:-translate-y-1 p-10"
          >
            {menu.icon}
            <p className="mt-4 font-semibold text-gray-700 text-lg">
              {menu.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
