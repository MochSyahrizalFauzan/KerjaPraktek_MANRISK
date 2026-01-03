"use client";

import { useEffect, useMemo, useState } from "react";
import { getRcsaArchive, type RCSAData } from "@/lib/rcsa-data";
import { RcsaReportTable } from "@/components/rcsa/RcsaReportTable";
import { Button } from "@/components/ui/button";
import { RefreshCw, FileSpreadsheet } from "lucide-react";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import * as XLSX from "xlsx-js-style";
import { Badge } from "@/components/ui/badge";

function getMonthKey(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`; // contoh: "2026-01"
}

function monthLabel(monthKey: string) {
  // "2026-01" -> "Jan 2026"
  const [y, m] = monthKey.split("-");
  const idx = Number(m) - 1;
  const names = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  return `${names[idx] ?? m} ${y}`;
}

export default function RcsaReportPage() {
  const [submissions, setSubmissions] = useState<RCSAData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // FILTERS
  const [selectedUnit, setSelectedUnit] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "draft" | "submitted" | "reviewed">("all");
  const [selectedDecision, setSelectedDecision] = useState<"all" | "approved" | "rejected" | "none">("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all"); // "YYYY-MM"

  const loadData = async () => {
    setIsLoading(true);
    try {
      const result = await getRcsaArchive();
      setSubmissions(result);
    } catch (e) {
      console.error(e);
      setSubmissions([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Options filter Unit
  const unitOptions = useMemo(() => {
    const unique = Array.from(new Set(submissions.map((s) => s.unit_name).filter(Boolean)));
    return [
      { label: "Semua Unit", value: "all" },
      ...unique.map((u) => ({ label: u!, value: u! })),
    ];
  }, [submissions]);

  // Options filter Bulan (berdasarkan reviewed_at lalu fallback updated_at)
  const monthOptions = useMemo(() => {
    const keys = new Set<string>();

    for (const s of submissions) {
      const key = getMonthKey(s.reviewed_at ?? (s as any).updated_at ?? null);
      if (key) keys.add(key);
    }

    const sorted = Array.from(keys).sort((a, b) => (a > b ? -1 : 1)); // desc
    return [
      { label: "Semua Bulan", value: "all" },
      ...sorted.map((k) => ({ label: monthLabel(k), value: k })),
    ];
  }, [submissions]);

  // Filtering
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((s) => {
      // filter unit
      if (selectedUnit !== "all" && s.unit_name !== selectedUnit) return false;

      // filter decision
      if (selectedDecision !== "all") {
        const d = s.decision ?? null;
        if (selectedDecision === "none") {
          if (d !== null) return false;
        } else {
          if (d !== selectedDecision) return false;
        }
      }

      // filter bulan
      if (selectedMonth !== "all") {
        const key = getMonthKey(s.reviewed_at ?? (s as any).updated_at ?? null);
        if (key !== selectedMonth) return false;
      }

      return true;
    });
  }, [submissions, selectedUnit, selectedStatus, selectedDecision, selectedMonth]);

const downloadExcelMergedStyled = () => {
  const rowsToExport = filteredSubmissions;

  if (!rowsToExport.length) {
    alert("Tidak ada data untuk di-export.");
    return;
  }

  // =========================
  // Tailwind-like colors (hex -> rgb string)
  // =========================
  // Gray 50/100/700, Yellow 100/200, Blue 100/200, Green 600, Red 600
  const C = {
    gray50: "F9FAFB",
    gray100: "F3F4F6",
    gray200: "E5E7EB",
    gray700: "374151",
    white: "FFFFFF",
    black: "000000",

    yellow100: "FEF9C3",
    yellow200: "FEF08A",

    blue100: "DBEAFE",
    blue200: "BFDBFE",

    green600: "16A34A",
    red600: "DC2626",

    // Level colors (match your UI intent)
    levelLow: "22C55E",      // green-500
    levelMed: "FACC15",      // yellow-400
    levelHigh: "EF4444",     // red-500
    levelVeryHigh: "B91C1C", // red-700
  };

  // =========================
  // Style helpers
  // =========================
  const borderThin = {
    top: { style: "thin", color: { rgb: C.gray200 } },
    bottom: { style: "thin", color: { rgb: C.gray200 } },
    left: { style: "thin", color: { rgb: C.gray200 } },
    right: { style: "thin", color: { rgb: C.gray200 } },
  } as const;

  const baseCell = {
    font: { name: "Calibri", sz: 11, color: { rgb: C.gray700 } },
    alignment: { vertical: "center", horizontal: "left", wrapText: true },
    border: borderThin,
  };

  const headerBase = {
    font: { name: "Calibri", sz: 11, bold: true, color: { rgb: C.gray700 } },
    alignment: { vertical: "center", horizontal: "center", wrapText: true },
    border: borderThin,
  } as const;

  const makeFill = (hex: string) => ({ fill: { patternType: "solid", fgColor: { rgb: hex } } });

  const headerGray = { ...headerBase, ...makeFill(C.gray100) };
  const headerYellow = { ...headerBase, ...makeFill(C.yellow100) };
  const headerYellow2 = { ...headerBase, ...makeFill(C.yellow200) };
  const headerBlue = { ...headerBase, ...makeFill(C.blue100) };
  const headerBlue2 = { ...headerBase, ...makeFill(C.blue200) };

  const badgeTextWhite = { font: { name: "Calibri", sz: 11, bold: true, color: { rgb: C.white } } };

  const levelStyle = (level: string) => {
    if (level === "Sangat Tinggi")
      return {
        ...headerBase,
        ...badgeTextWhite,
        ...makeFill(C.levelVeryHigh),
      };
    if (level === "Tinggi")
      return {
        ...headerBase,
        ...badgeTextWhite,
        ...makeFill(C.levelHigh),
      };
    if (level === "Menengah" || level === "Sedang")
      return {
        ...headerBase,
        font: { name: "Calibri", sz: 11, bold: true, color: { rgb: C.black } },
        ...makeFill(C.levelMed),
      };
    if (level === "Rendah")
      return {
        ...headerBase,
        ...badgeTextWhite,
        ...makeFill(C.levelLow),
      };
    return {
      ...headerBase,
      ...makeFill(C.gray200),
    };
  };

  const statusStyle = (status?: string | null) => {
    if (status === "reviewed") return { ...headerBase, ...badgeTextWhite, ...makeFill("2563EB") }; // blue-600
    if (status === "submitted") return { ...headerBase, font: { name: "Calibri", sz: 11, bold: true, color: { rgb: C.black } }, ...makeFill("F59E0B") }; // amber-500
    return { ...headerBase, ...badgeTextWhite, ...makeFill("6B7280") }; // gray-500
  };

  const decisionStyle = (decision?: string | null) => {
    if (decision === "approved") return { ...headerBase, ...badgeTextWhite, ...makeFill(C.green600) };
    if (decision === "rejected") return { ...headerBase, ...badgeTextWhite, ...makeFill(C.red600) };
    return { ...headerBase, ...badgeTextWhite, ...makeFill("6B7280") };
  };

  const levelFromBesaran = (value: number | null) => {
    if (value === null || value === undefined) return "-";
    if (value >= 20) return "Sangat Tinggi";
    if (value >= 12) return "Tinggi";
    if (value >= 5) return "Menengah";
    return "Rendah";
  };

  // =========================
  // 2-row header (merged)
  // =========================
  // Total columns = 21 (A..U)
  const headerRow1 = [
    "NO.",
    "UNIT KERJA",
    "POTENSI RISIKO",
    "JENIS RISIKO",
    "PENYEBAB RISIKO",

    "RISIKO INHEREN",
    "",
    "",
    "",

    "PENGENDALIAN/MITIGASI RISIKO (USER)",

    "RISIKO RESIDUAL",
    "",
    "",
    "",

    "ACTION PLAN / MITIGASI",
    "PIC",
    "STATUS",
    "DECISION",
    "REVIEWER",
    "REVIEWED AT",
    "NOTE",
  ];

  const headerRow2 = [
    "",
    "",
    "",
    "",
    "",

    "DAMPAK (USER)",
    "FREKUENSI (USER)",
    "BESARAN/NILAI (AUTO)",
    "LEVEL (AUTO)",

    "",

    "DAMPAK/IMPACT",
    "KEMUNGKINAN/FREKUENSI",
    "BESARAN/NILAI (AUTO)",
    "LEVEL (AUTO)",

    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ];

  const aoa: any[][] = [headerRow1, headerRow2];

  // =========================
  // Data rows
  // =========================
  rowsToExport.forEach((r) => {
    const inherenBesaran =
      r.dampakInheren && r.frekuensiInheren ? r.dampakInheren * r.frekuensiInheren : null;

    const residualBesaran =
      r.dampakResidual && r.kemungkinanResidual
        ? r.dampakResidual * r.kemungkinanResidual
        : null;

    const inherenLevel = levelFromBesaran(inherenBesaran);
    const residualLevel = levelFromBesaran(residualBesaran);

    aoa.push([
      r.no ?? "",
      r.unit_name ?? "",
      r.potensiRisiko ?? "",
      r.jenisRisiko ?? "",
      r.penyebabRisiko ?? "",

      r.dampakInheren ?? "",
      r.frekuensiInheren ?? "",
      inherenBesaran ?? "",
      inherenLevel,

      r.pengendalian ?? "",

      r.dampakResidual ?? "",
      r.kemungkinanResidual ?? "",
      residualBesaran ?? "",
      residualLevel,

      r.actionPlan ?? "",
      r.pic ?? "",
      r.status ?? "",
      (r as any).decision ?? "",
      (r as any).reviewer_name ?? "",
      (r as any).reviewed_at ?? "",
      (r as any).note ?? "",
    ]);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);

  // =========================
  // Merges (to mimic HTML)
  // =========================
  worksheet["!merges"] = [
    // RISIKO INHEREN group: F..I at row 1 (0-index row=0)
    { s: { r: 0, c: 5 }, e: { r: 0, c: 8 } },
    // RISIKO RESIDUAL group: K..N at row 1
    { s: { r: 0, c: 10 }, e: { r: 0, c: 13 } },

    // Vertical merges for non-group columns A..E, J, O..U (row0..row1)
    ...[0, 1, 2, 3, 4, 9, 14, 15, 16, 17, 18, 19, 20].map((c) => ({
      s: { r: 0, c },
      e: { r: 1, c },
    })),
  ];

  // =========================
  // Column widths (Tailwind-ish readability)
  // =========================
  worksheet["!cols"] = [
    { wch: 6 },  // NO
    { wch: 22 }, // Unit
    { wch: 40 }, // Potensi
    { wch: 18 }, // Jenis
    { wch: 40 }, // Penyebab
    { wch: 14 }, // Inheren Dampak
    { wch: 16 }, // Inheren Frek
    { wch: 18 }, // Inheren Besaran
    { wch: 16 }, // Inheren Level
    { wch: 42 }, // Pengendalian
    { wch: 14 }, // Resid Dampak
    { wch: 22 }, // Resid Kemungkinan
    { wch: 18 }, // Resid Besaran
    { wch: 16 }, // Resid Level
    { wch: 34 }, // Action Plan
    { wch: 18 }, // PIC
    { wch: 12 }, // Status
    { wch: 12 }, // Decision
    { wch: 20 }, // Reviewer
    { wch: 20 }, // Reviewed At
    { wch: 50 }, // Note
  ];

  // =========================
  // Freeze top 2 header rows
  // =========================
  // SheetJS-style supports "!freeze" in many environments
  // @ts-ignore
  worksheet["!freeze"] = {
    xSplit: 0,
    ySplit: 2,
    topLeftCell: "A3",
    activePane: "bottomLeft",
    state: "frozen",
  };

  // =========================
  // Apply styles
  // =========================
  const setStyle = (r: number, c: number, style: any) => {
    const addr = XLSX.utils.encode_cell({ r, c });
    if (!worksheet[addr]) worksheet[addr] = { t: "s", v: "" };
    worksheet[addr].s = style;
  };

  // Header styles: row 0 and row 1
  // Non-group columns in header -> gray
  const nonGroupCols = [0, 1, 2, 3, 4, 9, 14, 15, 16, 17, 18, 19, 20];
  nonGroupCols.forEach((c) => {
    setStyle(0, c, headerGray);
    setStyle(1, c, headerGray); // row 1 merged vertically but safe
  });

  // Inheren group headers (row 0) -> yellow, subheaders (row 1) -> slightly darker yellow
  for (let c = 5; c <= 8; c++) {
    setStyle(0, c, headerYellow);
    setStyle(1, c, headerYellow2);
  }

  // Residual group headers -> blue, subheaders -> slightly darker blue
  for (let c = 10; c <= 13; c++) {
    setStyle(0, c, headerBlue);
    setStyle(1, c, headerBlue2);
  }

  // Make header row height larger + wrap (optional)
  worksheet["!rows"] = [{ hpt: 28 }, { hpt: 36 }];

  // Data cell base style + conditional coloring for level cells + status/decision badges
  const dataStartRow = 2;
  const dataEndRow = aoa.length - 1;

  for (let rr = dataStartRow; rr <= dataEndRow; rr++) {
    for (let cc = 0; cc <= 20; cc++) {
      // default cell style
      setStyle(rr, cc, baseCell);
    }

    // Center align some numeric/short fields
    [0, 5, 6, 7, 8, 10, 11, 12, 13, 16, 17].forEach((cc) => {
      const addr = XLSX.utils.encode_cell({ r: rr, c: cc });
      if (worksheet[addr]?.s) {
        worksheet[addr].s = {
          ...worksheet[addr].s,
          alignment: { vertical: "center", horizontal: "center", wrapText: true },
        };
      }
    });

    // Conditional coloring: LEVEL INHEREN (col 8) & LEVEL RESIDUAL (col 13)
    const inherenLevelCell = XLSX.utils.encode_cell({ r: rr, c: 8 });
    const residualLevelCell = XLSX.utils.encode_cell({ r: rr, c: 13 });

    const inherenLevelVal = worksheet[inherenLevelCell]?.v ?? "-";
    const residualLevelVal = worksheet[residualLevelCell]?.v ?? "-";

    setStyle(rr, 8, levelStyle(String(inherenLevelVal)));
    setStyle(rr, 13, levelStyle(String(residualLevelVal)));

    // Status (col 16)
    const statusCell = XLSX.utils.encode_cell({ r: rr, c: 16 });
    const statusVal = worksheet[statusCell]?.v ?? "";
    setStyle(rr, 16, statusStyle(String(statusVal)));

    // Decision (col 17)
    const decisionCell = XLSX.utils.encode_cell({ r: rr, c: 17 });
    const decisionVal = worksheet[decisionCell]?.v ?? "";
    setStyle(rr, 17, decisionStyle(String(decisionVal)));
  }

  // =========================
  // Build workbook & download
  // =========================
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, worksheet, "RCSA Report");

  const fileName = `rcsa_report_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
};



  if (isLoading) return <div className="p-8">Memuat data...</div>;

  const total = filteredSubmissions.length;
  const approvedCount = filteredSubmissions.filter((x) => x.decision === "approved").length;
  const rejectedCount = filteredSubmissions.filter((x) => x.decision === "rejected").length;

  return (
    <div className="flex flex-col h-full overflow-hidden p-6">
      {/* Header */}
      <div className="flex-shrink-0 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Laporan RCSA</h1>
            <p className="text-muted-foreground">
              Filter berdasarkan Unit, Status, Decision, dan Bulan.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={downloadExcelMergedStyled}
              variant="default"
              className="bg-green-600 hover:bg-green-700"
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Download Excel
            </Button>

            <Button onClick={loadData} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Muat Ulang Data
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 mb-4 grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Unit */}
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium">Filter Unit Kerja</Label>
          <SearchableSelect
            options={unitOptions}
            value={selectedUnit}
            onValueChange={setSelectedUnit}
            placeholder="Pilih unit..."
          />
        </div>

        {/* Decision */}
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium">Filter Decision</Label>
          <SearchableSelect
            options={[
              { label: "Semua Decision", value: "all" },
              { label: "Approved", value: "approved" },
              { label: "Rejected", value: "rejected" },
              { label: "Tanpa Decision", value: "none" },
            ]}
            value={selectedDecision}
            onValueChange={(v) => setSelectedDecision(v as any)}
            placeholder="Pilih decision..."
          />
        </div>

        {/* Bulan */}
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium">Filter Bulan</Label>
          <SearchableSelect
            options={monthOptions}
            value={selectedMonth}
            onValueChange={setSelectedMonth}
            placeholder="Pilih bulan..."
          />
        </div>
      </div>

      {/* Summary */}
      <div className="flex-shrink-0 mb-3 flex flex-wrap gap-2">
        <Badge className="bg-gray-100 text-gray-800">Total: {total}</Badge>
        <Badge className="bg-green-600 text-white">Approved: {approvedCount}</Badge>
        <Badge className="bg-red-600 text-white">Rejected: {rejectedCount}</Badge>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {filteredSubmissions.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            Tidak ada laporan yang tersedia.
          </div>
        ) : (
          <RcsaReportTable data={filteredSubmissions} />
        )}
      </div>
    </div>
  );
}
