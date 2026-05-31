import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Building2, 
  ClipboardList, 
  Plus, 
  Edit2, 
  Trash2, 
  ChevronRight, 
  X, 
  UserRound, 
  Truck, 
  Loader2, 
  AlertCircle, 
  Download 
} from "lucide-react";
import { doc, updateDoc, doc as firestoreDoc, addDoc, collection, serverTimestamp, deleteDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../../lib/firebase";
import { Card, Button, Modal, Input, Select } from "./components/SharedUI";
import { UPT_LIST } from "../../types";

export function UptsView({ upts, vehicles, drivers, onNotify, profile, onEditVehicle, onEditDriver, logActivity }: any) {
  const isAdmin = profile?.role === 'admin' || profile?.role === 'co-admin';
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [selectedUpt, setSelectedUpt] = useState<any | null>(null);
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [duplicateData, setDuplicateData] = useState<any | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const vehicleTypes = ["Arm Roll", "Dump Truck", "Motor Roda 3", "Pick Up"];

  const saveData = async (data: any) => {
    setLoading(true);
    try {
      if (isEditing) {
        await updateDoc(doc(db, "upts", isEditing.id), {
          ...data,
          updatedAt: serverTimestamp()
        });

        if (logActivity) {
          logActivity(
            'perubahan_data', 
            'edit_upt', 
            'Master UPT', 
            `Pembaruan data UPT: ${data.nama_upt || data.name}`,
            {
              recordId: isEditing.id,
              recordLabel: data.nama_upt || data.name,
              beforeData: isEditing,
              afterData: data,
              profile
            }
          );
        }

        onNotify('success', 'Data UPT diperbarui');
      } else {
        const lastUptId = upts
          .map((u: any) => u.upt_id)
          .filter((id: any) => id && id.startsWith('UPT'))
          .map((id: any) => parseInt(id.replace('UPT', ''), 10))
          .filter((n: any) => !isNaN(n))
          .reduce((max: number, val: number) => Math.max(max, val), 0);
        
        const nextId = `UPT${(lastUptId + 1).toString().padStart(3, '0')}`;
        
        const newUptData = {
          ...data,
          upt_id: nextId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        const docRef = await addDoc(collection(db, "upts"), newUptData);

        if (logActivity) {
          logActivity(
            'perubahan_data', 
            'tambah_upt', 
            'Master UPT', 
            `Registrasi UPT baru: ${data.nama_upt || data.name}`,
            {
              recordId: docRef.id,
              recordLabel: data.nama_upt || data.name,
              afterData: { ...newUptData, upt_id: nextId },
              profile
            }
          );
        }

        onNotify('success', 'UPT baru ditambahkan');
      }
      setShowModal(false);
      setIsEditing(null);
      setDuplicateData(null);
    } catch (error) {
      handleFirestoreError(error, isEditing ? OperationType.UPDATE : OperationType.CREATE, isEditing ? `upts/${isEditing.id}` : "upts");
      onNotify('error', 'Gagal menyimpan data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitAttempted(true);
    const formData = new FormData(e.currentTarget);
    const nameValue = formData.get("nama_upt") as string;
    const data = {
      nama_upt: nameValue,
      name: nameValue, // for compatibility
      kode_pendek: formData.get("kode_pendek") as string,
      penanggung_jawab: formData.get("penanggung_jawab") as string,
      status_pimpinan: formData.get("status_pimpinan") as string,
      area_polygon: formData.get("area_polygon") as string || "",
    };

    const isDuplicate = upts.find((u: any) => 
      u.nama_upt?.toLowerCase().trim() === data.nama_upt.toLowerCase().trim() && 
      (!isEditing || u.id !== isEditing.id)
    );

    if (isDuplicate) {
      setDuplicateData(data);
      return;
    }

    await saveData(data);
  };

  const handleSyncDefaults = async () => {
    setShowSyncConfirm(true);
  };

  const processSyncDefaults = async () => {
    setShowSyncConfirm(false);
    setLoading(true);
    try {
      const existingNames = upts.map((u: any) => u.name);
      const toAdd = UPT_LIST.filter(name => !existingNames.includes(name));
      
      if (toAdd.length === 0) {
        onNotify('success', 'Semua UPT default sudah ada di database');
        return;
      }

      for (const name of toAdd) {
        await addDoc(collection(db, "upts"), { name });
      }

      if (logActivity) {
        logActivity(
          'perubahan_data', 
          'edit_upt', 
          'Master UPT', 
          `Sinkronisasi massal ${toAdd.length} UPT default`,
          {
            metadata: { addedCount: toAdd.length, addedNames: toAdd },
            profile
          }
        );
      }

      onNotify('success', `${toAdd.length} UPT default berhasil ditambahkan`);
    } catch (error) {
      onNotify('error', 'Gagal sinkronisasi data');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const uptToDelete = upts.find((u: any) => u.id === id);
      await deleteDoc(doc(db, "upts", id));

      if (logActivity) {
        logActivity(
          'perubahan_data', 
          'hapus_upt', 
          'Master UPT', 
          `Penghapusan data UPT: ${uptToDelete?.nama_upt || uptToDelete?.name || id}`,
          {
            recordId: id,
            recordLabel: uptToDelete?.nama_upt || uptToDelete?.name || id,
            beforeData: uptToDelete,
            profile
          }
        );
      }

      onNotify('success', 'UPT berhasil dihapus');
      setConfirmDelete(null);
    } catch (error) {
      onNotify('error', 'Gagal menghapus UPT');
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Database UPT</h2>
            <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">{upts.length} Data</span>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm">Daftar Unit Pelaksana Teknis Dinas.</p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <Button variant="secondary" onClick={handleSyncDefaults} disabled={loading} className="text-[10px] py-2 sm:py-3 flex-1 sm:flex-initial">
              <ClipboardList className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Default
            </Button>
            <Button onClick={() => { setIsEditing(null); setShowModal(true); }} className="text-[10px] py-2 sm:py-3 flex-1 sm:flex-initial">
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" /> Tambah
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
        {upts.map((u: any) => {
          const uptVehicles = vehicles.filter((v: any) => 
            v.upt === u.name || (v.upts && v.upts.includes(u.name))
          );
          const uptDrivers = drivers.filter((d: any) => 
            d.upt === u.name || (d.upts && d.upts.includes(u.name))
          );

          return (
            <Card 
              key={u.id} 
              className="p-4 sm:p-6 flex flex-col justify-between hover:border-emerald-500/30 transition-all group cursor-pointer bg-slate-900 border-slate-800 relative shadow-2xl shadow-slate-950/20"
              onClick={() => setSelectedUpt(u)}
            >
              <div className="absolute top-2.5 sm:top-4 right-2.5 sm:right-4 z-10">
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[8px] sm:text-[9px] font-mono font-bold text-emerald-500 uppercase tracking-widest whitespace-nowrap">
                  {u.upt_id || "TEMP"}
                </span>
              </div>

              <div className="absolute top-0 left-0 p-4 opacity-[0.03] group-hover:opacity-10 transition-all pointer-events-none">
                <Building2 className="w-16 h-16" />
              </div>

              <div>
                <div className="flex items-start gap-3 mb-4 pr-12 sm:pr-0">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 flex-shrink-0">
                    <Building2 className="w-4.5 h-4.5 sm:w-5 sm:h-5 flex-shrink-0" />
                  </div>
                  <div className="min-w-0 pt-0.5 sm:pt-0">
                    <h3 className="font-bold text-white text-base sm:text-lg tracking-tight leading-snug break-words line-clamp-2">{u.nama_upt || u.name}</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none mt-1">{u.kode_pendek || "-"}</p>
                  </div>
                </div>

                <div className="mb-4 space-y-2">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mb-0.5">Penanggung Jawab</span>
                    <span className="text-xs font-bold text-slate-300 truncate">{u.penanggung_jawab || "Belum Set"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">Status:</span>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${u.status_pimpinan === 'Definitif' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                      {u.status_pimpinan || "PLT"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                   <div className="flex flex-col">
                     <span className="text-xl sm:text-2xl font-bold text-white font-mono">{uptVehicles.length}</span>
                     <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Armada</span>
                   </div>
                   <div className="flex flex-col">
                     <span className="text-xl sm:text-2xl font-bold text-white font-mono">{uptDrivers.length}</span>
                     <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Personil</span>
                   </div>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800 mt-auto">
                <div className="flex items-center gap-3">
                   {confirmDelete === u.id ? (
                      <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-2" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => handleDelete(u.id)} className="text-rose-500 hover:text-rose-400 text-[10px] font-bold uppercase py-1">Ya</button>
                        <button type="button" onClick={() => setConfirmDelete(null)} className="text-slate-500 hover:text-white text-[10px] font-bold uppercase py-1">Batal</button>
                      </div>
                    ) : isAdmin ? (
                      <div className="flex items-center gap-3 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => { setIsEditing(u); setShowModal(true); }} className="text-slate-500 hover:text-blue-400 text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1.5 py-1">
                          <Edit2 className="w-3 h-3" /> Edit
                        </button>
                        <button type="button" onClick={() => setConfirmDelete(u.id)} className="text-slate-500 hover:text-rose-500 text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1.5 py-1">
                          <Trash2 className="w-3 h-3" /> Hapus
                        </button>
                      </div>
                    ) : <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest italic opacity-50 py-1">Read Only</span>}
                </div>
                
                <button 
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setSelectedUpt(u); }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:bg-emerald-500 hover:text-white transition-all group/btn shadow-inner border border-transparent hover:border-emerald-400/20 flex-shrink-0"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest">Detail</span>
                  <ChevronRight className="w-3 h-3 group-hover/btn:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      <AnimatePresence>
        {selectedUpt && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setSelectedUpt(null); setExpandedType(null); }}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[70]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-md bg-slate-900 border-l border-slate-800 z-[80] shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-6 bg-emerald-500 rounded-full" />
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-tight uppercase">{selectedUpt.name}</h2>
                    <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase mt-0.5">Detail Armada</p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => { setSelectedUpt(null); setExpandedType(null); }}
                  className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
                <div className="mb-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800">
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Total Armada</p>
                      <p className="text-xl font-bold text-white font-mono">{vehicles.filter((v: any) => v.upt === selectedUpt.name || v.upts?.includes(selectedUpt.name)).length}</p>
                    </div>
                    <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800">
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Total Personil</p>
                      <p className="text-xl font-bold text-white font-mono">{drivers.filter((d: any) => d.upt === selectedUpt.name || d.upts?.includes(selectedUpt.name)).length}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {vehicleTypes.map(type => {
                    const uptVehicles = vehicles.filter((v: any) => v.upt === selectedUpt.name || v.upts?.includes(selectedUpt.name));
                    const typeCount = uptVehicles.filter((v: any) => v.type === type).length;
                    const isTypeExpanded = expandedType === type;
                    
                    return (
                      <button
                        key={type}
                        type="button"
                        disabled={typeCount === 0}
                        onClick={() => setExpandedType(isTypeExpanded ? null : type)}
                        className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                          typeCount === 0 
                            ? 'opacity-40 border-slate-800 bg-slate-950/50 grayscale' 
                            : isTypeExpanded 
                              ? 'bg-emerald-500 border-emerald-400 text-white shadow-xl shadow-emerald-500/20' 
                              : 'bg-slate-800/50 border-slate-700 hover:border-emerald-500/50 text-slate-400'
                        }`}
                      >
                        <span className={`text-[9px] font-bold uppercase tracking-widest ${isTypeExpanded ? 'text-white/80' : 'text-slate-500'}`}>{type}</span>
                        <div className="flex items-baseline gap-1">
                          <span className={`text-2xl font-bold font-mono ${isTypeExpanded ? 'text-white' : typeCount > 0 ? 'text-emerald-500' : 'text-slate-600'}`}>{typeCount}</span>
                          <span className={`text-[10px] font-bold uppercase tracking-tighter ${isTypeExpanded ? 'text-white/60' : 'text-slate-600'}`}>Unit</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <AnimatePresence mode="wait">
                  {expandedType ? (
                    <motion.div
                      key={expandedType}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="flex-1 flex flex-col min-h-0"
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <div className="flex-1 h-px bg-slate-800" />
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest bg-slate-950 px-3 py-1 rounded-full border border-slate-800">{expandedType} List</span>
                        <div className="flex-1 h-px bg-slate-800" />
                      </div>
                      <div className="grid grid-cols-2 gap-3 overflow-y-auto pr-2 custom-scrollbar">
                        {vehicles
                          .filter((v: any) => (v.upt === selectedUpt.name || v.upts?.includes(selectedUpt.name)) && v.type === expandedType)
                          .map((v: any) => (
                            <div 
                              key={v.id} 
                              className="p-3 bg-slate-950 border border-slate-800 rounded-xl shadow-inner group hover:border-emerald-500/30 transition-all flex items-center justify-between"
                            >
                              <div className="flex-1 min-w-0 pr-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-mono font-bold text-white group-hover:text-emerald-500 transition-colors uppercase">{v.plateNumber}</span>
                                  {isAdmin && (
                                    <button 
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); onEditVehicle(v); }}
                                      className="p-1 px-1.5 rounded-md bg-slate-800 text-[8px] font-bold text-blue-400 uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                    >
                                      Edit
                                    </button>
                                  )}
                                </div>
                                <div className="mt-1.5 text-[8px] font-bold text-slate-600 uppercase tracking-widest truncate">
                                  {v.ritaseTonnage?.[selectedUpt.name] ? (
                                    <span className="text-emerald-500/60">Konfigurasi Aktif</span>
                                  ) : (
                                    "Bawaan"
                                  )}
                                </div>
                              </div>
                              <div className="w-1 h-3 bg-slate-800 rounded-full group-hover:bg-emerald-500/40 transition-colors" />
                            </div>
                          ))}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-6"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <div className="flex-1 h-px bg-slate-800" />
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-950 px-3 py-1 rounded-full border border-slate-800">Daftar Personil ({drivers.filter((d: any) => d.upt === selectedUpt.name || d.upts?.includes(selectedUpt.name)).length})</span>
                          <div className="flex-1 h-px bg-slate-800" />
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {drivers.filter((d: any) => d.upt === selectedUpt.name || d.upts?.includes(selectedUpt.name)).length > 0 ? (
                            drivers.filter((d: any) => d.upt === selectedUpt.name || d.upts?.includes(selectedUpt.name)).map((d: any) => (
                              <div key={d.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between group hover:border-emerald-500/30 transition-all">
                                <div className="flex-1 min-w-0 pr-4">
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                                      <UserRound className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-sm font-bold text-white truncate">{d.name}</span>
                                    {isAdmin && (
                                      <button 
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); onEditDriver(d); }}
                                        className="p-1 px-1.5 rounded-md bg-slate-800 text-[8px] font-bold text-blue-400 uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                      >
                                        Edit
                                      </button>
                                    )}
                                  </div>
                                  {d.vehiclePlate && (
                                    <div className="mt-2 flex items-center gap-2 ml-10">
                                      <Truck className="w-2.5 h-2.5 text-slate-500" />
                                      <span className="text-[9px] font-mono text-slate-500 font-bold uppercase tracking-tight">{d.vehiclePlate}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="w-1 h-1 rounded-full bg-slate-800 group-hover:bg-emerald-500 transition-colors" />
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-8 bg-slate-950/50 rounded-xl border border-dashed border-slate-800">
                              <UserRound className="w-8 h-8 text-slate-800 mx-auto mb-2" />
                              <p className="text-xs text-slate-600 font-medium">Belum ada personil terdaftar</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="p-6 border-t border-slate-800 bg-slate-950/30">
                <Button 
                  variant="ghost" 
                  onClick={() => { setSelectedUpt(null); setExpandedType(null); }}
                  className="w-full justify-center text-slate-500 hover:text-white"
                >
                  Tutup Detail
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-slate-900 rounded-2xl w-full max-w-md p-8 border border-slate-800">
            <h3 className="text-xl font-bold text-white mb-6 uppercase tracking-tight">{isEditing ? "Edit UPT" : "Tambah UPT"}</h3>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Input label="Nama Lengkap UPT" name="nama_upt" required showError={submitAttempted && !(isEditing?.nama_upt || isEditing?.name)} defaultValue={isEditing?.nama_upt || isEditing?.name} placeholder="UPT Kedaton" />
                </div>
                <Input label="Kode Pendek (Operational)" name="kode_pendek" required showError={submitAttempted && !isEditing?.kode_pendek} defaultValue={isEditing?.kode_pendek} placeholder="KEDATON" />
                <Select 
                  label="Status Pimpinan" 
                  name="status_pimpinan" 
                  required 
                  showError={submitAttempted && !(isEditing?.status_pimpinan || "PLT")}
                  defaultValue={isEditing?.status_pimpinan || "PLT"}
                  options={[
                    { value: 'PLT', label: 'PLT' },
                    { value: 'Definitif', label: 'Definitif' }
                  ]}
                />
              </div>
              <Input label="Penanggung Jawab" name="penanggung_jawab" defaultValue={isEditing?.penanggung_jawab} placeholder="Nama Ka. UPT" />
              <Input label="Polygon Area (Optional URL/Data)" name="area_polygon" defaultValue={isEditing?.area_polygon} placeholder="GeoJSON or Link" />
              
              <div className="flex gap-4 mt-6">
                <Button variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>Batal</Button>
                <Button type="submit" disabled={loading} className="flex-1">{loading ? <Loader2 className="animate-spin text-white w-4 h-4" /> : "Simpan Data UPT"}</Button>
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
              <h3 className="text-lg font-bold text-white">UPT Sudah Ada?</h3>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              Nama UPT <span className="font-bold text-amber-500">{duplicateData.name}</span> sudah terdaftar di database. Apakah Anda tetap ingin menyimpan data ini?
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => saveData(duplicateData)} disabled={loading} className="w-full bg-amber-600 hover:bg-amber-500 text-white border-amber-600">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ya, Tetap Simpan"}
              </Button>
              <Button variant="ghost" onClick={() => setDuplicateData(null)} className="w-full text-slate-400 hover:text-white">
                Batal & Periksa Kembali
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      <Modal 
        isOpen={showSyncConfirm} 
        onClose={() => setShowSyncConfirm(false)}
        title="Konfirmasi Impor UPT Default"
      >
        <div className="flex flex-col gap-6">
          <div className="flex items-start gap-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <div className="p-2 bg-emerald-500 rounded-lg shrink-0">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm mb-1">Impor Data Default?</p>
              <p className="text-slate-400 text-xs leading-relaxed">
                Masukkan data UPT default yang belum ada ke database? Ini akan menambahkan daftar UPT standar sistem.
              </p>
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <Button onClick={processSyncDefaults} className="w-full h-12">
              Ya, Impor Sekarang
            </Button>
            <Button variant="ghost" onClick={() => setShowSyncConfirm(false)} className="w-full text-slate-400 hover:text-white">
              Batal
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
