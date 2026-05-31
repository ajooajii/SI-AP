import React, { useState } from "react";
import { motion } from "motion/react";
import { 
  MapPin, 
  ExternalLink, 
  Lock, 
  Unlock, 
  Plus, 
  Download, 
  Loader2, 
  AlertCircle 
} from "lucide-react";
import { doc, collection, setDoc, updateDoc, addDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../../lib/firebase";
import { Card, Button, Modal, Input, Select } from "./components/SharedUI";
import { INITIAL_TPS_DATA } from "../../lib/seedData";

export function TpasTpsView({ tpas, tps, onNotify, settings, profile, logActivity }: any) {
  const isAdmin = profile?.role === 'admin' || profile?.role === 'co-admin';
  const [activeSubTab, setActiveSubTab] = useState<'tpa' | 'tps'>('tpa');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [updatingSettings, setUpdatingSettings] = useState(false);
  const [duplicateData, setDuplicateData] = useState<any | null>(null);
  const [importing, setImporting] = useState(false);

  const handleImportTps = async () => {
    setShowImportConfirm(true);
  };

  const processImportTps = async () => {
    setShowImportConfirm(false);
    setImporting(true);
    try {
      const batch2 = (await import("firebase/firestore")).writeBatch(db);
      INITIAL_TPS_DATA.forEach(data => {
        const newRef = doc(collection(db, "tps"));
        batch2.set(newRef, {
          ...data,
          location: data.address, // For compatibility
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });
      await batch2.commit();

      if (logActivity) {
        logActivity(
          'perubahan_data', 
          'tambah_tps', 
          'Master TPS', 
          `Impor massal ${INITIAL_TPS_DATA.length} data TPS awal`,
          {
            metadata: { importedCount: INITIAL_TPS_DATA.length },
            profile
          }
        );
      }

      onNotify('success', 'Berhasil mengimpor data awal TPS');
    } catch (error) {
      console.error(error);
      onNotify('error', 'Gagal mengimpor data TPS');
    } finally {
      setImporting(false);
    }
  };

  const currentData = activeSubTab === 'tpa' ? tpas : tps;
  const collectionName = activeSubTab === 'tpa' ? 'tpas' : 'tps';
  const label = activeSubTab === 'tpa' ? 'TPA' : 'TPS';

  const handleUpdateSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUpdatingSettings(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      mainTpaId: formData.get("mainTpaId") as string,
      isTpaLocked: formData.get("isTpaLocked") === "true",
    };

    try {
      await setDoc(doc(db, "settings", "global"), data, { merge: true });
      if (logActivity) {
        logActivity(
          'sistem',
          'update_settings',
          'Pengaturan Sistem',
          `Pembaruan pengaturan TPA Utama`,
          {
            beforeData: settings,
            afterData: data,
            profile
          }
        );
      }
      onNotify('success', 'Pengaturan TPA Utama diperbarui');
    } catch (error) {
      onNotify('error', 'Gagal memperbarui pengaturan');
    } finally {
      setUpdatingSettings(false);
    }
  };

  const saveData = async (data: any) => {
    setLoading(true);
    try {
      if (isEditing) {
        await updateDoc(doc(db, collectionName, isEditing.id), data);

        if (logActivity) {
          logActivity(
            'perubahan_data', 
            activeSubTab === 'tpa' ? 'edit_tpa' : 'edit_tps', 
            `Master ${label}`, 
            `Pembaruan data ${label}: ${data.name}`,
            {
              recordId: isEditing.id,
              recordLabel: data.name,
              beforeData: isEditing,
              afterData: data,
              profile
            }
          );
        }

        onNotify('success', `Data ${label} diperbarui`);
      } else {
        const docRef = await addDoc(collection(db, collectionName), data);

        if (logActivity) {
          logActivity(
            'perubahan_data', 
            activeSubTab === 'tpa' ? 'tambah_tpa' : 'tambah_tps', 
            `Master ${label}`, 
            `Registrasi ${label} baru: ${data.name}`,
            {
              recordId: docRef.id,
              recordLabel: data.name,
              afterData: data,
              profile
            }
          );
        }

        onNotify('success', `${label} baru ditambahkan`);
      }
      setShowModal(false);
      setIsEditing(null);
      setDuplicateData(null);
    } catch (error) {
      handleFirestoreError(error, isEditing ? OperationType.UPDATE : OperationType.CREATE, isEditing ? `${collectionName}/${isEditing.id}` : collectionName);
      onNotify('error', 'Gagal menyimpan data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: any = {
      name: formData.get("name") as string,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    if (activeSubTab === 'tps') {
      data.subDistrict = formData.get("subDistrict") as string;
      data.type = formData.get("type") as string;
      data.address = formData.get("address") as string;
      data.location = formData.get("address") as string; // For compatibility
      data.capacity = formData.get("capacity") as string;
      data.generation = formData.get("generation") as string;
      data.lat = formData.get("lat") ? parseFloat(formData.get("lat") as string) : null;
      data.lng = formData.get("lng") ? parseFloat(formData.get("lng") as string) : null;
    } else {
      data.location = formData.get("location") as string;
    }

    if (isEditing) {
      delete data.createdAt; 
    }

    const isDuplicate = currentData.find((t: any) => 
      t.name.toLowerCase().trim() === data.name.toLowerCase().trim() && 
      (!isEditing || t.id !== isEditing.id)
    );

    if (isDuplicate) {
      setDuplicateData(data);
      return;
    }

    await saveData(data);
  };

  const handleDelete = async (id: string) => {
    try {
      const recordToDelete = currentData.find((t: any) => t.id === id);
      await deleteDoc(doc(db, collectionName, id));

      if (logActivity) {
        logActivity(
          'perubahan_data', 
          activeSubTab === 'tpa' ? 'hapus_tpa' : 'hapus_tps', 
          `Master ${label}`, 
          `Penghapusan data ${label}: ${recordToDelete?.name || id}`,
          {
            recordId: id,
            recordLabel: recordToDelete?.name || id,
            beforeData: recordToDelete,
            profile
          }
        );
      }

      onNotify('success', `${label} berhasil dihapus`);
      setConfirmDelete(null);
    } catch (error) {
      onNotify('error', `Gagal menghapus ${label}`);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-2 p-1 bg-slate-900 border border-slate-800 rounded-xl w-fit">
        <button 
          type="button"
          onClick={() => setActiveSubTab('tpa')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeSubTab === 'tpa' ? 'bg-emerald-500 text-white' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Database TPA
        </button>
        <button 
          type="button"
          onClick={() => setActiveSubTab('tps')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeSubTab === 'tps' ? 'bg-emerald-500 text-white' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Database TPS
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-white tracking-tight">Database {label}</h2>
                <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{currentData.length} Data</span>
              </div>
              <p className="text-slate-500 text-sm">
                {activeSubTab === 'tpa' ? 'Tempat Pemrosesan Akhir sampah.' : 'Tempat Pembuangan Sementara sampah.'}
              </p>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2">
                {activeSubTab === 'tps' && tps.length === 0 && (
                   <Button 
                     variant="secondary" 
                     onClick={handleImportTps} 
                     disabled={importing}
                     className="text-xs bg-slate-800 border-slate-700 hover:bg-slate-700 h-10 gap-2"
                   >
                     {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                       <><Download className="w-4 h-4 text-emerald-500" /> <span className="truncate">Impor Data CSV</span></>
                     )}
                   </Button>
                )}
                <Button onClick={() => { setIsEditing(null); setShowModal(true); }} className="text-xs h-10 font-bold">
                  <Plus className="w-4 h-4 mr-1" /> Tambah {label}
                </Button>
              </div>
            )}
          </div>

          <Card className="overflow-hidden border-slate-800 bg-slate-900/50 backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-950/50 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nama {label}</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Detail</th>
                    {isAdmin && <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {currentData.map((t: any) => (
                    <tr key={t.id} className="hover:bg-slate-800/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-white text-sm">{t.name}</span>
                          {t.subDistrict && <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{t.subDistrict}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          {(t.address || t.location) && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                              <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
                              <span className="truncate max-w-[200px]">{t.address || t.location}</span>
                            </div>
                          )}
                          {t.lat && t.lng && (
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                              <span className="text-emerald-500/50">Koordinat:</span>
                              {t.lat.toFixed(6)}, {t.lng.toFixed(6)}
                            </div>
                          )}
                          {(t.lat && t.lng) || (t.address || t.location) ? (
                            <a 
                              href={t.lat && t.lng ? `https://www.google.com/maps/search/?api=1&query=${t.lat},${t.lng}` : (t.location?.startsWith('http') ? t.location : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.address || t.location)}`)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-blue-400 hover:text-blue-300 underline flex items-center gap-1 w-fit font-bold uppercase tracking-wider"
                            >
                              <ExternalLink className="w-2.5 h-2.5" /> Buka Lokasi
                            </a>
                          ) : null}
                          {t.type && (
                            <span className="text-[10px] font-mono text-emerald-500/70">{t.type} {t.capacity ? `(${t.capacity})` : ''}</span>
                          )}
                        </div>
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-3 transition-all">
                            {confirmDelete === t.id ? (
                              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                                <span className="text-[10px] font-bold text-rose-500 uppercase tracking-tight">Hapus?</span>
                                <button type="button" onClick={() => handleDelete(t.id)} className="text-rose-500 hover:text-rose-400 text-xs font-bold underline transition-colors">Ya</button>
                                <button type="button" onClick={() => setConfirmDelete(null)} className="text-slate-500 hover:text-slate-300 text-xs font-bold underline transition-colors">Batal</button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-3 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                <button type="button" onClick={() => { setIsEditing(t); setShowModal(true); }} className="text-slate-400 hover:text-blue-400 text-xs font-medium underline transition-colors">Edit</button>
                                <button type="button" onClick={() => setConfirmDelete(t.id)} className="text-slate-400 hover:text-rose-500 text-xs font-medium underline transition-colors">Hapus</button>
                              </div>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                {currentData.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 3 : 2} className="px-6 py-12 text-center">
                      <p className="text-slate-500 text-sm italic">Belum ada data {label}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        </div>

        {isAdmin && activeSubTab === 'tpa' && (
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight mb-2">Pengaturan TPA Utama</h2>
            <p className="text-slate-500 text-sm mb-6">Tentukan TPA utama dan batasi pilihan untuk user.</p>
            
            <Card className="p-6 bg-slate-900 border-slate-800">
              <form onSubmit={handleUpdateSettings} className="flex flex-col gap-6">
                <Select 
                  label="TPA Utama" 
                  name="mainTpaId" 
                  required 
                  defaultValue={settings?.mainTpaId}
                  options={tpas.map((t: any) => ({ value: t.id, label: t.name }))}
                />
                
                <div className="flex flex-col gap-3">
                  <label className="text-sm font-medium text-slate-400">Status Pilihan</label>
                  <div className="grid grid-cols-2 gap-4">
                    <label className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border cursor-pointer transition-all ${settings?.isTpaLocked ? 'bg-rose-500/10 border-rose-500/50 text-rose-500' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'}`}>
                      <input type="radio" name="isTpaLocked" value="true" className="hidden" defaultChecked={settings?.isTpaLocked} />
                      <Lock className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Dikunci</span>
                    </label>
                    <label className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border cursor-pointer transition-all ${!settings?.isTpaLocked ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'}`}>
                      <input type="radio" name="isTpaLocked" value="false" className="hidden" defaultChecked={!settings?.isTpaLocked} />
                      <Unlock className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Terbuka</span>
                    </label>
                  </div>
                  <p className="text-[10px] text-slate-500 italic mt-1">
                    * Jika dikunci, user (petugas) tidak dapat merubah tujuan TPA pada form ritase.
                  </p>
                </div>

                <Button type="submit" disabled={updatingSettings} className="w-full">
                  {updatingSettings ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : "Simpan Pengaturan"}
                </Button>
              </form>
            </Card>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-slate-900 rounded-2xl w-full max-w-md p-8 border border-slate-800">
            <h3 className="text-xl font-bold text-white mb-6 uppercase tracking-tight">{isEditing ? `Edit ${label}` : `Tambah ${label}`}</h3>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input label={`Nama ${label}`} name="name" required defaultValue={isEditing?.name} placeholder={activeSubTab === 'tpa' ? "TPA Bakung" : "TPS Kedaton"} />
              {activeSubTab === 'tps' && (
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Kecamatan" name="subDistrict" defaultValue={isEditing?.subDistrict} placeholder="Kedaton" />
                  <Input label="Jenis" name="type" defaultValue={isEditing?.type} placeholder="Container" />
                </div>
              )}
              <Input label="Alamat / Link Maps" name="address" defaultValue={isEditing?.address || isEditing?.location} placeholder="Jl. Kedaton No. 1 atau https://maps..." />
              {activeSubTab === 'tps' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Kapasitas" name="capacity" defaultValue={isEditing?.capacity} placeholder="4 Ton" />
                    <Input label="Timbulan" name="generation" defaultValue={isEditing?.generation} placeholder="4 Ton" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Latitude" name="lat" type="number" step="any" defaultValue={isEditing?.lat} placeholder="-5.xxxx" />
                    <Input label="Longitude" name="lng" type="number" step="any" defaultValue={isEditing?.lng} placeholder="105.xxxx" />
                  </div>
                </>
              )}
              <div className="flex gap-4 mt-6">
                <Button variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>Batal</Button>
                <Button type="submit" disabled={loading} className="flex-1">{loading ? <Loader2 className="animate-spin text-white w-4 h-4" /> : "Simpan"}</Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {duplicateData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-slate-900 rounded-2xl w-full max-w-sm p-6 border border-amber-500/50 shadow-2xl shadow-amber-500/10">
            <div className="flex items-center gap-4 text-amber-500 mb-4">
              <div className="p-3 bg-amber-500/10 rounded-full">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">{label} Sudah Ada?</h3>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              Nama {label} <span className="font-bold text-amber-500">{duplicateData.name}</span> sudah terdaftar di database. Apakah Anda tetap ingin menyimpan data ini?
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => saveData(duplicateData)} disabled={loading} className="w-full bg-amber-600 hover:bg-amber-500 text-white border-amber-600">
                {loading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : "Ya, Tetap Simpan"}
              </Button>
              <Button variant="ghost" onClick={() => setDuplicateData(null)} className="w-full text-slate-400 hover:text-white">
                Batal & Periksa Kembali
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      <Modal 
        isOpen={showImportConfirm} 
        onClose={() => setShowImportConfirm(false)}
        title="Konfirmasi Impor Data TPS"
      >
        <div className="flex flex-col gap-6">
          <div className="flex items-start gap-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <div className="p-2 bg-emerald-500 rounded-lg shrink-0">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm mb-1">Impor Data TPS?</p>
              <p className="text-slate-400 text-xs leading-relaxed">
                Ini akan menambahkan 71 data TPS awal ke dalam database. Pastikan koneksi internet stabil selama proses berlangsung.
              </p>
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <Button onClick={processImportTps} className="w-full h-12">
              Ya, Mulai Impor
            </Button>
            <Button variant="ghost" onClick={() => setShowImportConfirm(false)} className="w-full text-slate-400 hover:text-white">
              Batal
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
