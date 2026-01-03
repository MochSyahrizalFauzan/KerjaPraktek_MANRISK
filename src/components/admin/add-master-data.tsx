'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from "@/context/auth-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { RCSAData } from '@/lib/rcsa-data';
import { createMasterRCSA } from '@/lib/rcsa-master-data';
import { SearchableSelect } from "@/components/ui/searchable-select";


type AddMasterDataModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<RCSAData, 'no'>) => void;
};

type Unit = {
  id: number;
  unit_name: string;
  parent_id: number | null;
};

export function AddMasterDataModal({
  isOpen,
  onClose,
  onSave,
}: AddMasterDataModalProps) {
  const { user } = useAuth();
  const [parents, setParents] = useState<Unit[]>([]);
  const [children, setChildren] = useState<Unit[]>([]);
  const [selectedParent, setSelectedParent] = useState<string>('');
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [potensiRisiko, setPotensiRisiko] = useState('');
  const [keterangan, setKeterangan] = useState('');

  // Ambil daftar parent (unit dengan parent_id = null)
  useEffect(() => {
    fetch("http://localhost:5000/units?parent_id=null")
      .then((res) => res.json())
      .then((data) => {
        setParents(data);
      })
      .catch((err) => console.error("❌ Gagal fetch parents:", err));
  }, []);

  // Ambil daftar anak (children) saat parent dipilih
  useEffect(() => {
    if (!selectedParent) {
      setChildren([]);
      return;
    }

    const parentId = Number(selectedParent);

    fetch(`http://localhost:5000/units?parent_id=${parentId}`)
      .then((res) => res.json())
      .then((data) => {
        // Jangan tampilkan parent lagi di dropdown anak
        const filtered = data.filter((u: Unit) => u.id !== parentId);
        setChildren(filtered);
      })
      .catch((err) => console.error("❌ Gagal fetch anak:", err));
  }, [selectedParent]);

  const isTargetSelected = useMemo(() => {
    return Boolean(selectedChild || selectedParent);
  }, [selectedParent, selectedChild]);

  const isSaveDisabled = useMemo(() => {
    return !isTargetSelected || !potensiRisiko;
  }, [isTargetSelected, potensiRisiko]);

  //  Simpan master baru
  const handleSave = async () => {
    const unitId = selectedChild ? Number(selectedChild) : Number(selectedParent);

    if (!user) {
      console.error("❌ User belum login, tidak bisa simpan");
      return;
    }

    try {
      const newMaster = await createMasterRCSA({
        rcsa_name: potensiRisiko,
        description: keterangan,
        unit_id: unitId,
        created_by: user.id,
      });

      if (newMaster) {
        const selectedUnit = [...parents, ...children].find((u) => u.id === unitId);
        onSave({
          id: newMaster.id,
          unit_id: newMaster.unit_id,
          potensiRisiko,
          keteranganAdmin: keterangan,
          keteranganUser: "",
          jenisRisiko: null,
          penyebabRisiko: null,
          dampakInheren: null,
          frekuensiInheren: null,
          pengendalian: null,
          dampakResidual: null,
          kemungkinanResidual: null,
          actionPlan: null,
          pic: null,
          unit_name: selectedUnit?.unit_name ?? "Unit Tidak Diketahui",
          unit_type: "",
        });
        resetForm();
        onClose();
      }
    } catch (err) {
      console.error("❌ handleSave error:", err);
    }
  };

  const resetForm = () => {
    setSelectedParent('');
    setSelectedChild('');
    setPotensiRisiko('');
    setKeterangan('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Tambah Master Risiko Baru</DialogTitle>
          <DialogDescription>
            Pilih unit induk terlebih dahulu, lalu pilih unit anak (jika ada).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Step 1: Pilih Parent dan Child */}
          <div className="space-y-4 rounded-md border p-4">
            <h4 className="font-semibold text-sm">Langkah 1: Pilih Unit</h4>

            {/* Parent dropdown */}
{/* Parent dropdown */}
<div className="space-y-2">
  <Label>Unit Induk</Label>
  <SearchableSelect
    value={selectedParent}
    onValueChange={(value) => {     
      setSelectedParent(value);
      setSelectedChild('');
    }}
    options={parents.map((u) => ({
      value: String(u.id),
      label: u.unit_name,
    }))}
    placeholder="Pilih unit induk..."
  />
</div>

{/* Child dropdown */}
{children.length > 0 && (
  <div className="space-y-2">
    <Label>Unit Anak</Label>
    <SearchableSelect
      value={selectedChild}
      onValueChange={(value) => setSelectedChild(value)}  // 🔄 Ganti dari onChange
      options={children.map((u) => ({
        value: String(u.id),
        label: u.unit_name,
      }))}
      placeholder="Pilih unit anak..."
    />
  </div>
)}


          </div>

          {/* Step 2: Isi Detail Risiko */}
          {isTargetSelected && (
            <div className="space-y-4 rounded-md border p-4">
              <h4 className="font-semibold text-sm">Langkah 2: Isi Detail Risiko</h4>

              <div className="space-y-2">
                <Label htmlFor="potensi-risiko">Potensi Risiko</Label>
                <Textarea
                  id="potensi-risiko"
                  placeholder="Contoh: Terdapat selisih KAS Teller"
                  value={potensiRisiko}
                  onChange={(e) => setPotensiRisiko(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="keterangan">Keterangan Tambahan (Opsional)</Label>
                <Textarea
                  id="keterangan"
                  placeholder="Informasi tambahan..."
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  className="min-h-[60px]"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={isSaveDisabled}>
            Simpan Master Risiko
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
