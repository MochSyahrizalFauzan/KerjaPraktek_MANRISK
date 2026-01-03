"use client";

import React, { FC } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RCSAData } from "@/lib/rcsa-data";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Send } from "lucide-react";

const MIN_SCORE = 1;
const MAX_SCORE = 5;

type TableMode = "user" | "reviewer";

// Komponen input angka 1–5 dengan validasi
const ScoreInput: FC<{
  label?: string;
  value: number | null;
  onChange?: (value: number | null) => void;
  disabled?: boolean;
}> = ({ label, value, onChange, disabled }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    let val = parseInt(e.target.value, 10);
    if (isNaN(val)) return onChange?.(null);
    if (val < MIN_SCORE) val = MIN_SCORE;
    if (val > MAX_SCORE) val = MAX_SCORE;
    onChange?.(val);
  };

  return (
    <div className="flex flex-col items-center justify-center">
      {label && (
        <Label className="text-[11px] text-gray-600 mb-1">
          {label} ({MIN_SCORE}-{MAX_SCORE})
        </Label>
      )}
      <Input
        type="number"
        min={MIN_SCORE}
        max={MAX_SCORE}
        value={value ?? ""}
        onChange={handleChange}
        disabled={disabled}
        className="text-center h-8 w-full text-xs"
        placeholder="Skala 1-5"
        onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
      />
    </div>
  );
};

// Penentu level risiko berdasarkan nilai
const getLevelFromBesaran = (value: number | null) => {
  if (!value) return { label: "-", color: "bg-gray-200 text-gray-700" };
  if (value >= 20) return { label: "Sangat Tinggi", color: "bg-red-700 text-white" };
  if (value >= 12) return { label: "Tinggi", color: "bg-red-500 text-white" };
  if (value >= 5) return { label: "Menengah", color: "bg-yellow-400 text-black" };
  return { label: "Rendah", color: "bg-green-500 text-white" };
};

// Pilihan jenis risiko
const JENIS_RISIKO_OPTIONS = [
  "Risiko Kredit",
  "Risiko Pasar",
  "Risiko Likuiditas",
  "Risiko Operasional",
  "Risiko Hukum",
  "Risiko Reputasi",
  "Risiko Strategis",
  "Risiko Kepatuhan",
  "Risiko Imbal Hasil",
  "Risiko Investasi",
];

type RiskTableProps = {
  data: RCSAData[];

  //  user-only
  onChange?: (index: number, field: keyof RCSAData, value: any) => void;
  onIndividualSubmit?: (id: number | string) => void;

  //  mode
  mode?: TableMode;

  //  optional override (kalau suatu saat butuh)
  readOnly?: boolean;
  showSubmitButton?: boolean;
};

export const RiskTable: React.FC<RiskTableProps> = ({
  data,
  onChange,
  onIndividualSubmit,
  mode = "user",
  readOnly: readOnlyProp,
  showSubmitButton: showSubmitButtonProp,
}) => {
  const readOnly = readOnlyProp ?? mode === "reviewer";
  const showSubmitButton = showSubmitButtonProp ?? mode === "user";

  return (
    <div className="relative border rounded-lg shadow-lg w-full flex flex-col bg-white">
      <div className="flex-1 overflow-auto">
        <table className="min-w-[3200px] divide-y divide-gray-200 border-gray-300">
          {/* ================= HEADER ================= */}
          <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-300">
            <tr className="text-[12px] font-medium text-gray-600 uppercase tracking-wider">
              <th className="px-3 py-3 text-center w-[40px] left-0 bg-gray-50 border-r border-gray-300">
                No
              </th>
              <th className="px-3 py-3 text-center w-[300px] sticky bg-gray-50 border-r border-gray-300">
                Potensi Risiko
              </th>
              <th className="px-3 py-3 text-center w-[150px] bg-gray-50 border-r border-gray-300">
                Jenis Risiko
              </th>
              <th className="px-3 py-3 text-center w-[300px] bg-gray-50 border-r border-gray-300">
                Penyebab Risiko
              </th>
              <th
                colSpan={4}
                className="px-3 py-1 text-center bg-yellow-100 border-x border-gray-300 text-gray-700"
              >
                RISIKO INHEREN
              </th>
              <th className="px-3 py-3 text-center w-[300px] bg-gray-50 border-r border-gray-300">
                Pengendalian Risiko
              </th>
              <th
                colSpan={4}
                className="px-3 py-1 text-center bg-blue-100 border-x border-gray-300 text-gray-700"
              >
                RISIKO RESIDUAL
              </th>
              <th className="px-3 py-3 text-center w-[350px] bg-gray-50 border-r border-gray-300">
                Action Plan / Mitigasi
              </th>
              <th className="px-3 py-3 text-center w-[200px] bg-gray-50 border-r border-gray-300">
                PIC
              </th>

              {/*  Aksi hanya untuk USER */}
              {showSubmitButton && (
                <th className="px-3 py-3 text-center w-[120px] sticky right-0 bg-gray-50">
                  Aksi
                </th>
              )}
            </tr>

            <tr className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
              <th colSpan={4}></th>
              <th className="bg-yellow-200 border-r border-gray-300">Dampak</th>
              <th className="bg-yellow-200 border-r border-gray-300">Frekuensi</th>
              <th className="bg-yellow-200 border-r border-gray-300">Besaran</th>
              <th className="bg-yellow-200 border-r border-gray-300">Level</th>
              <th></th>
              <th className="bg-blue-200 border-r border-gray-300">Dampak</th>
              <th className="bg-blue-200 border-r border-gray-300">Kemungkinan</th>
              <th className="bg-blue-200 border-r border-gray-300">Besaran</th>
              <th className="bg-blue-200 border-r border-gray-300">Level</th>
              <th colSpan={showSubmitButton ? 4 : 3}></th>
            </tr>
          </thead>

          {/* ================= BODY ================= */}
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row, index) => {
              const besaranInheren =
                row.dampakInheren && row.frekuensiInheren
                  ? row.dampakInheren * row.frekuensiInheren
                  : null;
              const levelInheren = getLevelFromBesaran(besaranInheren);

              const besaranResidual =
                row.dampakResidual && row.kemungkinanResidual
                  ? row.dampakResidual * row.kemungkinanResidual
                  : null;
              const levelResidual = getLevelFromBesaran(besaranResidual);

              const canSubmit = !!row.id && !readOnly;

              return (
                <tr
                  key={`${row.rcsa_master_id ?? "m"}-${row.unit_id ?? "u"}-${row.no}`}
                  className="text-xs text-gray-800 hover:bg-gray-50 transition-colors"
                >
                  {/* No */}
                  <td className="text-center left-0 bg-white border-r border-gray-200 font-semibold">
                    {row.no}
                  </td>

                  {/* Potensi Risiko */}
                  <td className="px-2 py-2 sticky border-r border-gray-200">
                    {row.potensiRisiko}
                  </td>

                  {/* Jenis Risiko */}
                  <td className="px-2 py-2 border-r border-gray-200">
                    <Select
                      value={row.jenisRisiko || ""}
                      onValueChange={(val) => {
                        if (readOnly) return;
                        onChange?.(index, "jenisRisiko", val);
                      }}
                      disabled={readOnly}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Pilih Jenis" />
                      </SelectTrigger>
                      <SelectContent>
                        {JENIS_RISIKO_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>

                  {/* Penyebab Risiko */}
                  <td className="px-2 py-1 border-r border-gray-200">
                    <Textarea
                      value={row.penyebabRisiko ?? ""}
                      onChange={(e) => {
                        if (readOnly) return;
                        onChange?.(index, "penyebabRisiko", e.target.value);
                      }}
                      readOnly={readOnly}
                      className="h-10 text-xs"
                      placeholder="Isi penyebab..."
                    />
                  </td>

                  {/* Risiko Inheren */}
                  <td className="bg-yellow-50 border-r border-gray-200">
                    <ScoreInput
                      disabled={readOnly}
                      value={row.dampakInheren ?? null}
                      onChange={(val) => onChange?.(index, "dampakInheren", val)}
                    />
                  </td>
                  <td className="bg-yellow-50 border-r border-gray-200">
                    <ScoreInput
                      disabled={readOnly}
                      value={row.frekuensiInheren ?? null}
                      onChange={(val) => onChange?.(index, "frekuensiInheren", val)}
                    />
                  </td>
                  <td className="text-center font-bold bg-yellow-100 border-r border-gray-200">
                    {besaranInheren || "-"}
                  </td>
                  <td className="text-center border-r border-gray-200">
                    <span className={`px-2 py-0.5 rounded ${levelInheren.color}`}>
                      {levelInheren.label}
                    </span>
                  </td>

                  {/* Pengendalian Risiko */}
                  <td className="px-2 py-1 border-r border-gray-200">
                    <Textarea
                      value={row.pengendalian ?? ""}
                      onChange={(e) => {
                        if (readOnly) return;
                        onChange?.(index, "pengendalian", e.target.value);
                      }}
                      readOnly={readOnly}
                      className="h-10 text-xs"
                      placeholder="Pengendalian..."
                    />
                  </td>

                  {/* Risiko Residual */}
                  <td className="bg-blue-50 border-r border-gray-200">
                    <ScoreInput
                      disabled={readOnly}
                      value={row.dampakResidual ?? null}
                      onChange={(val) => onChange?.(index, "dampakResidual", val)}
                    />
                  </td>
                  <td className="bg-blue-50 border-r border-gray-200">
                    <ScoreInput
                      disabled={readOnly}
                      value={row.kemungkinanResidual ?? null}
                      onChange={(val) => onChange?.(index, "kemungkinanResidual", val)}
                    />
                  </td>
                  <td className="text-center font-bold bg-blue-100 border-r border-gray-200">
                    {besaranResidual || "-"}
                  </td>
                  <td className="text-center border-r border-gray-200">
                    <span className={`px-2 py-0.5 rounded ${levelResidual.color}`}>
                      {levelResidual.label}
                    </span>
                  </td>

                  {/* Action Plan & PIC */}
                  <td className="px-2 py-1 border-r border-gray-200">
                    <Textarea
                      value={row.actionPlan ?? ""}
                      onChange={(e) => {
                        if (readOnly) return;
                        onChange?.(index, "actionPlan", e.target.value);
                      }}
                      readOnly={readOnly}
                      className="h-10 text-xs"
                      placeholder="Rencana aksi..."
                    />
                  </td>
                  <td className="px-2 py-1 border-r border-gray-200">
                    <Input
                      value={row.pic ?? ""}
                      onChange={(e) => {
                        if (readOnly) return;
                        onChange?.(index, "pic", e.target.value);
                      }}
                      readOnly={readOnly}
                      className="text-xs h-8"
                      placeholder="Nama PIC"
                    />
                  </td>

                  {/* Aksi Submit hanya untuk USER */}
                  {showSubmitButton && (
                    <td className="sticky right-0 bg-white text-center border-l border-gray-200">
                      <Button
                        type="button"
                        size="sm"
                        disabled={!canSubmit}
                        onClick={() => {
                          if (!row.id) return;
                          onIndividualSubmit?.(row.id);
                        }}
                        className="h-7 px-3 text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send className="h-3 w-3 mr-1" /> Kirim
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
