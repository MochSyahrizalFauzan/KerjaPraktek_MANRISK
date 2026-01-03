"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// Card tidak diperlukan di dalam DialogContent, saya hapus penggunaannya di bawah

const userSchema = z.object({
  user_id: z.string().min(3, "User ID wajib diisi"),
  name: z.string().min(3, "Nama wajib diisi"),
  email: z
    .string()
    .email("Email tidak valid")
    .optional()
    .or(z.literal("")),
  password: z.string().min(6, "Password minimal 6 karakter"),
  role_id: z.string().min(1, "Pilih role pengguna"),
  unit_id: z.string().min(1, "Pilih unit pengguna"),
  status: z.enum(["active", "inactive"]),
});

type UserFormData = z.infer<typeof userSchema>;

interface AddUserDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void; // reload user list after success
}

export default function AddUserDialog({
  open,
  onClose,
  onSuccess,
}: AddUserDialogProps) {
  const [roles, setRoles] = useState<{ id: number; role_name: string }[]>([]);
  const [units, setUnits] = useState<{ id: number; unit_name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: { status: "active" },
  });

  // Load roles & units (Logika fetch data tetap sama)
  useEffect(() => {
    if (!open) return;

    async function fetchOptions() {
      try {
        const [rolesRes, unitsRes] = await Promise.all([
          fetch("http://localhost:5000/roles"),
          fetch("http://localhost:5000/units"),
        ]);

        const [rolesData, unitsData] = await Promise.all([
          rolesRes.json(),
          unitsRes.json(),
        ]);

        setRoles(rolesData);
        setUnits(unitsData);
      } catch (error) {
        console.error("Gagal memuat data roles/units", error);
      }
    }

    fetchOptions();
  }, [open]);

  const onSubmit = async (data: UserFormData) => {
  try {
    setLoading(true);

    // Hapus email kosong biar tidak dikirim "null" string
    if (!data.email) delete (data as any).email;

    const payload = {
      user_id: data.user_id,
      name: data.name,                
      email: data.email || null,      
      password: data.password,
      role_id: data.role_id,
      unit_id: data.unit_id === "NULL_UNIT" ? null : data.unit_id, // optional
      status: data.status || "active"
    };

    const res = await fetch("http://localhost:5000/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("Gagal menambah user");
    onSuccess();
    reset();
    onClose();
  } catch (err) {
    console.error("Error saat tambah user:", err);
    alert("Gagal menambah user.");
  } finally {
    setLoading(false);
  }
};



  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-8 sm:p-10">
        {" "}
        {/* LEBARKAN POP-UP */}
        {/* Header yang Lebih Berkesan */}
        <DialogHeader className="pb-4 border-b border-gray-200">
          <DialogTitle className="text-2xl font-bold text-gray-800">
            Tambah Pengguna Baru
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Form Utama - Menggunakan Grid 2 Kolom */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            {/* Kolom 1 */}
            <div className="space-y-6">
              {/* User ID */}
              <div>
                <Label htmlFor="user_id" className="mb-1 block font-semibold">
                  User ID
                </Label>
                <Input
                  id="user_id"
                  {...register("user_id")}
                  placeholder="Contoh: U001"
                />
                {errors.user_id && (
                  <p className="text-sm text-red-500 mt-1">
                    {errors.user_id.message}
                  </p>
                )}
              </div>

              {/* Nama */}
              <div>
                <Label htmlFor="name" className="mb-1 block font-semibold">
                  Nama Lengkap
                </Label>
                <Input
                  id="name"
                  {...register("name")}
                  placeholder="Nama lengkap"
                />
                {errors.name && (
                  <p className="text-sm text-red-500 mt-1">
                    {errors.name.message}
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <Label htmlFor="email" className="mb-1 block font-semibold">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  {...register("email")}
                  placeholder="Opsional"
                />
                {errors.email && (
                  <p className="text-sm text-red-500 mt-1">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <Label htmlFor="password" className="mb-1 block font-semibold">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  {...register("password")}
                  placeholder="****** (Minimal 6 karakter)"
                />
                {errors.password && (
                  <p className="text-sm text-red-500 mt-1">
                    {errors.password.message}
                  </p>
                )}
              </div>
            </div>

            {/* Kolom 2 */}
            <div className="space-y-6">
              {/* Role */}
              <div>
                <Label htmlFor="role_id" className="mb-1 block font-semibold">
                  Role
                </Label>
                {/* Beri defaultValue="" untuk menghindari error pada Shadcn Select, tapi jangan berikan item kosong */}
                <Select
                  onValueChange={(v) => setValue("role_id", v)}
                  defaultValue=""
                >
                  <SelectTrigger id="role_id">
                    <SelectValue placeholder="Pilih Role Pengguna" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Tambahkan pengecekan jika roles kosong, tampilkan item loading yang disabled */}
                    {roles.length === 0 && (
                      <SelectItem value="loading-roles" disabled>
                        Memuat roles...
                      </SelectItem>
                    )}
                    {roles.map((r) => (
                      // PASTIKAN NILAI 'value' TIDAK PERNAH STRING KOSONG
                      <SelectItem key={r.id} value={r.id.toString()}>
                        {r.role_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.role_id && (
                  <p className="text-sm text-red-500 mt-1">
                    {errors.role_id.message}
                  </p>
                )}
              </div>

              {/* Units */}
              <div>
                <Label htmlFor="unit_id" className="mb-1 block font-semibold">
                  Unit (Opsional)
                </Label>
                <Select
                  onValueChange={(v) => setValue("unit_id", v)}
                  defaultValue=""
                >
                  <SelectTrigger id="unit_id">
                    <SelectValue placeholder="Pilih Unit (opsional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Tambahkan item 'null/none' yang memiliki value yang jelas, misalnya "NULL_UNIT" */}
                    <SelectItem value="NULL_UNIT">Tidak Ada Unit</SelectItem>
                    {units.length === 0 && (
                      <SelectItem value="loading-units" disabled>
                        Memuat units...
                      </SelectItem>
                    )}
                    {units.map((u) => (
                      // PASTIKAN NILAI 'value' TIDAK PERNAH STRING KOSONG
                      <SelectItem key={u.id} value={u.id.toString()}>
                        {u.unit_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div>
                <Label htmlFor="status" className="mb-1 block font-semibold">
                  Status
                </Label>
                <Select
                  onValueChange={(v) =>
                    setValue("status", v as "active" | "inactive")
                  }
                  defaultValue="active"
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Pilih Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">✅ Active</SelectItem>
                    <SelectItem value="inactive">🚫 Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="pt-4 border-t border-gray-100">
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan Pengguna"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
