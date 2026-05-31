import React, { useState, useEffect } from "react";
import { doc, collection, writeBatch, deleteField } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../../../lib/firebase";
import { X, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { Input, Select, Button } from "./SharedUI";

export function DriverEditModal({ isOpen, onClose, isEditing, upts, vehicles, onNotify, profile, onSuccess }: any) {
  const [loading, setLoading] = useState(false);
  const [modalUpts, setModalUpts] = useState<string[]>([]);
  const [jabatan, setJabatan] = useState("");
  const [statusAsn, setStatusAsn] = useState("");
  const [nip, setNip] = useState("");
  const [phone, setPhone] = useState("");

  // Log Activity Helper Localized/Passed
  const logActivity = async (
    category: 'login' | 'operasional' | 'perubahan_data' | 'sistem',
    action: string,
    module: string,
    description: string,
    extra: any = {}
  ) => {
    try {
      const currentProfile = extra.profile;
      if (!currentProfile) return;
      const actorName = (currentProfile.operator_name || currentProfile.username || "-") + 
                      (currentProfile.account_name ? ` - ${currentProfile.account_name}` : 
                       (currentProfile.assigned_upt_name ? ` - ${currentProfile.assigned_upt_name}` : ""));

      const logData: any = {
        timestamp: new Date(),
        category,
        action,
        module,
        description,
        recordId: extra.recordId || "",
        recordLabel: extra.recordLabel || "",
        beforeData: extra.beforeData || null,
        afterData: extra.afterData || null,
        metadata: extra.metadata || null,
        performedBy: {
          userId: currentProfile.userId,
          username: currentProfile.username,
          operatorName: currentProfile.operator_name || "-",
          accountName: currentProfile.account_name || "-",
          role: currentProfile.role,
          uptId: currentProfile.assigned_upt_id || "-",
          uptName: currentProfile.assigned_upt_name || "-"
        }
      };
      const logsRef = collection(db, "activity_logs");
      const { addDoc, serverTimestamp: firestoreServerTimestamp } = await import("firebase/firestore");
      logData.timestamp = firestoreServerTimestamp();
      await addDoc(logsRef, logData);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "activity_logs");
    }
  };

  useEffect(() => {
    if (isEditing && isOpen) {
      setModalUpts(isEditing.upts || (isEditing.upt ? [isEditing.upt] : []));
      setJabatan(isEditing.jabatan || "");
      setStatusAsn(isEditing.status_asn || "");
      setNip(isEditing.nip || "");
      setPhone(isEditing.phone || "");
    } else if (!isEditing && isOpen) {
      setModalUpts([]);
      setJabatan("");
      setStatusAsn("");
      setNip("");
      setPhone("");
    }
  }, [isEditing, isOpen]);

  const saveData = async (data: any) => {
    setLoading(true);
    const path = isEditing ? `drivers/${isEditing.id}` : "drivers";
    try {
      const batch = writeBatch(db);
      let driverRef;
      const uploadData: any = { ...data };
      if (isEditing) {
        uploadData.upt = deleteField();
        driverRef = doc(db, "drivers", isEditing.id);
        batch.update(driverRef, uploadData);
      } else {
        driverRef = doc(collection(db, "drivers"));
        batch.set(driverRef, uploadData);
      }

      if (data.vehiclePlate) {
        const oldVehicles = vehicles.filter((v: any) => v.defaultDriverName === data.name && v.plateNumber !== data.vehiclePlate);
        oldVehicles.forEach((v: any) => batch.update(doc(db, "vehicles", v.id), { defaultDriverName: "", upt: deleteField() }));
        const newVehicle = vehicles.find((v: any) => v.plateNumber === data.vehiclePlate);
        if (newVehicle) batch.update(doc(db, "vehicles", newVehicle.id), { defaultDriverName: data.name, upts: data.upts, upt: deleteField() });
      } else if (isEditing?.vehiclePlate) {
        const oldVehicle = vehicles.find((v: any) => v.plateNumber === isEditing.vehiclePlate && v.defaultDriverName === data.name);
        if (oldVehicle) batch.update(doc(db, "vehicles", oldVehicle.id), { defaultDriverName: "", upt: deleteField() });
      }

      await batch.commit();
      logActivity('perubahan_data', isEditing ? 'edit_personil' : 'tambah_personil', 'Master Personil', `${isEditing ? 'Pembaruan' : 'Registrasi'} personil: ${data.name}`, 
        { recordId: isEditing?.id || "", recordLabel: data.name, beforeData: isEditing, afterData: data, profile });

      onNotify('success', isEditing ? 'Data personil diperbarui' : 'Personil baru ditambahkan');
      onSuccess();
    } catch (error) {
      handleFirestoreError(error, isEditing ? OperationType.UPDATE : OperationType.CREATE, path);
      onNotify('error', 'Gagal menyimpan data personil');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    
    // Validation
    const needsNip = ["ASN", "PPPK", "PPPK Paruh Waktu"].includes(statusAsn);
    if (needsNip && !nip.trim()) {
      onNotify('error', `NIP wajib diisi untuk status ${statusAsn}`);
      return;
    }

    await saveData({ 
      name, 
      shift: formData.get("shift") as string || "", 
      upts: modalUpts, 
      vehiclePlate: formData.get("vehiclePlate") as string || "",
      jabatan,
      status_asn: statusAsn,
      nip: needsNip ? nip.trim() : (nip.trim() || null),
      phone: phone.trim()
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-slate-900 rounded-2xl w-full max-w-md p-8 border border-slate-800 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        <h3 className="text-xl font-bold text-white mb-6 uppercase tracking-tight">{isEditing ? "Edit Personil" : "Tambah Personil"}</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 p-4 bg-slate-950 border border-slate-800 rounded-xl">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Identitas Personil</h4>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Nama Lengkap" name="name" required defaultValue={isEditing?.name} placeholder="Ahmad..." />
              <Input label="Nomor HP" value={phone} onChange={(e: any) => setPhone(e.target.value)} placeholder="0812..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select label="Jabatan" value={jabatan} onChange={(e: any) => setJabatan(e.target.value)} options={[
                { label: "Pilih Jabatan", value: "" },
                { label: "Supir", value: "Supir" },
                { label: "Kenek", value: "Kenek" },
                { label: "Petugas", value: "Petugas" },
                { label: "Koordinator", value: "Koordinator" },
                { label: "Lainnya", value: "Lainnya" }
              ]} />
              <Select label="Shift Kerja" name="shift" defaultValue={isEditing?.shift || ""} options={[
                { label: "Tanpa Shift", value: "" }, { label: "Shift 1 (Pagi)", value: "Shift 1" }, { label: "Shift 2 (Siang)", value: "Shift 2" }, { label: "Shift 3 (Malam)", value: "Shift 3" },
              ]} />
            </div>
          </div>

          <div className="flex flex-col gap-4 p-4 bg-slate-950 border border-slate-800 rounded-xl">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Data Kepegawaian</h4>
            <div className="grid grid-cols-2 gap-4">
              <Select label="Status Kepegawaian" value={statusAsn} onChange={(e: any) => setStatusAsn(e.target.value)} options={[
                { label: "Pilih Status", value: "" },
                { label: "ASN", value: "ASN" },
                { label: "PPPK", value: "PPPK" },
                { label: "PPPK Paruh Waktu", value: "PPPK Paruh Waktu" },
                { label: "Alih Daya", value: "Alih Daya" },
              ]} />
              {["ASN", "PPPK", "PPPK Paruh Waktu"].includes(statusAsn) ? (
                <Input label="NIP / NI PPPK" value={nip} onChange={(e: any) => setNip(e.target.value)} required placeholder="19XXXXXXXXXX..." />
              ) : (
                <Input label="NIP (Opsional)" value={nip} onChange={(e: any) => setNip(e.target.value)} placeholder="-" />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Koneksi Wilayah UPT</label>
            <div className="grid grid-cols-1 gap-2 p-3 bg-slate-950 border border-slate-800 rounded-xl max-h-40 overflow-y-auto">
              <label className="flex items-center gap-2 cursor-pointer group pb-2 border-b border-slate-800/50 mb-1">
                <input type="checkbox" checked={modalUpts.length === 0} onChange={(e) => e.target.checked && setModalUpts([])} className="w-4 h-4 rounded border-slate-800 bg-slate-900 text-emerald-500" />
                <span className="text-[10px] font-bold text-slate-500 group-hover:text-slate-300 transition-colors uppercase tracking-widest">Tanpa UPT</span>
              </label>
              {upts.map((u: any) => (
                <label key={u.id} className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" checked={modalUpts.includes(u.name)} onChange={(e) => {
                    if (e.target.checked) setModalUpts([...modalUpts, u.name]);
                    else setModalUpts(modalUpts.filter(item => item !== u.name));
                  }} className="w-4 h-4 rounded border-slate-800 bg-slate-900 text-emerald-500" />
                  <span className="text-xs text-slate-400 group-hover:text-slate-200">{u.name}</span>
                </label>
              ))}
            </div>
          </div>
          <Select label="Kendaraan Utama" name="vehiclePlate" defaultValue={isEditing?.vehiclePlate} placeholder="Pilih..." options={[
            { label: "Tanpa Kendaraan", value: "" },
            ...vehicles.filter((v: any) => modalUpts.length === 0 ? (!v.upts || v.upts.length === 0) : v.upts?.some((u: string) => modalUpts.includes(u)) || modalUpts.includes(v.upt))
              .map((v: any) => ({ label: v.defaultDriverName && v.defaultDriverName !== (isEditing?.name || "") ? `${v.plateNumber} (${v.defaultDriverName})` : v.plateNumber, value: v.plateNumber }))
          ]} />
          <div className="flex gap-4 mt-6">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Batal</Button>
            <Button type="submit" disabled={loading} className="flex-1">{loading ? <Loader2 className="animate-spin text-white w-4 h-4" /> : "Simpan"}</Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
