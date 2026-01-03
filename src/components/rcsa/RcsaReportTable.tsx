"use client";

import React from "react";
import { RCSAData } from "@/lib/rcsa-data";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const badgeDecision = (d?: RCSAData["decision"] | null) => {
  if (d === "approved") return "bg-green-600 text-white";
  if (d === "rejected") return "bg-red-600 text-white";
  return "bg-gray-500 text-white";
};

const badgeStatus = (s?: RCSAData["status"] | null) => {
  if (s === "reviewed") return "bg-blue-600 text-white";
  if (s === "submitted") return "bg-amber-500 text-white";
  return "bg-gray-500 text-white";
};

const getLevelFromBesaran = (value: number | null) => {
  if (!value) return { label: "-", color: "bg-gray-200 text-gray-700" };
  if (value >= 20) return { label: "Sangat Tinggi", color: "bg-red-700 text-white" };
  if (value >= 12) return { label: "Tinggi", color: "bg-red-500 text-white" };
  if (value >= 5) return { label: "Menengah", color: "bg-yellow-400 text-black" };
  return { label: "Rendah", color: "bg-green-500 text-white" };
};

export function RcsaReportTable({ data }: { data: RCSAData[] }) {
  return (
    <div className="relative border rounded-lg shadow-lg w-full flex flex-col bg-white">
      <div className="flex-1 overflow-auto">
        <table className="min-w-[4200px] divide-y divide-gray-200 border-gray-300">
          <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-300">
            {/* HEADER 1 */}
            <tr className="text-[12px] font-medium text-gray-600 uppercase tracking-wider">
              <th className="px-3 py-3 text-center w-[40px] sticky left-0 bg-gray-50 border-r border-gray-300">
                No
              </th>
              <th className="px-3 py-3 text-center w-[200px] bg-gray-50 border-r border-gray-300">
                Unit Kerja
              </th>
              <th className="px-3 py-3 text-center w-[320px] bg-gray-50 border-r border-gray-300">
                Potensi Risiko
              </th>
              <th className="px-3 py-3 text-center w-[160px] bg-gray-50 border-r border-gray-300">
                Jenis Risiko
              </th>
              <th className="px-3 py-3 text-center w-[320px] bg-gray-50 border-r border-gray-300">
                Penyebab Risiko
              </th>

              <th colSpan={4} className="px-3 py-2 text-center bg-yellow-100 border-x border-gray-300">
                Risiko Inheren
              </th>

              <th className="px-3 py-3 text-center w-[320px] bg-gray-50 border-r border-gray-300">
                Pengendalian/Mitigasi Risiko (User)
              </th>

              <th colSpan={4} className="px-3 py-2 text-center bg-blue-100 border-x border-gray-300">
                Risiko Residual
              </th>

              <th className="px-3 py-3 text-center w-[320px] bg-gray-50 border-r border-gray-300">
                Action Plan/Mitigasi
              </th>
              <th className="px-3 py-3 text-center w-[160px] bg-gray-50 border-r border-gray-300">
                PIC
              </th>

              {/* Kolom laporan */}
              <th className="px-3 py-3 text-center w-[120px] bg-gray-50 border-r border-gray-300">
                Status
              </th>
              <th className="px-3 py-3 text-center w-[120px] bg-gray-50 border-r border-gray-300">
                Decision
              </th>
              <th className="px-3 py-3 text-center w-[180px] bg-gray-50 border-r border-gray-300">
                Reviewer
              </th>
              <th className="px-3 py-3 text-center w-[180px] bg-gray-50 border-r border-gray-300">
                Reviewed At
              </th>
              <th className="px-3 py-3 text-center w-[380px] bg-gray-50">
                Note
              </th>
            </tr>

            {/* HEADER 2 */}
            <tr className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
              <th colSpan={5} className="bg-gray-50 border-r border-gray-300" />

              <th className="bg-yellow-200 border-r border-gray-300">Dampak</th>
              <th className="bg-yellow-200 border-r border-gray-300">Frekuensi</th>
              <th className="bg-yellow-200 border-r border-gray-300">Besaran</th>
              <th className="bg-yellow-200 border-r border-gray-300">Level</th>

              <th className="bg-gray-50 border-r border-gray-300" />

              <th className="bg-blue-200 border-r border-gray-300">Dampak</th>
              <th className="bg-blue-200 border-r border-gray-300">Kemungkinan</th>
              <th className="bg-blue-200 border-r border-gray-300">Besaran</th>
              <th className="bg-blue-200 border-r border-gray-300">Level</th>

              <th colSpan={7} className="bg-gray-50" />
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row) => {
              const besaranInheren =
                row.dampakInheren && row.frekuensiInheren ? row.dampakInheren * row.frekuensiInheren : null;
              const levelInheren = getLevelFromBesaran(besaranInheren);

              const besaranResidual =
                row.dampakResidual && row.kemungkinanResidual ? row.dampakResidual * row.kemungkinanResidual : null;
              const levelResidual = getLevelFromBesaran(besaranResidual);

              return (
                <tr key={row.id} className="text-xs text-gray-800 hover:bg-gray-50 transition-colors">
                  <td className="text-center sticky left-0 bg-white border-r border-gray-200 font-semibold">
                    {row.no}
                  </td>

                  <td className="px-2 py-2 border-r border-gray-200">{row.unit_name}</td>
                  <td className="px-2 py-2 border-r border-gray-200">{row.potensiRisiko}</td>
                  <td className="px-2 py-2 border-r border-gray-200">{row.jenisRisiko ?? "-"}</td>

                  <td className="px-2 py-1 border-r border-gray-200">
                    <Textarea
                      value={row.penyebabRisiko ?? ""}
                      readOnly
                      className="h-10 text-xs resize-y"
                    />
                  </td>

                  {/* Inheren */}
                  <td className="bg-yellow-50 border-r border-gray-200 text-center">{row.dampakInheren ?? "-"}</td>
                  <td className="bg-yellow-50 border-r border-gray-200 text-center">{row.frekuensiInheren ?? "-"}</td>
                  <td className="bg-yellow-100 border-r border-gray-200 text-center font-bold">{besaranInheren ?? "-"}</td>
                  <td className="border-r border-gray-200 text-center">
                    <span className={`px-2 py-0.5 rounded ${levelInheren.color}`}>{levelInheren.label}</span>
                  </td>

                  {/* Pengendalian */}
                  <td className="px-2 py-1 border-r border-gray-200">
                    <Textarea value={(row as any).pengendalian ?? ""} readOnly className="h-10 text-xs resize-y" />
                  </td>

                  {/* Residual */}
                  <td className="bg-blue-50 border-r border-gray-200 text-center">{row.dampakResidual ?? "-"}</td>
                  <td className="bg-blue-50 border-r border-gray-200 text-center">{row.kemungkinanResidual ?? "-"}</td>
                  <td className="bg-blue-100 border-r border-gray-200 text-center font-bold">{besaranResidual ?? "-"}</td>
                  <td className="border-r border-gray-200 text-center">
                    <span className={`px-2 py-0.5 rounded ${levelResidual.color}`}>{levelResidual.label}</span>
                  </td>

                  {/* Action/PIC */}
                  <td className="px-2 py-1 border-r border-gray-200">
                    <Textarea value={row.actionPlan ?? ""} readOnly className="h-10 text-xs resize-y" />
                  </td>
                  <td className="px-2 py-2 border-r border-gray-200">{row.pic ?? "-"}</td>

                  {/* Status/Decision/Reviewer/ReviewedAt/Note */}
                  <td className="px-2 py-2 border-r border-gray-200 text-center">
                    <Badge className={badgeStatus(row.status)}>{row.status ?? "-"}</Badge>
                  </td>
                  <td className="px-2 py-2 border-r border-gray-200 text-center">
                    <Badge className={badgeDecision(row.decision)}>{row.decision ?? "-"}</Badge>
                  </td>
                  <td className="px-2 py-2 border-r border-gray-200">{(row as any).reviewer_name ?? "-"}</td>
                  <td className="px-2 py-2 border-r border-gray-200">{(row as any).reviewed_at ?? "-"}</td>
                  <td className="px-2 py-2">
                    <Textarea value={(row as any).note ?? ""} readOnly className="h-10 text-xs resize-y" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
