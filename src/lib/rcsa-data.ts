"use client";

import { MasterRCSA, fetchMasterRCSA } from "./rcsa-master-data";
import { RCSA_AssessmentPayload } from "@/types/rcsa";
import { toSnakeCase } from "@/lib/utils";

//=================== types =====================
export type RCSAData = {
  id: number;
  no: number;

  rcsa_master_id: number;
  unit_id: number;
  created_by: number;

  unit_name: string;
  unit_type?: string | null;

  potensiRisiko: string | null;
  jenisRisiko: string | null;
  penyebabRisiko: string | null;

  status: "draft" | "submitted" | "reviewed";

  dampakInheren: number | null;
  frekuensiInheren: number | null;
  nilaiInheren: number | null;
  levelInheren: "Rendah" | "Sedang" | "Tinggi" | "Sangat Tinggi" | null;

  pengendalian: string | null;

  dampakResidual: number | null;
  kemungkinanResidual: number | null;
  nilaiResidual: number | null;
  levelResidual: "Rendah" | "Sedang" | "Tinggi" | "Sangat Tinggi" | null;

  actionPlan: string | null;
  pic: string | null;
  keteranganUser: string | null;

  created_at?: string | null;
  updated_at?: string | null;

  // hasil review
  decision: "approved" | "rejected" | null;
  note: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
};



// --- HELPER UNTUK KALKULASI LEVEL (Penting!) ---
// Level DB: 'Rendah', 'Sedang', 'Tinggi', 'Sangat Tinggi'
const getLevelLabel = (besaran: number | null | undefined): string | null => {
if (besaran === null || besaran === undefined) {
  return null;
  }
    // Logika penentuan level sesuai yang digunakan di frontend (Rcsapage.tsx)
    if (besaran >= 20) return "Sangat Tinggi";
    if (besaran >= 12) return "Tinggi";
    if (besaran >= 5) return "Sedang"; 
  return "Rendah";
};

// ================= MAPPERS =================

export function mapMasterToRCSA(master: MasterRCSA, no: number, userId: number, 
  unitId: number, unitName?: string, unitType?: string): RCSAData {
  return {
    id: undefined,
    no,
    rcsa_master_id: master.id,
    unit_id: unitId,
    unit_name: unitName || undefined,
    unit_type: unitType || undefined,
    potensiRisiko: master.rcsa_name && master.rcsa_name.trim() !== "" ? master.rcsa_name : "Tidak ada potensi risiko",
    jenisRisiko: null,
    penyebabRisiko: null,
    dampakInheren: null,
    frekuensiInheren: null,
    pengendalian: null,
    dampakResidual: null,
    kemungkinanResidual: null,
    actionPlan: null,
    pic: null,
    keteranganAdmin: master.description || null,
    keteranganUser: null,
    status: "draft",
  };
}

// mapToAssessment DENGAN PERHITUNGAN LENGKAP
export function mapToAssessment(row: RCSAData, userId: number, unitId: number) {
  // Hitung Nilai & Level Inheren
  const nilaiInheren = 
    row.dampakInheren && row.frekuensiInheren 
      ? row.dampakInheren * row.frekuensiInheren 
      : null;
  const levelInheren = getLevelLabel(nilaiInheren);
  
  // Hitung Nilai & Level Residual
  const nilaiResidual = 
    row.dampakResidual && row.kemungkinanResidual 
      ? row.dampakResidual * row.kemungkinanResidual 
      : null;
  const levelResidual = getLevelLabel(nilaiResidual);
  return {
    id: row.id,
    rcsa_master_id: row.rcsa_master_id ?? row.rcsaMasterId,
    unit_id: unitId,
    created_by: userId,
    potensi_risiko: row.potensiRisiko ?? "",
    jenis_risiko: row.jenisRisiko ?? null,
    penyebab_risiko: row.penyebabRisiko ?? null,
    keterangan_admin: row.keteranganAdmin ?? null,
    pengendalian: row.pengendalian ?? null,
    
    // Data Inheren
    dampak_inheren: row.dampakInheren ?? null,
    frekuensi_inheren: row.frekuensiInheren ?? null,
    nilai_inheren: nilaiInheren, // **KOLOM BARU TERISI**
    level_inheren: levelInheren, // **KOLOM BARU TERISI**
    // Data Residual
    dampak_residual: row.dampakResidual ?? null,
    kemungkinan_residual: row.kemungkinanResidual ?? null,
    nilai_residual: nilaiResidual, // **KOLOM BARU TERISI**
    level_residual: levelResidual, // **KOLOM BARU TERISI**

    action_plan: row.actionPlan ?? null,
    pic: row.pic ?? null,
    keterangan_user: row.keteranganUser ?? null, // **KOLOM BARU TERISI**
    status: row.status || "draft",
  };
}


export function mapPayloadToRCSAData(
  payload: RCSA_AssessmentPayload & { keterangan_user?: string }, // Tambahkan keterangan_user di payload
  no: number,
  unitName?: string,
  unitType?: string
): RCSAData {
  return {
    id: payload.id,
    no,
    rcsa_master_id: payload.rcsa_master_id,
    unit_id: payload.unit_id,
    unit_name: unitName,
    unit_type: unitType, 
    potensiRisiko: payload.potensi_risiko && payload.potensi_risiko.trim() !== "" ? payload.potensi_risiko
    : "Tidak ada potensi risiko",
    jenisRisiko: payload.jenis_risiko ?? null,        
    penyebabRisiko: payload.penyebab_risiko ?? null,  
    dampakInheren: payload.dampak_inheren ?? null,
    frekuensiInheren: payload.frekuensi_inheren ?? null,
    pengendalian: payload.pengendalian ?? null, 
    dampakResidual: payload.dampak_residual ?? null,
    kemungkinanResidual: payload.kemungkinan_residual ?? null,
    actionPlan: payload.action_plan ?? null,
    pic: payload.pic ?? null, 
    keteranganAdmin: payload.keterangan_admin ?? null,
    keteranganUser: payload.keterangan_user ?? null, // **UPDATE: Mapping dari payload DB**
    status: payload.status as "draft" | "submitted" | "reviewed",
  };
}


// ================= API CALLS =================
const API_BASE = "http://localhost:5000";

// Ambil draft user (assessment yang belum submit)
  export const getRcsaDraft = async (
  userId: number,
  unitId: number
  ): Promise<RCSAData[]> => {
    try {
      const res = await fetch(
        `${API_BASE}/rcsa/assessment/drafts?unit_id=${unitId}&exclude_submitted=true&incomplete_only=true`,
        { credentials: "include" }
      );

      if (!res.ok) {
        const text = await res.text();
        console.error("Fetch drafts error:", res.status, text);
        throw new Error("Gagal ambil draft RCSA (gabungan master)");
      }

      const rows = await res.json();

      //  ambil info unit
      const unitRes = await fetch(`${API_BASE}/units/${unitId}`,
        { credentials: "include" }
      );
      const unit = await unitRes.json();
      console.log("DEBUG unit:", unit);

      return rows.map((r: any, i: number) =>
        mapPayloadToRCSAData(
          {
            id: r.assessment_id,
            rcsa_master_id: r.rcsa_master_id,
            unit_id: r.unit_id,
            potensi_risiko:
              r.potensi_risiko?.trim() ||
              r.rcsa_name?.trim() ||
              "Tidak ada potensi risiko",
            jenis_risiko: r.jenis_risiko || null,
            penyebab_risiko: r.penyebab_risiko || null,
            dampak_inheren: r.dampak_inheren ?? null,
            frekuensi_inheren: r.frekuensi_inheren ?? null,
            pengendalian: r.pengendalian || null,
            dampak_residual: r.dampak_residual ?? null,
            kemungkinan_residual: r.kemungkinan_residual ?? null,
            action_plan: r.action_plan || null,
            pic: r.pic || null,
            status: r.status ?? "draft", // kalau belum ada assessment → default draft
            created_by: userId,
          },
          i + 1,
          r.unit_name,
          r.unit_type
        )
      );
    } catch (err) {
      console.error("getRcsaDraftWithMaster error:", err);
      return [];
    }
  };

// Ambil assessment  submit
export const getRcsaSubmitted = async (
  userId?: number,
  unitId?: number
): Promise<RCSAData[]> => {
  try {
    let url = `${API_BASE}/rcsa/assessment`;
    const params: string[] = [];
    if (userId) params.push(`created_by=${userId}`);
    if (unitId) params.push(`unit_id=${unitId}`);
    if (params.length > 0) url += `?${params.join("&")}`;

    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) {
      const text = await res.text();
      console.error("Fetch submitted error:", res.status, text);
      throw new Error("Gagal ambil submitted RCSA");
    }

    const rows = await res.json();

    return rows.map((r: any, i: number) =>
      mapPayloadToRCSAData(
        {
          id: r.id,
          rcsa_master_id: r.rcsa_master_id,
          unit_id: r.unit_id,
          potensi_risiko: r.potensi_risiko?.trim() || "Tidak ada potensi risiko",
          jenis_risiko: r.jenis_risiko || null,
          penyebab_risiko: r.penyebab_risiko || null,
          dampak_inheren: r.dampak_inheren ?? null,
          frekuensi_inheren: r.frekuensi_inheren ?? null,
          pengendalian: r.pengendalian || null,
          dampak_residual: r.dampak_residual ?? null,
          kemungkinan_residual: r.kemungkinan_residual ?? null,
          action_plan: r.action_plan || null,
          pic: r.pic || null,
          status: r.status,
          created_by: r.created_by,
        },
        i + 1,
        r.unit_name,
        r.unit_type
      )
    );
  } catch (err) {
    console.error("getRcsaSubmitted error:", err);
    return [];
  }
};



// Simpan assessment (insert ke DB)
function sanitizePayload(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sanitizePayload);
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, sanitizePayload(v)])
  );
}

export async function saveRcsaAssessment(data: any) {
  const snake = toSnakeCase(data);
  const finalPayload = sanitizePayload({
    ...snake,
  });

  console.log("Payload saveRcsaAssessment (final):", JSON.stringify(finalPayload, null, 2));

  if (!finalPayload.rcsa_master_id) {
    throw new Error("rcsa_master_id wajib diisi sebelum simpan assessment");
  }
  if (!finalPayload.unit_id) {
    throw new Error("unit_id wajib diisi sebelum simpan assessment");
  }
  if (!finalPayload.created_by) {
    throw new Error("created_by wajib diisi sebelum simpan assessment");
  }

  const res = await fetch(
    data.id
      ? `http://localhost:5000/rcsa/assessment/${data.id}`
      : `http://localhost:5000/rcsa/assessment`,
    {
      method: data.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(finalPayload),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    console.error("saveRcsaAssessment error:", res.status, text);
    throw new Error("Gagal simpan assessment");
  }

  return await res.json();
}


// Submit assessment (ubah status ke submitted)
export const submitRcsaAssessment = async (id: number) => {
  const res = await fetch(`${API_BASE}/rcsa/assessment/${id}/submit`, {
    method: "PUT",
    credentials: "include",
  });

  if (!res.ok) {
    let msg = "Gagal submit assessment";
    try {
      const j = await res.json();
      msg = j?.message || msg;
      if (j?.missing?.length) msg += ` (Missing: ${j.missing.join(", ")})`;
    } catch {}
    throw new Error(msg);
  }

  return await res.json();
};


// Ambil semua submissions (untuk admin)
export const getAllRcsaSubmissions = async (): Promise<RCSAData[]> => {
  try {
    const res = await fetch(`${API_BASE}/rcsa/assessment`,
      { credentials: "include" });
    if (!res.ok) throw new Error("Gagal ambil submissions");

    const data = await res.json();

    
    return Array.isArray(data)
  ? data.map((r: any, i: number) =>
      mapPayloadToRCSAData(r, i + 1, r.unit_name, r.unit_type)
    )
  : [];

  } catch (err) {
    console.error("getAllRcsaSubmissions error:", err);
    return [];
  }
};

export async function getRcsaArchive(): Promise<RCSAData[]> {
  const res = await fetch("http://localhost:5000/rcsa/report/reviewed", {
    credentials: "include",
  });

  if (!res.ok) throw new Error("Gagal mengambil report reviewed");

  const rows = await res.json();

  return rows.map((r: any, idx: number) => ({
    id: r.id,
    no: idx + 1,

    rcsa_master_id: r.rcsa_master_id,
    unit_id: r.unit_id,

    // RiskTable pakai ini
    potensiRisiko: r.potensi_risiko ?? "",
    jenisRisiko: r.jenis_risiko ?? null,
    penyebabRisiko: r.penyebab_risiko ?? null,

    dampakInheren: r.dampak_inheren ?? null,
    frekuensiInheren: r.frekuensi_inheren ?? null,
    pengendalian: r.pengendalian ?? null,

    dampakResidual: r.dampak_residual ?? null,
    kemungkinanResidual: r.kemungkinan_residual ?? null,

    actionPlan: r.action_plan ?? null,
    pic: r.pic ?? null,

    // optional lain yang kamu punya di type
    status: r.status,
    keteranganUser: r.keterangan_user ?? null,

    // review meta (kalau type kamu punya)
    decision: r.decision ?? null,
    note: r.note ?? null,
    reviewer_name: r.reviewer_name ?? null,
    reviewed_at: r.reviewed_at ?? null,

    // kalau type kamu ada unit_name, unit_type juga isi
    unit_name: r.unit_name ?? "",
    unit_type: r.unit_type ?? null,
    created_by: r.created_by ?? null,
    created_at: r.created_at ?? null,
    updated_at: r.updated_at ?? null,
  }));
}



