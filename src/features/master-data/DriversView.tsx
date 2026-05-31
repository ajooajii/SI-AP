import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, 
  X, 
  Plus, 
  Truck, 
  UserRound, 
  ChevronDown, 
  ChevronRight, 
  AlertCircle, 
  Layers, 
  Edit2, 
  Trash2, 
  Check, 
  CheckCircle2 
} from "lucide-react";
import { doc, writeBatch, deleteField } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../../lib/firebase";
import { Card, Button } from "./components/SharedUI";
import { DriverEditModal } from "./components/DriverEditModal";

export function DriversView({ drivers, onNotify, upts, profile, vehicles, settings, logActivity }: any) {
  const isAdmin = profile?.role === 'admin' || profile?.role === 'co-admin';
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [expandedUpts, setExpandedUpts] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const toggleUpt = (name: string) => {
    setExpandedUpts(prev => 
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const handleDelete = async (id: string) => {
    try {
      const batch = writeBatch(db);
      const driverToDelete = drivers.find((d: any) => d.id === id);
      if (driverToDelete?.vehiclePlate) {
        const vehicle = vehicles.find((v: any) => v.plateNumber === driverToDelete.vehiclePlate);
        if (vehicle) batch.update(doc(db, "vehicles", vehicle.id), { defaultDriverName: "", upt: deleteField() });
      }
      batch.delete(doc(db, "drivers", id));
      await batch.commit();

      if (logActivity) {
        logActivity('perubahan_data', 'hapus_personil', 'Master Personil', `Penghapusan personil: ${driverToDelete?.name || id}`, 
          { recordId: id, recordLabel: driverToDelete?.name || id, beforeData: driverToDelete, profile });
      }
      onNotify('success', 'Personil berhasil dihapus');
      setConfirmDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `drivers/${id}`);
      onNotify('error', 'Gagal menghapus personil');
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Database Personil</h2>
            <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">{drivers.length} Data</span>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm">Data personil pengemudi armada.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="relative group flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 h-4 text-slate-500 group-focus-within:text-emerald-500 transition-colors" />
            <input 
              type="text"
              placeholder="Cari personil..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 sm:pl-10 pr-10 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all w-full md:w-64"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {isAdmin && (
            <Button onClick={() => { setIsEditing(null); setShowModal(true); }} className="text-xs py-2 sm:py-3">
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" /> <span className="sm:inline">Tambah Personil</span>
            </Button>
          )}
        </div>
      </div>

      {/* Data Quality Control Lists for Drivers */}
      {isAdmin && (settings.visual_supir_tidak_terhubung_upt || settings.visual_supir_multi_upt) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-950/50 border border-slate-800 rounded-2xl">
          {settings.visual_supir_tidak_terhubung_upt && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-rose-500/10 rounded-lg text-rose-500">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-white uppercase tracking-widest">Personil Tanpa UPT</h3>
              </div>
              <div className="space-y-2">
                {(() => {
                  const list = drivers.filter((d: any) => (!d.assigned_upt_id && !d.upt && (!d.upts || d.upts.length === 0)));
                  if (list.length === 0) return (
                    <div className="flex flex-col items-center justify-center py-6 bg-slate-900/50 rounded-xl border border-dashed border-slate-800">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500/50 mb-2" />
                      <p className="text-[10px] text-slate-500 italic uppercase font-bold tracking-tight px-2">Semua personil sudah terhubung ke UPT</p>
                    </div>
                  );
                  return list.map((d: any) => (
                    <div key={d.id} onClick={() => { setIsEditing(d); setShowModal(true); }} className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-xl hover:border-emerald-500/50 transition-all cursor-pointer group">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-white group-hover:text-emerald-500">{d.name}</span>
                        <span className="text-[9px] text-slate-500 uppercase">{d.jabatan || 'Personil'}</span>
                      </div>
                      <ChevronRight className="w-3 h-3 text-slate-700 group-hover:text-emerald-500 transition-all" />
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {settings.visual_supir_multi_upt && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-orange-500/10 rounded-lg text-orange-500">
                  <Layers className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-white uppercase tracking-widest">Personil Multi UPT</h3>
              </div>
              <div className="space-y-2">
                {(() => {
                  const list = drivers.filter((d: any) => (d.upts && d.upts.length > 1));
                  if (list.length === 0) return (
                    <div className="flex flex-col items-center justify-center py-6 bg-slate-900/50 rounded-xl border border-dashed border-slate-800">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500/50 mb-2" />
                      <p className="text-[10px] text-slate-500 italic uppercase font-bold tracking-tight px-2">Tidak ada personil multi-UPT</p>
                    </div>
                  );
                  return list.map((d: any) => (
                    <div key={d.id} onClick={() => { setIsEditing(d); setShowModal(true); }} className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-xl hover:border-emerald-500/50 transition-all cursor-pointer group">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-white group-hover:text-emerald-500">{d.name}</span>
                        <span className="text-[9px] text-orange-500 font-bold uppercase">{d.upts.length} UPT: {d.upts.join(", ")}</span>
                      </div>
                      <ChevronRight className="w-3 h-3 text-slate-700 group-hover:text-emerald-500 transition-all" />
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {upts.map((u: any) => {
          const uptDrivers = drivers.filter((d: any) => 
            (d.upts?.includes(u.name) || d.upt === u.name) && 
            (searchTerm === "" || d.name.toLowerCase().includes(searchTerm.toLowerCase()))
          );
          if (uptDrivers.length === 0 && searchTerm !== "") return null;
          if (uptDrivers.length === 0 && searchTerm === "") {
             if (drivers.filter((d: any) => (d.upts?.includes(u.name) || d.upt === u.name)).length === 0) return null;
          }
          
          const isExpanded = expandedUpts.includes(u.name) || searchTerm !== "";

          return (
            <div key={u.id} className="flex flex-col gap-2">
              <Card 
                className={`p-4 hover:border-emerald-500/30 transition-all group flex flex-col justify-between cursor-pointer ${isExpanded ? 'border-emerald-500/50 bg-slate-900 shadow-xl shadow-emerald-500/5' : 'bg-slate-900/60 border-slate-800'}`}
                onClick={() => toggleUpt(u.name)}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`transition-all duration-300 ${isExpanded ? 'rotate-180 text-emerald-500' : 'text-slate-600'}`}>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{uptDrivers.length} Personil</span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-white tracking-tight text-[13px] truncate">{u.name}</h3>
                  <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleUpt(u.name); }}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800/50 text-[9px] font-bold text-emerald-500 uppercase tracking-wider hover:bg-emerald-500 hover:text-white transition-all z-10"
                  >
                    <span>{isExpanded ? 'Tutup' : 'Detail'}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </Card>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="p-2 space-y-2 bg-slate-950/30 rounded-xl border border-slate-800/50">
                      {uptDrivers.map((d: any) => {
                        const driverVehicle = vehicles.find((v: any) => v.plateNumber === d.vehiclePlate);
                        return (
                          <div key={d.id} className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between group h-16">
                            <div className="flex-1 min-w-0 pr-4">
                              <h4 className="font-bold text-white text-[11px] truncate">{d.name}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                {d.shift && (
                                  <span className="px-1 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[8px] font-bold text-blue-400 uppercase">{d.shift}</span>
                                )}
                                {d.vehiclePlate && (
                                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                                    <Truck className="w-2.5 h-2.5 text-emerald-500" />
                                    <span className="text-[8px] font-mono font-bold text-emerald-400 uppercase">{d.vehiclePlate}</span>
                                  </div>
                                )}
                                {driverVehicle && (
                                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">({driverVehicle.type})</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isAdmin && (
                                <div className="flex items-center gap-2">
                                  {confirmDelete === d.id ? (
                                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-1">
                                      <span className="text-[9px] font-bold text-rose-500 uppercase">Hapus?</span>
                                      <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(d.id); }} className="p-1 bg-rose-500/10 text-rose-500 rounded hover:bg-rose-500 hover:text-white transition-all">
                                        <Check className="w-3 h-3" />
                                      </button>
                                      <button type="button" onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }} className="p-1 bg-slate-800 text-slate-400 rounded hover:text-white transition-all">
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                      <button type="button" onClick={(e) => { e.stopPropagation(); setIsEditing(d); setShowModal(true); }} className="p-1.5 bg-slate-800 rounded-md text-slate-500 hover:text-blue-400 transition-colors">
                                        <Edit2 className="w-3 h-3" />
                                      </button>
                                      <button type="button" onClick={(e) => { e.stopPropagation(); setConfirmDelete(d.id); }} className="p-1.5 bg-slate-800 rounded-md text-slate-500 hover:text-rose-500 transition-colors">
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {drivers.filter((d: any) => 
          (!d.upts || d.upts.length === 0) && !upts.some((u: any) => u.name === (d as any).upt)
        ).length > 0 && (
          <div className="mt-8 border-t border-slate-800/10 pt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1 h-3 bg-slate-600 rounded-full" />
              <h3 className="font-bold text-slate-500 tracking-tight text-[10px] uppercase tracking-[0.2em]">Tanpa UPT / Data Arsip</h3>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {drivers.filter((d: any) => 
                (!d.upts || d.upts.length === 0) && !upts.some((u: any) => u.name === (d as any).upt) && 
                (searchTerm === "" || d.name.toLowerCase().includes(searchTerm.toLowerCase()))
              ).map((d: any) => (
                <div key={d.id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between group hover:border-slate-700 hover:bg-slate-800/50 transition-all">
                  <div className="flex-1 min-w-0 pr-4">
                    <span className="text-sm font-bold text-white block leading-tight truncate">{d.name}</span>
                    <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Data Arsip / Tanpa Wilayah</span>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                       {confirmDelete === d.id ? (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-1">
                          <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(d.id); }} className="px-3 py-1.5 bg-rose-600 text-white text-[10px] font-bold rounded-lg uppercase shadow-lg shadow-rose-900/20">Ya, Hapus</button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }} className="px-3 py-1.5 bg-slate-800 text-slate-400 text-[10px] font-bold rounded-lg uppercase">Batal</button>
                        </div>
                      ) : (
                        <div className="flex gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button type="button" onClick={(e) => { e.stopPropagation(); setIsEditing(d); setShowModal(true); }} className="text-slate-400 hover:text-blue-400 p-2 bg-slate-800/50 rounded-lg transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); setConfirmDelete(d.id); }} className="text-slate-400 hover:text-rose-500 p-2 bg-slate-800/50 rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <DriverEditModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setIsEditing(null); }}
        isEditing={isEditing}
        upts={upts}
        vehicles={vehicles}
        onNotify={onNotify}
        profile={profile}
        onSuccess={() => { setShowModal(false); setIsEditing(null); }}
      />
    </div>
  );
}
