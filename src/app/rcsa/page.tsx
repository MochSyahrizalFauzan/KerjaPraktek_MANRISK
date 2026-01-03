"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  submitRcsaAssessment,
  type RCSAData,
  getRcsaDraft,
  mapToAssessment,
  saveRcsaAssessment,
} from "@/lib/rcsa-data";
import { useToast } from "@/hooks/use-toast";
import { Save, Send, Info, ChevronLeft, ChevronRight } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/context/auth-context";
import { RiskTable } from "@/components/rcsa/RcsaTable";

const UNIT_API_URL = "http://localhost:5000/units";
const DEBOUNCE_MS = 800;

// Key stabil untuk row (draft awal sering belum punya id DB)
const getRowKey = (row: RCSAData) => {
  const unit = row.unit_id ?? "u";
  const master = row.rcsa_master_id ?? "m";
  return `${unit}-${master}-${row.no ?? "n"}`;
};

type RCSADataWithCalculations = RCSAData & {
  besaranInheren: number | null;
  besaranResidual: number | null;
};

export default function Rcsapage() {
  const { toast } = useToast();
  const { user } = useAuth();

  const [data, setData] = useState<RCSAData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [unitInfo, setUnitInfo] = useState<{ name: string; type: string } | null>(null);

  const [activeRiskIndex, setActiveRiskIndex] = useState(0);

  // ====== AUTOSAVE CONTROL ======
  const debounceTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const latestRowsRef = useRef<Map<string, RCSAData>>(new Map());

  const savingKeysRef = useRef<Set<string>>(new Set());
  const [savingCount, setSavingCount] = useState(0);

  const isInitialLoadRef = useRef(true);

  const autosaveToastCooldownRef = useRef<Map<string, number>>(new Map());
  const AUTOSAVE_TOAST_COOLDOWN = 3500;

  // ====== LOAD DATA ======
  useEffect(() => {
    const loadDraftAndUnit = async () => {
      if (!user) return;
      setIsLoading(true);

      try {
        const draft = await getRcsaDraft(user.id, user.unit_id!);

        const normalized = (draft as RCSAData[]).map((r, idx) => {
          const row: RCSAData = {
            ...r,
            no: r.no ?? idx + 1,
            unit_id: r.unit_id ?? user.unit_id!,
            status: (r.status ?? "draft") as const,
          };
          latestRowsRef.current.set(getRowKey(row), row);
          return row;
        });

        setData(normalized);

        const unitRes = await fetch(`${UNIT_API_URL}/${user.unit_id}`, { credentials: "include" });
        if (unitRes.ok) {
          const u = await unitRes.json();
          setUnitInfo({ name: u.unit_name, type: u.unit_type });
        }
      } catch (err) {
        console.error("Gagal memuat data awal:", err);
        toast({
          title: "Gagal memuat data",
          description: "Terjadi kesalahan saat mengambil draft RCSA atau info unit.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
        setTimeout(() => {
          isInitialLoadRef.current = false;
        }, 0);
      }
    };

    loadDraftAndUnit();
  }, [user, toast]);

  const unitName = unitInfo?.name || null;

  // ====== CALC ======
  const calculatedData: RCSADataWithCalculations[] = useMemo(() => {
    return data.map((row) => {
      const besaranInheren =
        row.dampakInheren && row.frekuensiInheren ? row.dampakInheren * row.frekuensiInheren : null;
      const besaranResidual =
        row.dampakResidual && row.kemungkinanResidual
          ? row.dampakResidual * row.kemungkinanResidual
          : null;
      return { ...row, besaranInheren, besaranResidual };
    });
  }, [data]);

  const totalRisks = calculatedData.length;
  const activeRisk = calculatedData[activeRiskIndex];

  useEffect(() => {
    if (totalRisks > 0) setActiveRiskIndex((prev) => Math.min(prev, totalRisks - 1));
    else setActiveRiskIndex(0);
  }, [totalRisks]);

  const handleNext = useCallback(() => {
    setActiveRiskIndex((prev) => Math.min(prev + 1, totalRisks - 1));
  }, [totalRisks]);

  const handlePrevious = useCallback(() => {
    setActiveRiskIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  // ====== VALIDATION ======
  const isRowComplete = useCallback((r: RCSAData) => {
    const emptyText = (v: any) => v === null || v === undefined || String(v).trim() === "";
    const emptyNum = (v: any) => v === null || v === undefined;

    return (
      !emptyText(r.jenisRisiko) &&
      !emptyText(r.penyebabRisiko) &&
      !emptyNum(r.dampakInheren) &&
      !emptyNum(r.frekuensiInheren) &&
      !emptyText(r.pengendalian) &&
      !emptyNum(r.dampakResidual) &&
      !emptyNum(r.kemungkinanResidual) &&
      !emptyText(r.actionPlan) &&
      !emptyText(r.pic)
    );
  }, []);

  // ====== UPSERT (SAVE ROW as DRAFT ONLY) ======
  const upsertRowByKey = useCallback(
    async (rowKey: string) => {
      if (!user) return;

      const row = latestRowsRef.current.get(rowKey);
      if (!row) return;

      savingKeysRef.current.add(rowKey);
      setSavingCount(savingKeysRef.current.size);

      try {
        const payload = mapToAssessment(row, user.id!, user.unit_id!);
        (payload as any).status = "draft";

        const saved = await saveRcsaAssessment(payload);

        setData((prev) =>
          prev.map((r) => {
            const k = getRowKey(r);
            if (k !== rowKey) return r;
            const merged = { ...r, id: r.id || saved.id, status: "draft" as const };
            latestRowsRef.current.set(rowKey, merged);
            return merged;
          })
        );

        const now = Date.now();
        const last = autosaveToastCooldownRef.current.get(rowKey) ?? 0;
        if (now - last > AUTOSAVE_TOAST_COOLDOWN) {
          toast({
            title: "Draft tersimpan",
            description: "Perubahan Anda disimpan otomatis.",
            duration: 1500,
          });
          autosaveToastCooldownRef.current.set(rowKey, now);
        }
      } catch (err: any) {
        console.error("Autosave gagal:", err);
        toast({
          title: "Gagal menyimpan draft",
          description: err?.message || "Periksa koneksi atau coba lagi.",
          variant: "destructive",
        });
      } finally {
        savingKeysRef.current.delete(rowKey);
        setSavingCount(savingKeysRef.current.size);
      }
    },
    [user, toast]
  );

  // ====== INPUT CHANGE + DEBOUNCE AUTOSAVE ======
  const handleInputChange = useCallback(
    (index: number, field: keyof Omit<RCSAData, "no">, value: any) => {
      if (!user) return;

      setData((prev) => {
        const next = [...prev];
        const current = next[index];
        if (!current) return prev;

        const updated: RCSAData = {
          ...current,
          [field]: value,
          status: "draft",
          unit_id: current.unit_id ?? user.unit_id!,
        };

        next[index] = updated;

        const rowKey = getRowKey(updated);
        latestRowsRef.current.set(rowKey, updated);

        // debounce autosave (skip initial load)
        if (!isInitialLoadRef.current) {
          const existing = debounceTimersRef.current.get(rowKey);
          if (existing) clearTimeout(existing);

          const t = setTimeout(() => {
            upsertRowByKey(rowKey);
          }, DEBOUNCE_MS);

          debounceTimersRef.current.set(rowKey, t);
        }

        return next;
      });
    },
    [user, upsertRowByKey]
  );

  // cleanup timers
  useEffect(() => {
    return () => {
      debounceTimersRef.current.forEach((t) => clearTimeout(t));
      debounceTimersRef.current.clear();
    };
  }, []);

  // ====== SAVE ALL (manual) ======
  const handleSaveAll = async () => {
    if (!user) return;
    if (data.length === 0) return;

    setIsSavingAll(true);
    try {
      debounceTimersRef.current.forEach((t) => clearTimeout(t));
      debounceTimersRef.current.clear();

      for (const row of data) {
        const rowKey = getRowKey(row);
        latestRowsRef.current.set(rowKey, row);
        await upsertRowByKey(rowKey);
      }

      toast({ title: "Draf berhasil disimpan ✅" });
    } catch (err) {
      console.error("Gagal simpan semua:", err);
      toast({
        title: "Gagal simpan draf",
        description: "Terjadi kesalahan saat menyimpan semua data.",
        variant: "destructive",
      });
    } finally {
      setIsSavingAll(false);
    }
  };

  // ====== SUBMIT ONE (MANUAL ONLY) ======
  const handleIndividualSubmit = async (riskId: number | string) => {
    if (!user) return;

    const row = data.find((r) => r.id === riskId);
    if (!row) {
      toast({
        title: "Data tidak ditemukan",
        description: "Row tidak ada di halaman ini.",
        variant: "destructive",
      });
      return;
    }

    const rowKey = getRowKey(row);

    if (savingKeysRef.current.has(rowKey)) {
      toast({ title: "Sedang menyimpan...", description: "Tunggu autosave selesai sebelum mengirim." });
      return;
    }

    if (!row.id) {
      toast({
        title: "Belum tersimpan",
        description: "Tunggu autosave selesai atau klik Simpan Draf dulu.",
        variant: "destructive",
      });
      return;
    }

    if (!isRowComplete(row)) {
      toast({
        title: "Data belum lengkap",
        description: "Lengkapi semua kolom wajib sebelum mengirim.",
        variant: "destructive",
      });
      return;
    }

    try {
      await submitRcsaAssessment(Number(row.id));

      setData((prev) => {
        const remaining = prev.filter((r) => r.id !== row.id);
        return remaining.map((r, idx) => ({ ...r, no: idx + 1 }));
      });

      toast({ title: "Risiko terkirim 🎉", description: "Data berhasil dikirim ke admin untuk ditinjau." });
    } catch (err: any) {
      console.error("Submit gagal:", err);
      toast({
        title: "Gagal mengirim data",
        description: err?.message || "Terjadi kesalahan saat mengirim data.",
        variant: "destructive",
      });
    }
  };

  // ====== SUBMIT ALL (MANUAL ONLY) ======
  const handleSubmitAll = async () => {
    if (!user) return;

    try {
      debounceTimersRef.current.forEach((t) => clearTimeout(t));
      debounceTimersRef.current.clear();

      if (savingKeysRef.current.size > 0) {
        toast({ title: "Sedang menyimpan...", description: "Tunggu autosave selesai sebelum mengirim semua." });
        return;
      }

      const unsaved = data.filter((r) => !r.id);
      if (unsaved.length > 0) {
        toast({
          title: "Aksi gagal",
          description: `Masih ada ${unsaved.length} item belum tersimpan. Tunggu autosave atau klik Simpan Draf.`,
          variant: "destructive",
        });
        return;
      }

      const incomplete = data.filter((r) => !isRowComplete(r));
      if (incomplete.length > 0) {
        toast({
          title: "Data belum lengkap",
          description: `Ada ${incomplete.length} item belum lengkap. Lengkapi sebelum kirim semua.`,
          variant: "destructive",
        });
        return;
      }

      for (const row of data) {
        await submitRcsaAssessment(row.id!);
      }

      toast({ title: "Semua data terkirim 🎉", description: "Semua data RCSA berhasil dikirim untuk ditinjau admin." });

      setData([]);
      setActiveRiskIndex(0);
    } catch (err: any) {
      console.error("Gagal kirim semua:", err);
      toast({
        title: "Gagal mengirim",
        description: err?.message || "Terjadi kesalahan saat mengirim data.",
        variant: "destructive",
      });
    }
  };

  // ====== RENDER ======
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 min-h-screen">
        <p className="text-xl text-muted-foreground animate-pulse">Memuat data RCSA...</p>
      </div>
    );
  }

  const isDataEmpty = data.length === 0;

  return (
    <div className="flex flex-1 flex-col p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">📊 Risk Control Self-Assessment (RCSA)</h1>
          <p className="text-muted-foreground">Lengkapi dan kelola data RCSA untuk unit operasional Anda.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button" // ✅ penting
            variant="outline"
            onClick={handleSaveAll}
            disabled={isSavingAll || isDataEmpty}
          >
            <Save className="mr-2 h-4 w-4" />
            {isSavingAll ? "Menyimpan..." : "Simpan Draf"}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button" // ✅ penting
                disabled={isDataEmpty}
                className="bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              >
                <Send className="mr-2 h-4 w-4" /> Kirim Semua ({totalRisks} Item)
              </Button>
            </AlertDialogTrigger>

            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Konfirmasi Pengiriman Semua Data</AlertDialogTitle>
                <AlertDialogDescription>
                  Anda akan mengirim <b>{totalRisks}</b> potensi risiko sekaligus. Pastikan semua item sudah lengkap dan
                  tersimpan. Setelah dikirim, data akan dikunci.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <AlertDialogFooter>
                {/* ✅ asChild biar kita bisa kontrol type */}
                <AlertDialogCancel asChild>
                  <Button type="button" variant="outline">
                    Batal
                  </Button>
                </AlertDialogCancel>

                <AlertDialogAction asChild>
                  <Button type="button" onClick={handleSubmitAll}>
                    Ya, Kirim Semua Data
                  </Button>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Info Unit */}
      <Alert className="mb-6 border-l-4 border-blue-600 bg-blue-50">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertTitle>
          Unit Kerja: <span className="font-bold text-blue-800">{unitName || "Tidak Ada Unit Ditemukan"}</span>
        </AlertTitle>
        <AlertDescription>
          {isDataEmpty ? (
            "Semua RCSA telah diselesaikan. Tidak ada risiko aktif saat ini."
          ) : (
            <>
              Anda sedang mengerjakan RCSA ke-{activeRiskIndex + 1} dari {totalRisks}. Data akan tersimpan otomatis setelah
              berhenti mengetik selama {DEBOUNCE_MS}ms.
            </>
          )}
        </AlertDescription>
      </Alert>

      {/* Table */}
      <div className="space-y-6">
        {isDataEmpty && (
          <div className="text-center text-muted-foreground py-12 text-lg border border-dashed rounded-lg p-10 bg-white/70">
            <Info className="h-6 w-6 mx-auto mb-3" />
            <p>Semua formulir RCSA telah selesai Anda kirim.</p>
          </div>
        )}

        {activeRisk && (
          <RiskTable 
            mode="user" 
            data={data} 
            onChange={handleInputChange} 
            onIndividualSubmit={handleIndividualSubmit} 
          />
        )}
      </div>

      {/* Navigasi */}
      {!isDataEmpty && (
        <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200">
          <Button type="button" onClick={handlePrevious} disabled={activeRiskIndex === 0} variant="outline">
            <ChevronLeft className="mr-2 h-4 w-4" /> Risiko Sebelumnya
          </Button>

          <div className="text-sm font-semibold text-gray-600">
            Item {activeRiskIndex + 1} dari {totalRisks}
          </div>

          <Button type="button" onClick={handleNext} disabled={activeRiskIndex === totalRisks - 1}>
            Risiko Berikutnya <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      {!isDataEmpty && savingCount > 0 && (
        <div className="mt-3 text-xs text-gray-500">Menyimpan {savingCount} item...</div>
      )}
    </div>
  );
}
