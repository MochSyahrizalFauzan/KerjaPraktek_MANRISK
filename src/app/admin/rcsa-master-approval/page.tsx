"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";

type InboxRow = {
  // penting: kalau backend sudah kirim approval_id, pakai itu untuk key unik
  approval_id?: number;

  id: number; // rcsa_master_id
  rcsa_name: string;
  description: string | null;
  status: string;
  created_at: string;
  created_by_name: string | null;

  target_unit_count?: number;
  target_units?: string | null; // "Unit A, Unit B, ..."
};

export default function RcsaMasterApprovalInbox() {
  const { toast } = useToast();
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [openReview, setOpenReview] = useState(false);
  const [selected, setSelected] = useState<InboxRow | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [openUnits, setOpenUnits] = useState(false);
  const [unitsText, setUnitsText] = useState<string>("");

  const load = async () => {
    try {
      setLoading(true);
      const data = await api<InboxRow[]>("/rcsa/master/approval/inbox");
      setRows(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // NOTE: kalau kamu pakai React Strict Mode (dev), effect bisa jalan 2x.
    // Tapi tidak akan looping kalau state update normal.
  }, []);

  const openModalReview = (row: InboxRow) => {
    setSelected(row);
    setNote("");
    setOpenReview(true);
  };

  const openModalUnits = (row: InboxRow) => {
    const txt =
      row.target_units?.trim() ||
      (row.target_unit_count ? `${row.target_unit_count} unit` : "-");
    setUnitsText(txt);
    setOpenUnits(true);
  };

  const submitDecision = async (decision: "approved" | "rejected") => {
    if (!selected) return;

    if (!note.trim()) {
      toast({ title: "Validasi", description: "Catatan wajib diisi" });
      return;
    }

    try {
      setSaving(true);
      await api(`/rcsa/master/${selected.id}/decision`, {
        method: "POST",
        json: { decision, note: note.trim() },
      });

      toast({ title: "Sukses", description: `Master ${decision}` });
      setOpenReview(false);
      setSelected(null);
      await load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const parsedRows = useMemo(() => {
    // pastikan tidak ada undefined yang bikin render aneh
    return rows.map((r) => {
      const count = r.target_unit_count ?? (r.target_units ? r.target_units.split(",").length : 0);
      const list = (r.target_units || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      return {
        ...r,
        _targetCount: count || 0,
        _targetList: list,
      };
    });
  }, [rows]);

  if (loading) return <div className="p-6">Memuat...</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Approval Master RCSA</h1>
        <p className="text-sm text-muted-foreground">
          Daftar master yang menunggu persetujuan (ditugaskan ke approver yang memiliki hak approve).
        </p>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="p-3 text-left">Master</th>
                <th className="p-3 text-left">Target Unit</th>
                <th className="p-3 text-right w-[140px]">Aksi</th>
              </tr>
            </thead>

            <tbody>
              {parsedRows.map((r, idx) => {
                // KEY: utamakan approval_id (unik per approval row)
                // fallback gabungan aman
                const key = r.approval_id ?? `${r.id}-${idx}`;

                const unitPreview =
                  r._targetList.length > 0
                    ? r._targetList.slice(0, 6).join(", ")
                    : "-";

                const showSeeAll =
                  (r.target_units && r.target_units.length > 120) || r._targetList.length > 6;

                return (
                  <tr key={key} className="border-t align-top">
                    {/* MASTER */}
                    <td className="p-3">
                      <div className="font-medium">{r.rcsa_name}</div>

                      {r.description ? (
                        <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {r.description}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground mt-1">-</div>
                      )}

                      <div className="text-xs text-muted-foreground mt-2">
                        <span className="font-medium">Dibuat oleh:</span>{" "}
                        {r.created_by_name ?? "-"}{" "}
                        <span className="mx-1">•</span>
                        {formatDate(r.created_at)}
                      </div>
                    </td>

                    {/* TARGET UNIT */}
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {r._targetCount ? `${r._targetCount} unit` : "0 unit"}
                        </Badge>
                      </div>

                      <div className="text-xs text-muted-foreground mt-2 leading-relaxed">
                        {unitPreview}
                      </div>

                      {showSeeAll && (
                        <div className="mt-2">
                          <Button
                            type="button"
                            variant="link"
                            className="h-auto p-0 text-xs"
                            onClick={() => openModalUnits(r)}
                          >
                            Lihat semua target unit
                          </Button>
                        </div>
                      )}
                    </td>

                    {/* AKSI */}
                    <td className="p-3 text-right">
                      <Button size="sm" onClick={() => openModalReview(r)}>
                        Review
                      </Button>
                    </td>
                  </tr>
                );
              })}

              {parsedRows.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-6 text-center text-muted-foreground">
                    Tidak ada approval yang pending untuk Anda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: LIHAT SEMUA TARGET UNIT */}
      <Dialog open={openUnits} onOpenChange={setOpenUnits}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Target Unit</DialogTitle>
          </DialogHeader>

          <div className="text-sm text-muted-foreground whitespace-pre-wrap">
            {unitsText || "-"}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenUnits(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: REVIEW MASTER */}
      <Dialog open={openReview} onOpenChange={setOpenReview}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Master</DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-3">
              <div className="rounded-lg border p-3">
                <div className="font-medium">{selected.rcsa_name}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {selected.description ?? "-"}
                </div>

                <div className="text-xs text-muted-foreground mt-2">
                  <span className="font-medium">Target Unit:</span>{" "}
                  {selected.target_unit_count
                    ? `${selected.target_unit_count} unit`
                    : "-"}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-1">Catatan Reviewer</div>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Tulis alasan approve/reject..."
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpenReview(false)}>
              Tutup
            </Button>
            <Button
              variant="destructive"
              onClick={() => submitDecision("rejected")}
              disabled={saving}
            >
              <XCircle className="mr-2 h-4 w-4" /> Reject
            </Button>
            <Button onClick={() => submitDecision("approved")} disabled={saving}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
