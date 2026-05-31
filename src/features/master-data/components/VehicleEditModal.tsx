import React, { useState, useEffect } from "react";
import { doc, collection, writeBatch, deleteField } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../../../lib/firebase";
import { X, Plus, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { Input, Select, Button } from "./SharedUI";

export function VehicleEditModal({ isOpen, onClose, isEditing, upts, drivers, onNotify, profile, onSuccess }: any) {
  const [loading, setLoading] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [modalUpts, setModalUpts] = useState<string[]>([]);
  const [ritaseTonnage, setRitaseTonnage] = useState<{ [upt: string]: { [rit: number]: number } }>({});
  const [activeRitaseUpt, setActiveRitaseUpt] = useState<string>("");
  const [status, setStatus] = useState<'Aktif' | 'Tidak Aktif'>('Aktif');
  const [statusDescription, setStatusDescription] = useState("");
  const [doBbm, setDoBbm] = useState<number | string>("");
  const [tahunPengadaan, setTahunPengadaan] = useState<number | string>("");
  const [nomorRangka, setNomorRangka] = useState("");
  const [nomorMesin, setNomorMesin] = useState("");

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
        timestamp: new Date(), // fallback if Firestore is not loaded, but typically serverTimestamp is ideal
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
      const editingUpts = isEditing.upts || (isEditing.upt ? [isEditing.upt] : []);
      setModalUpts(editingUpts);
      setRitaseTonnage(isEditing.ritaseTonnage || {});
      setActiveRitaseUpt(editingUpts[0] || "");
      setStatus(isEditing.status || 'Aktif');
      setStatusDescription(isEditing.status_description || "");
      const rawBbm = isEditing.do_bbm !== undefined ? isEditing.do_bbm : (isEditing.bbm && !isNaN(Number(isEditing.bbm)) ? isEditing.bbm : "");
      setDoBbm(rawBbm || "");
      setTahunPengadaan(isEditing.tahun_pengadaan || "");
      setNomorRangka(isEditing.nomor_rangka || "");
      setNomorMesin(isEditing.nomor_mesin || "");
    } else if (!isEditing && isOpen) {
      setModalUpts([]);
      setRitaseTonnage({});
      setActiveRitaseUpt("");
      setStatus('Aktif');
      setStatusDescription("");
      setDoBbm("");
      setTahunPengadaan("");
      setNomorRangka("");
      setNomorMesin("");
    }
  }, [isEditing, isOpen]);

  useEffect(() => {
    if (modalUpts.length > 0 && !modalUpts.includes(activeRitaseUpt)) {
      setActiveRitaseUpt(modalUpts[0]);
    } else if (modalUpts.length === 0) {
      setActiveRitaseUpt("");
    }
  }, [modalUpts]);

  const addRitaseTonnage = () => {
    const uptKey = activeRitaseUpt || "default";
    const currentUptRit = ritaseTonnage[uptKey] || {};
    const nextRit = Object.keys(currentUptRit).length > 0 
      ? Math.max(...Object.keys(currentUptRit).map(Number)) + 1 
      : 1;
    setRitaseTonnage({ ...ritaseTonnage, [uptKey]: { ...currentUptRit, [nextRit]: 0 } });
  };

  const updateRitaseTonnage = (rit: number, val: number) => {
    const uptKey = activeRitaseUpt || "default";
    setRitaseTonnage({ ...ritaseTonnage, [uptKey]: { ...(ritaseTonnage[uptKey] || {}), [rit]: val } });
  };

  const removeRitaseTonnage = (rit: number) => {
    const uptKey = activeRitaseUpt || "default";
    const newUptRit = { ...(ritaseTonnage[uptKey] || {}) };
    delete newUptRit[rit];
    setRitaseTonnage({ ...ritaseTonnage, [uptKey]: newUptRit });
  };

  const saveData = async (data: any) => {
    setLoading(true);
    const path = isEditing ? `vehicles/${isEditing.id}` : "vehicles";
    try {
      const batch = writeBatch(db);
      let vehicleRef;
      const uploadData: any = { ...data };
      if (isEditing) {
        uploadData.upt = deleteField();
        vehicleRef = doc(db, "vehicles", isEditing.id);
        batch.update(vehicleRef, uploadData);
      } else {
        vehicleRef = doc(collection(db, "vehicles"));
        batch.set(vehicleRef, uploadData);
      }

      if (data.defaultDriverName) {
        const oldDrivers = drivers.filter((d: any) => d.vehiclePlate === data.plateNumber && d.name !== data.defaultDriverName);
        oldDrivers.forEach((d: any) => {
          batch.update(doc(db, "drivers", d.id), { vehiclePlate: "", upt: deleteField() });
        });
        const newDriver = drivers.find((d: any) => d.name === data.defaultDriverName);
        if (newDriver) {
          batch.update(doc(db, "drivers", newDriver.id), { vehiclePlate: data.plateNumber, upts: data.upts, upt: deleteField() });
        }
      } else if (isEditing?.defaultDriverName) {
         const oldDriver = drivers.find((d: any) => d.name === isEditing.defaultDriverName);
         if (oldDriver) batch.update(doc(db, "drivers", oldDriver.id), { vehiclePlate: "", upt: deleteField() });
      }

      await batch.commit();

      logActivity('perubahan_data', isEditing ? 'edit_kendaraan' : 'tambah_kendaraan', 'Master Kendaraan', 
        `${isEditing ? 'Pembaruan' : 'Registrasi'} kendaraan: ${data.plateNumber}`,
        { recordId: isEditing?.id || "", recordLabel: data.plateNumber, beforeData: isEditing, afterData: data, profile });

      onNotify('success', isEditing ? 'Data kendaraan diperbarui' : 'Kendaraan baru ditambahkan');
      onSuccess();
    } catch (error) {
      handleFirestoreError(error, isEditing ? OperationType.UPDATE : OperationType.CREATE, path);
      onNotify('error', 'Gagal menyimpan data kendaraan');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitAttempted(true);
    const formData = new FormData(e.currentTarget);
    
    if (status === 'Tidak Aktif' && !statusDescription.trim()) {
      onNotify('error', 'Keterangan wajib diisi jika kendaraan tidak aktif');
      return;
    }

    const data = {
      plateNumber: formData.get("plateNumber") as string,
      type: formData.get("type") as string,
      status: status,
      status_description: status === 'Tidak Aktif' ? statusDescription : "",
      upts: modalUpts,
      defaultDriverName: formData.get("defaultDriverName") as string || "",
      ritaseTonnage: ritaseTonnage,
      do_bbm: doBbm ? Number(doBbm) : null,
      tahun_pengadaan: tahunPengadaan ? Number(tahunPengadaan) : null,
      nomor_rangka: nomorRangka.trim().toUpperCase(),
      nomor_mesin: nomorMesin.trim().toUpperCase(),
    };
    await saveData(data);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-slate-900 rounded-2xl w-full max-w-md p-8 border border-slate-800 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
        <h3 className="text-xl font-bold text-white mb-6 uppercase tracking-tight">{isEditing ? "Edit Kendaraan" : "Tambah Kendaraan"}</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Nomor Polisi" name="plateNumber" required showError={submitAttempted && !isEditing?.plateNumber} defaultValue={isEditing?.plateNumber} placeholder="BE 1234 XX" />
            <Select label="Jenis Kendaraan" name="type" required showError={submitAttempted && !isEditing?.type} defaultValue={isEditing?.type} options={["Motor Roda 3", "Arm Roll", "Dump Truck", "Pick Up"]} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select 
              label="Status Kendaraan" 
              name="status" 
              required 
              showError={submitAttempted && !status}
              value={status} 
              onChange={(e: any) => setStatus(e.target.value)}
              options={[
                { value: 'Aktif', label: 'Aktif' },
                { value: 'Tidak Aktif', label: 'Tidak Aktif' }
              ]} 
            />
            {status === 'Tidak Aktif' ? (
              <Input 
                label="Keterangan (Wajib)" 
                name="status_description" 
                required 
                showError={submitAttempted && !statusDescription.trim()}
                value={statusDescription}
                onChange={(e: any) => setStatusDescription(e.target.value)}
                placeholder="Alasan tidak aktif (Rusak/Servis/dsb)" 
              />
            ) : (
              <div className="hidden md:block" />
            )}
          </div>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Wilayah UPT</label>
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

          <Select label="Personil Utama" name="defaultDriverName" defaultValue={isEditing?.defaultDriverName} options={[
            { label: "Tanpa Personil", value: "" },
            ...drivers.filter((d: any) => modalUpts.length === 0 ? (!d.upts || d.upts.length === 0) : d.upts?.some((u: string) => modalUpts.includes(u)) || modalUpts.includes(d.upt))
              .map((d: any) => ({ label: d.vehiclePlate && d.vehiclePlate !== isEditing?.plateNumber ? `${d.name} (di ${d.vehiclePlate})` : d.name, value: d.name }))
          ]} />

          <div className="flex flex-col gap-4 p-4 bg-slate-950 border border-slate-800 rounded-xl">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Data Teknis Aset</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Input 
                  label="DO BBM" 
                  type="number" 
                  step="any"
                  value={doBbm} 
                  onChange={(e: any) => setDoBbm(e.target.value)}
                  placeholder="Contoh: 18" 
                />
                <span className="text-[8px] text-slate-500 font-medium ml-1">Daily Allowance: Liter/Hari</span>
              </div>
              <Select 
                label="Tahun Pengadaan" 
                value={tahunPengadaan} 
                onChange={(e: any) => setTahunPengadaan(e.target.value)}
                options={[
                  { label: "Pilih Tahun", value: "" },
                  ...Array.from({ length: new Date().getFullYear() - 1980 + 1 }, (_, i) => {
                    const year = new Date().getFullYear() - i;
                    return { label: year.toString(), value: year.toString() };
                  })
                ]} 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Nomor Rangka" value={nomorRangka} onChange={(e: any) => setNomorRangka(e.target.value)} placeholder="MHX..." />
              <Input label="Nomor Mesin" value={nomorMesin} onChange={(e: any) => setNomorMesin(e.target.value)} placeholder="6B1..." />
            </div>
          </div>

          <div className="mt-2 p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Konfigurasi Tonase</h4>
              <button type="button" onClick={addRitaseTonnage} className="p-1 bg-emerald-500/10 text-emerald-500 rounded hover:bg-emerald-500/20"><Plus className="w-3 h-3" /></button>
            </div>
            {modalUpts.length > 0 && (
              <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
                {modalUpts.map(uptName => (
                  <button key={uptName} type="button" onClick={() => setActiveRitaseUpt(uptName)} className={`px-2 py-1 text-[8px] font-bold uppercase rounded-md ${activeRitaseUpt === uptName ? "bg-emerald-500 text-white" : "bg-slate-900 text-slate-500"}`}>{uptName}</button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 max-h-[150px] overflow-y-auto pr-1">
              {Object.entries(ritaseTonnage[activeRitaseUpt || (modalUpts.length > 0 ? modalUpts[0] : "default")] || {}).sort(([a], [b]) => Number(a) - Number(b)).map(([rit, tonnage]: any) => (
                <div key={rit} className="flex items-center gap-2 bg-slate-900 p-2 rounded-lg border border-slate-800 text-[10px]">
                  <div className="flex-1">
                    <p className="text-[8px] font-bold text-slate-600 uppercase mb-1 text-center font-mono">Rit {rit} (Kg)</p>
                    <input type="number" value={tonnage} onChange={(e) => updateRitaseTonnage(Number(rit), parseFloat(e.target.value) || 0)} className="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-white text-center outline-none focus:border-emerald-500 transition-colors" />
                  </div>
                  <button type="button" onClick={() => removeRitaseTonnage(Number(rit))} className="text-slate-500 hover:text-rose-500"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-4 mt-6">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Batal</Button>
            <Button type="submit" disabled={loading} className="flex-1">{loading ? <Loader2 className="animate-spin text-white w-4 h-4" /> : "Simpan"}</Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
