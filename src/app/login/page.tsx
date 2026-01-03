"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { User, Lock, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import Image from "next/image";


export default function LoginPage() {
  const { login } = useAuth();
  const [user_id, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const ok = await login(user_id, password);
    if (ok) {
      router.push("/rcsa");
    } else {
      setError("ID USER atau PASSWORD salah");
    }

    setLoading(false);
  };


  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center relative p-4 sm:p-8 overflow-hidden" // Added overflow-hidden
      style={{ backgroundImage: "url('/images/Sign_bg.jpg')" }}
    >
      {/* Overlay dengan gradien dan blur lebih dalam */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/60 to-black/30 backdrop-blur-sm" />

      {/* Konten Utama */}
      <div className="relative z-10 flex flex-col md:flex-row w-full max-w-7xl items-center justify-around gap-12 lg:gap-24 px-4 sm:px-0"> {/* Adjusted justify-around and added px */}
        {/* Konten Kiri: Logo dan Deskripsi */}
        <motion.div
          initial={{ opacity: 0, x: -80 }} // Pindah lebih jauh ke kiri
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, ease: "easeOut" }} // Animasi lebih lama
          className="flex flex-col items-center md:items-start text-white text-center md:text-left drop-shadow-lg max-w-sm sm:max-w-md lg:max-w-lg"
        >
          <motion.div whileHover={{ scale: 1.05 }} className="cursor-pointer mb-4">
            <Image
              src="/images/logo_bjbs.png"
              alt="Bank BJB Syariah"
              width={480} // Ukuran logo sedikit lebih besar
              height={150} // Tinggi menyesuaikan
              priority
              className="select-none filter drop-shadow-lg" // Efek shadow pada logo
            />
          </motion.div>
          <h3 className="mt-6 text-3xl font-bold leading-tight tracking-wide text-white"> {/* Font lebih besar dan bold */}
            SISTEM INFORMASI RCSA
          </h3>
          <h4 className="mt-2 text-xl font-medium text-blue-100/90"> {/* Warna sedikit berbeda */}
            DIVISI MANAJEMEN RISIKO
          </h4>
        </motion.div>

        {/* Card Login */}
        <motion.div
          initial={{ opacity: 0, y: 50 }} // Pindah lebih jauh ke bawah
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }} // Animasi lebih lama dan delay
          className="bg-white/95 backdrop-blur-xl rounded-[2rem] shadow-3xl border border-blue-200 p-8 sm:p-10 w-full max-w-md transform transition-all duration-300 hover:shadow-blue-500/30 hover:scale-[1.01]" // Shadow dan border lebih elegan, hover effect
        >
          {/* Judul & Deskripsi */}
          <h2 className="text-4xl font-extrabold mb-2 text-center text-gray-800 tracking-tight">
            Selamat Datang
          </h2>
          <p className="text-center text-gray-500 mb-10 text-md"> {/* Font lebih besar */}
            Silakan masuk ke akun Anda
          </p>

          {/* Error */}
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-100 text-red-700 px-4 py-3 rounded-lg text-sm text-center font-medium mb-6 animate-pulse" // Added animate-pulse
            >
              {error}
            </motion.p>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative">
              <User className="absolute left-5 top-1/2 -translate-y-1/2 text-blue-400" size={20} /> {/* Icon warna biru */}
              <input
                type="text"
                placeholder="User ID"
                className="w-full rounded-full bg-blue-50 border border-blue-200 py-3.5 pl-14 pr-5 text-base text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition shadow-sm" // Warna input lebih cerah
                value={user_id}
                onChange={(e) => setUserId(e.target.value)}
                required
                autoComplete="Username"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-blue-400" size={20} /> {/* Icon warna biru */}
              <input
                type="password"
                placeholder="Password"
                className="w-full rounded-full bg-blue-50 border border-blue-200 py-3.5 pl-14 pr-5 text-base text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition shadow-sm" // Warna input lebih cerah
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <motion.button
              whileHover={{ scale: 1.05, boxShadow: "0 0 25px rgba(59, 130, 246, 0.7)" }} // Efek glow lebih kuat
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-4 rounded-full border border-blue-700 shadow-xl hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed transition font-semibold text-lg uppercase tracking-wide" // Shadow lebih kuat, text uppercase
            >
              {loading ? "Signing in..." : "Sign In"}
              {!loading && <ArrowRight size={20} />}
            </motion.button>
          </form>

          <div className="mt-8 text-sm text-center">
            <a href="/forgot-password" className="text-blue-600 hover:text-blue-800 hover:underline transition font-medium"> {/* Warna text link */}
              Lupa Kata Sandi?
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
}