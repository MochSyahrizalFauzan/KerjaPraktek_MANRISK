"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type ReviewItem = {
  assessment_id: number;
  potensi_risiko: string;
  unit_name: string;
  decision: "approved" | "rejected" | null;
  note: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
};

export default function RcsaReviewPage() {
  const { toast } = useToast();
  const [data, setData] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:5000/rcsa/assessment/mine-reviewed", {
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Request failed");
        return res.json();
      })
      .then(setData)
      .catch(() =>
        toast({
          title: "Gagal memuat data",
          variant: "destructive",
        })
      )
      .finally(() => setLoading(false));
  }, [toast]);

  if (loading) return <p className="p-6">Memuat riwayat review...</p>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Riwayat Review RCSA</h1>

      {data.length === 0 && (
        <p className="text-muted-foreground">
          Belum ada assessment yang direview (status reviewed).
        </p>
      )}

      {data.map((r) => (
        <div key={r.assessment_id} className="border rounded-lg p-4 bg-white">
          <div className="flex justify-between items-center">
            <div>
              <div className="font-semibold">{r.potensi_risiko}</div>
              <div className="text-sm text-muted-foreground">
                Unit: {r.unit_name}
                {r.reviewer_name ? ` • Reviewer: ${r.reviewer_name}` : ""}
              </div>
            </div>

            {r.decision ? (
              <Badge className={r.decision === "approved" ? "bg-green-600" : "bg-red-600"}>
                {r.decision.toUpperCase()}
              </Badge>
            ) : (
              <Badge className="bg-gray-500">NO DECISION</Badge>
            )}
          </div>

          <div className="mt-3 text-sm">
            <b>Catatan Reviewer:</b>
            <p className="mt-1 text-muted-foreground">{r.note || "-"}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
