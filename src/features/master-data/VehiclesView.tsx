import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, 
  X, 
  RefreshCw, 
  Plus, 
  AlertCircle, 
  Layers, 
  ChevronDown, 
  ChevronRight, 
  Weight, 
  CheckCircle2, 
  Truck, 
  UserRound, 
  Fuel, 
  Loader2 
} from "lucide-react";
import { doc, writeBatch, serverTimestamp } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../../lib/firebase";
import { Card, Button, Modal } from "./components/SharedUI";
import { VehicleEditModal } from "./components/VehicleEditModal";

export function VehiclesView({ vehicles, onNotify, upts, profile, drivers, trips, settings, logActivity }: any) {
  const isAdmin = profile?.role === 'admin' || profile?.role === 'co-admin';
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [expandedTypes, setExpandedTypes] = useState<string[]>(["Arm Roll", "Dump Truck", "Motor Roda 3", "Pick Up"]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const toggleExpand = (type: string) => {
    setExpandedTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleDelete = async (id: string) => {
    try {
      const batch = writeBatch(db);
      const vehicleToDelete = vehicles.find((v: any) => v.id === id);
      
      if (vehicleToDelete?.defaultDriverName) {
        const driver = drivers.find((d: any) => d.name === vehicleToDelete.defaultDriverName);
        if (driver) batch.update(doc(db, "drivers", driver.id), { vehiclePlate: "", upt: "" });
      }
      
      batch.delete(doc(db, "vehicles", id));
      await batch.commit();

      if (logActivity) {
        logActivity('perubahan_data', 'hapus_kendaraan', 'Master Kendaraan', 
          `Penghapusan kendaraan: ${vehicleToDelete?.plateNumber || id}`, 
          { recordId: id, recordLabel: vehicleToDelete?.plateNumber || id, beforeData: vehicleToDelete, profile });
      }
      onNotify('success', 'Kendaraan berhasil dihapus');
      setConfirmDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `vehicles/${id}`);
      onNotify('error', 'Gagal menghapus kendaraan');
    }
  };

  const filteredVehicles = vehicles.filter((v: any) => 
    v.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.type && v.type.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (v.defaultDriverName && v.defaultDriverName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSyncTonnage = () => {
    setShowSyncConfirm(true);
  };

  const processSyncTonnage = async () => {
    setShowSyncConfirm(false);
    setIsSyncing(true);
    let syncCount = 0;
    try {
      const updates: any[] = [];
      
      for (const trip of trips) {
        const vehicle = vehicles.find((v: any) => v.plateNumber === trip.vehiclePlate);
        if (!vehicle) continue;

        const tonList = vehicle.ritaseTonnage || {};
        const activeUpt = trip.upt;
        const activeRit = Number(trip.tripCount || 1);

        const currentTonnage = Number(trip.tonnage || 0);
        const currentVolume = Number(trip.volume || 0);

        let correctTonnage = 0;
        if (tonList && typeof tonList === 'object') {
          const uptConfig = tonList[activeUpt] || tonList['default'] || {};
          correctTonnage = Number(uptConfig[activeRit] || uptConfig[1] || 0);
        }

        let correctVolume = 0;
        if (correctTonnage > 0) {
          if (trip.vehicleType === "Motor Roda 3") {
            correctVolume = 1.5;
          } else if (trip.vehicleType === "Pick Up") {
            correctVolume = 2.5;
          } else {
            correctVolume = Number((correctTonnage / 350).toFixed(2));
          }
        }

        if (currentTonnage !== correctTonnage || currentVolume !== correctVolume) {
          updates.push({
            id: trip.id,
            tonnage: correctTonnage,
            volume: correctVolume
          });
        }
      }

      if (updates.length === 0) {
        onNotify('success', 'Semua data tonase & volume sudah akurat');
        return;
      }

      const chunkSize = 450; 
      for (let i = 0; i < updates.length; i += chunkSize) {
        const chunk = updates.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach(u => {
          batch.update(doc(db, "trips", u.id), { 
            tonnage: u.tonnage,
            volume: u.volume,
            updatedBy: profile?.userId || "system_sync",
            syncAt: serverTimestamp()
          });
          syncCount++;
        });
        await batch.commit();
      }

      onNotify('success', `${syncCount} data ritase berhasil dikalibrasi ulang`);
      
      if (logActivity) {
        logActivity('sistem', 'sync_tonase_kalibrasi', 'Master Kendaraan', 
          `Sinkronisasi massal & kalibrasi ulang ${syncCount} data ritase dilakukan oleh admin`, 
          { metadata: { syncCount, totalTrips: trips.length }, profile });
      }

    } catch (error) {
      console.error("Sync Error:", error);
      onNotify('error', 'Terjadi kesalahan saat sinkronisasi data');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Database Kendaraan</h2>
            <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">{vehicles.length} Data</span>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm">Manajemen armada pengangkut sampah.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <div className="relative group flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-emerald-500 transition-colors" />
            <input 
              type="text"
              placeholder="Cari kendaraan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-10 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all w-full sm:w-64"
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
          <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 sm:gap-3 shrink-0">
            {profile?.role === 'admin' && (
              <Button 
                variant="secondary" 
                className="h-10 px-3 sm:px-4 border-slate-700 hover:border-emerald-500/50 hover:text-emerald-400 transition-all font-bold gap-2 text-[10px] sm:text-xs w-full sm:w-auto justify-center"
                onClick={() => handleSyncTonnage()} 
                disabled={isSyncing}
              >
                {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                <span className="truncate">Singkronisasi & Kalibrasi</span>
              </Button>
            )}
            {isAdmin && (
              <Button 
                className="h-10 px-3 sm:px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-900/20 text-[10px] sm:text-xs w-full sm:w-auto justify-center"
                onClick={() => { setIsEditing(null); setShowModal(true); }}
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-1" /> <span className="truncate">Tambah Kendaraan</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 flex flex-col gap-8">
          {/* Data Quality Control Lists */}
          {(settings.visual_kendaraan_tidak_terhubung_upt || settings.visual_kendaraan_multi_upt) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-950/50 border border-slate-800 rounded-2xl">
              {settings.visual_kendaraan_tidak_terhubung_upt && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-rose-500/10 rounded-lg text-rose-500">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-widest">Kendaraan Tanpa UPT</h3>
                  </div>
                  <div className="space-y-2">
                    {(() => {
                      const list = filteredVehicles.filter((v: any) => (!v.assigned_upt_id && !v.upt && (!v.upts || v.upts.length === 0)));
                      if (list.length === 0) return (
                        <div className="flex flex-col items-center justify-center py-6 bg-slate-900/50 rounded-xl border border-dashed border-slate-800">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500/50 mb-2" />
                          <p className="text-[10px] text-slate-500 italic uppercase font-bold tracking-tight">Semua kendaraan sudah terhubung ke UPT</p>
                        </div>
                      );
                      return list.map((v: any) => (
                        <div key={v.id} onClick={() => { setIsEditing(v); setShowModal(true); }} className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-xl hover:border-emerald-500/50 transition-all cursor-pointer group">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-mono font-bold text-white group-hover:text-emerald-500">{v.plateNumber}</span>
                            <span className="text-[9px] text-slate-500 uppercase">{v.type}</span>
                          </div>
                          <ChevronRight className="w-3 h-3 text-slate-700 group-hover:text-emerald-500 transition-all" />
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {settings.visual_kendaraan_multi_upt && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-orange-500/10 rounded-lg text-orange-500">
                      <Layers className="w-4 h-4" />
                    </div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-widest">Kendaraan Multi UPT</h3>
                  </div>
                  <div className="space-y-2">
                    {(() => {
                      const list = filteredVehicles.filter((v: any) => (v.upts && v.upts.length > 1));
                      if (list.length === 0) return (
                         <div className="flex flex-col items-center justify-center py-6 bg-slate-900/50 rounded-xl border border-dashed border-slate-800">
                           <CheckCircle2 className="w-5 h-5 text-emerald-500/50 mb-2" />
                           <p className="text-[10px] text-slate-500 italic uppercase font-bold tracking-tight">Tidak ada kendaraan multi-UPT</p>
                         </div>
                      );
                      return list.map((v: any) => (
                        <div key={v.id} onClick={() => { setIsEditing(v); setShowModal(true); }} className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-xl hover:border-emerald-500/50 transition-all cursor-pointer group">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-mono font-bold text-white group-hover:text-emerald-500">{v.plateNumber}</span>
                            <span className="text-[9px] text-orange-500 font-bold uppercase">{v.upts.length} UPT: {v.upts.join(", ")}</span>
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

          {settings.visual_card_tonase_kendaraan && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                 <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-500">
                    <Weight className="w-4 h-4" />
                 </div>
                 <h3 className="text-xs font-bold text-white uppercase tracking-widest">Kualitas Konfigurasi Tonase</h3>
              </div>
              
              {(() => {
                 const isTonaseConfigured = (v: any) => {
                   const tonList = v.ritaseTonnage || {};
                   return Object.values(tonList).some((uptConfig: any) => 
                     uptConfig && typeof uptConfig === 'object' && Object.values(uptConfig).some((val: any) => typeof val === 'number' && val > 0)
                   );
                 };

                 const configured = filteredVehicles.filter(v => isTonaseConfigured(v));
                 const unconfigured = filteredVehicles.filter(v => !isTonaseConfigured(v));

                 const groupByType = (list: any[]) => {
                    const groups: { [key: string]: any[] } = {};
                    list.forEach(v => {
                       const type = v.type || "Jenis Kendaraan Belum Diatur";
                       if (!groups[type]) groups[type] = [];
                       groups[type].push(v);
                    });
                    
                    const suggestedOrder = ["Arm Roll", "Dump Truck", "Motor Roda 3", "Pick Up"];
                    return Object.keys(groups).sort((a, b) => {
                       const indexA = suggestedOrder.indexOf(a);
                       const indexB = suggestedOrder.indexOf(b);
                       if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                       if (indexA !== -1) return -1;
                       if (indexB !== -1) return 1;
                       if (a === "Jenis Kendaraan Belum Diatur") return 1;
                       if (b === "Jenis Kendaraan Belum Diatur") return -1;
                       return a.localeCompare(b);
                    }).map(type => ({ type, vehicles: groups[type].sort((a, b) => a.plateNumber.localeCompare(b.plateNumber)) }));
                 };

                 const renderCard = (v: any, isValid: boolean) => {
                    const tonList = v.ritaseTonnage || {};
                    let summaryTonnage = 0;
                    let summaryLabel = "Tonase Ritase 1";

                    const isInactive = v.status === 'Tidak Aktif';

                    if (tonList.default && tonList.default[1] > 0) {
                      summaryTonnage = tonList.default[1];
                      summaryLabel = "Ritase 1 (Default)";
                    } else {
                      outer: for (const uKey of Object.keys(tonList)) {
                        const ritKeys = Object.keys(tonList[uKey]).sort((a, b) => Number(a) - Number(b));
                        for (const rKey of ritKeys) {
                          if (tonList[uKey][rKey] > 0) {
                            summaryTonnage = tonList[uKey][rKey];
                            summaryLabel = `Ritase ${rKey} (${uKey === 'default' ? 'Default' : uKey})`;
                            break outer;
                          }
                        }
                      }
                    }

                    return (
                      <Card key={v.id} className={`bg-slate-900/60 border-slate-800 p-4 transition-all hover:border-emerald-500/30 ${!isValid ? 'border-amber-500/30 bg-amber-500/5' : ''} ${isInactive ? 'opacity-70 border-slate-700' : ''}`}>
                          <div className="flex items-center justify-between mb-3">
                             <div className="flex flex-col">
                                <span className={`text-[10px] font-mono font-bold ${isInactive ? 'text-slate-500' : isValid ? 'text-emerald-500' : 'text-amber-500'}`}>{v.plateNumber}</span>
                                <span className="text-[8px] text-slate-500 uppercase font-bold">{v.type}</span>
                             </div>
                             <div className="flex flex-col items-end gap-1">
                               {isInactive ? (
                                 <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">
                                    <X className="w-2 h-2 text-rose-500" />
                                    <span className="text-[7px] font-bold text-rose-500 uppercase tracking-tighter">Tidak Aktif</span>
                                 </div>
                               ) : isValid ? (
                                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                                     <CheckCircle2 className="w-2 h-2 text-emerald-500" />
                                     <span className="text-[7px] font-bold text-emerald-500 uppercase tracking-tighter">Valid</span>
                                  </div>
                               ) : (
                                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                                     <AlertCircle className="w-2 h-2 text-amber-500" />
                                     <span className="text-[7px] font-bold text-amber-500 uppercase tracking-tighter">Review</span>
                                  </div>
                               )}
                             </div>
                          </div>
                          {isInactive && v.status_description && (
                            <div className="mb-3 p-2 bg-rose-500/5 border border-rose-500/10 rounded-lg">
                              <p className="text-[9px] text-rose-500/70 italic leading-tight">"{v.status_description}"</p>
                            </div>
                          )}
                          <div className="space-y-2">
                             <div className={`flex justify-between items-center bg-slate-950/50 p-2 rounded-lg border ${isValid ? 'border-slate-800' : 'border-amber-500/20'}`}>
                                <span className="text-[8px] text-slate-500 font-bold uppercase">{summaryLabel}</span>
                                <span className={`text-[10px] font-bold ${isValid ? 'text-white' : 'text-amber-500'}`}>
                                   {isValid ? `${summaryTonnage} Kg` : 'BELUM DIATUR'}
                                </span>
                             </div>
                             <div className="flex flex-wrap gap-1">
                                {Object.keys(tonList).map(upt => (
                                   <div key={upt} className={`px-1.5 py-0.5 rounded text-[7px] font-bold uppercase truncate max-w-[80px] ${upt === 'default' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-slate-800/50 border border-slate-800 text-slate-500'}`}>
                                      {upt}
                                   </div>
                                ))}
                             </div>
                          </div>
                          <button 
                            type="button"
                            onClick={() => { setIsEditing(v); setShowModal(true); }}
                            className="w-full mt-4 py-1.5 bg-slate-800 hover:bg-emerald-600/20 text-slate-500 hover:text-emerald-500 text-[8px] font-bold uppercase tracking-widest rounded-lg transition-all"
                          >
                             Edit Konfigurasi
                          </button>
                      </Card>
                    );
                 };

                 if (searchTerm !== "" && configured.length === 0 && unconfigured.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-12 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800">
                         <Search className="w-8 h-8 text-slate-700 mb-3" />
                         <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Tidak ada kendaraan yang sesuai dengan pencarian</p>
                      </div>
                    );
                 }

                 return (
                    <div className="space-y-12">
                       {unconfigured.length > 0 && (
                          <div className="space-y-6">
                             <div className="flex items-center justify-between px-2">
                                <div className="flex items-center gap-2">
                                   <AlertCircle className="w-4 h-4 text-amber-500" />
                                   <h4 className="text-[10px] font-bold text-white uppercase tracking-widest">Tonase Belum Diatur ({unconfigured.length})</h4>
                                </div>
                             </div>
                             <div className="space-y-4">
                                {groupByType(unconfigured).map(({ type, vehicles: groupVehicles }) => {
                                   const isCollapsed = !expandedTypes.includes(`unconf-${type}`) && searchTerm === "";
                                   return (
                                     <div key={`unconf-${type}`} className="space-y-4">
                                        <button 
                                          type="button"
                                          onClick={() => toggleExpand(`unconf-${type}`)}
                                          className="flex items-center justify-between w-full px-4 py-2 bg-slate-900/40 rounded-lg border border-slate-800/50 hover:bg-slate-800/50 transition-colors group"
                                        >
                                           <div className="flex items-center gap-2">
                                              <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">{type}</span>
                                              <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-[8px] font-bold text-slate-400">{groupVehicles.length}</span>
                                           </div>
                                           <ChevronDown className={`w-3.5 h-3.5 text-slate-600 transition-transform ${!isCollapsed ? 'rotate-180 text-amber-500' : ''}`} />
                                        </button>
                                        <AnimatePresence>
                                          {!isCollapsed && (
                                            <motion.div
                                              initial={{ height: 0, opacity: 0 }}
                                              animate={{ height: 'auto', opacity: 1 }}
                                              exit={{ height: 0, opacity: 0 }}
                                              className="overflow-hidden"
                                            >
                                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 py-1">
                                                 {groupVehicles.map(v => renderCard(v, false))}
                                              </div>
                                            </motion.div>
                                          )}
                                        </AnimatePresence>
                                     </div>
                                   );
                                })}
                             </div>
                          </div>
                       )}

                       {searchTerm === "" && unconfigured.length === 0 && (
                          <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                             <p className="text-[10px] text-emerald-500 font-bold text-center uppercase tracking-widest py-1">Semua kendaraan sudah memiliki konfigurasi tonase</p>
                          </div>
                       )}

                       {configured.length > 0 && (
                          <div className="space-y-6">
                             <div className="flex items-center gap-2 px-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                <h4 className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Tonase Tersedia ({configured.length})</h4>
                             </div>
                             <div className="space-y-4">
                                {groupByType(configured).map(({ type, vehicles: groupVehicles }) => {
                                   const isCollapsed = !expandedTypes.includes(`conf-${type}`) && searchTerm === "";
                                   return (
                                     <div key={`conf-${type}`} className="space-y-4">
                                        <button 
                                          type="button"
                                          onClick={() => toggleExpand(`conf-${type}`)}
                                          className="flex items-center justify-between w-full px-4 py-2 bg-emerald-500/5 rounded-lg border border-emerald-500/10 hover:bg-emerald-500/10 transition-colors group"
                                        >
                                           <div className="flex items-center gap-2">
                                              <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter">{type}</span>
                                              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-[8px] font-bold text-emerald-500">{groupVehicles.length}</span>
                                           </div>
                                           <ChevronDown className={`w-3.5 h-3.5 text-emerald-700 transition-transform ${!isCollapsed ? 'rotate-180 text-emerald-500' : ''}`} />
                                        </button>
                                        <AnimatePresence>
                                          {!isCollapsed && (
                                            <motion.div
                                              initial={{ height: 0, opacity: 0 }}
                                              animate={{ height: 'auto', opacity: 1 }}
                                              exit={{ height: 0, opacity: 0 }}
                                              className="overflow-hidden"
                                            >
                                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 py-1">
                                                 {groupVehicles.map(v => renderCard(v, true))}
                                              </div>
                                            </motion.div>
                                          )}
                                        </AnimatePresence>
                                     </div>
                                   );
                                })}
                             </div>
                          </div>
                       )}
                    </div>
                 );
              })()}
            </div>
          )}

          {["Arm Roll", "Dump Truck", "Motor Roda 3", "Pick Up"].map((type) => {
            const typeVehicles = filteredVehicles.filter((v: any) => v.type === type);
            if (typeVehicles.length === 0) return null;
            const isExpanded = expandedTypes.includes(type) || searchTerm !== "";
            
            return (
              <div key={type} className="flex flex-col gap-4">
                <button 
                  type="button"
                  onClick={() => toggleExpand(type)}
                  className="flex items-center justify-between w-full p-2.5 hover:bg-slate-800/50 rounded-xl border border-transparent hover:border-slate-800 transition-all group"
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-1 h-3.5 bg-emerald-500 rounded-full" />
                    <h3 className="text-[11px] sm:text-xs font-bold text-slate-300 uppercase tracking-widest">{type}</h3>
                    <span className="text-[9px] sm:text-[10px] bg-slate-800/80 text-slate-500 px-2 py-0.5 rounded-md border border-slate-700 font-mono">{typeVehicles.length} Unit</span>
                  </div>
                  <div className={`p-1 rounded-md bg-slate-800 border border-slate-700 text-slate-400 group-hover:text-emerald-500 transition-all ${isExpanded ? 'rotate-180 bg-emerald-500/10 border-emerald-500/20' : ''}`}>
                    <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-2 bg-slate-950/20 border-t border-slate-800">
                        {typeVehicles.map((v: any) => (
                          <div 
                            key={v.id} 
                            className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-col justify-between hover:border-emerald-500/30 transition-all group/card shadow-lg shadow-slate-950/50"
                          >
                            <div className="flex items-center justify-between mb-3 sm:mb-4">
                              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-500">
                                <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </div>
                              <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate max-w-[100px]">
                                {v.upts && v.upts.length > 0 ? v.upts.join(", ") : (v.upt || "Tanpa UPT")}
                              </span>
                            </div>
                            
                            <h4 className="text-base sm:text-lg font-mono font-bold text-white mb-2 group-hover/card:text-emerald-500 transition-colors uppercase truncate">{v.plateNumber}</h4>
                            
                            <div className="flex flex-col gap-1 mb-3 sm:mb-4">
                              <div className="flex items-center gap-2">
                                <div className="p-1 sm:p-1.5 bg-slate-800 rounded-md text-slate-500 shrink-0">
                                  <UserRound className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                </div>
                                <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 truncate">
                                  {drivers.filter((d: any) => d.vehiclePlate === v.plateNumber).length > 0 
                                    ? drivers.filter((d: any) => d.vehiclePlate === v.plateNumber).map((d: any) => d.name).join(", ")
                                    : (v.defaultDriverName || "Belum Ada Personil")}
                                </span>
                              </div>
                              {drivers.filter((d: any) => d.vehiclePlate === v.plateNumber && d.shift).length > 0 && (
                                <div className="flex flex-wrap gap-1 ml-6 sm:ml-8">
                                  {drivers.filter((d: any) => d.vehiclePlate === v.plateNumber && d.shift).map((d: any) => (
                                    <span key={d.id} className="text-[7px] sm:text-[8px] bg-blue-500/10 text-blue-400 px-1 rounded border border-blue-500/20">{d.shift}</span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="mt-1 mb-3 pt-3 border-t border-slate-800/50 flex items-center justify-between">
                              <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-950/80 rounded-lg border border-slate-800/50">
                                <Fuel className="w-3 h-3 text-slate-500" />
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">DO BBM:</span>
                                <span className="text-[10px] font-mono font-bold text-emerald-500">
                                  {v.do_bbm ? `${v.do_bbm} L/hari` : (v.bbm && !isNaN(Number(v.bbm)) ? `${v.bbm} L/hari` : '-')}
                                </span>
                              </div>
                            </div>

                            {isAdmin && (
                              <div className="flex items-center justify-end gap-2 pt-2 sm:pt-3 border-t border-slate-800 sm:opacity-0 sm:group-hover/card:opacity-100 transition-opacity">
                                {confirmDelete === v.id ? (
                                  <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                                    <button type="button" onClick={() => handleDelete(v.id)} className="text-rose-500 hover:text-rose-400 text-[9px] sm:text-[10px] font-bold uppercase">Ya</button>
                                    <button type="button" onClick={() => setConfirmDelete(null)} className="text-slate-500 hover:text-white text-[9px] sm:text-[10px] font-bold uppercase">Batal</button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-3">
                                    <button type="button" onClick={() => { setIsEditing(v); setShowModal(true); }} className="text-slate-500 hover:text-blue-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-colors">Edit</button>
                                    <button type="button" onClick={() => setConfirmDelete(v.id)} className="text-slate-500 hover:text-rose-500 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-colors">Hapus</button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {/* Handle other types if any */}
          {(() => {
            const standardTypes = ["Arm Roll", "Dump Truck", "Motor Roda 3", "Pick Up"];
            const otherVehicles = filteredVehicles.filter((v: any) => !standardTypes.includes(v.type));
            if (otherVehicles.length === 0) return null;
            
            const otherGroups: { [key: string]: any[] } = {};
            otherVehicles.forEach(v => {
              const type = v.type || "Jenis Kendaraan Belum Diatur";
              if (!otherGroups[type]) otherGroups[type] = [];
              otherGroups[type].push(v);
            });

            return Object.keys(otherGroups).sort().map(type => {
              const groupVehicles = otherGroups[type];
              const isExpanded = expandedTypes.includes(type) || searchTerm !== "";
              
              return (
                <div key={type} className="flex flex-col gap-4">
                  <button 
                    type="button"
                    onClick={() => toggleExpand(type)}
                    className="flex items-center justify-between w-full p-2.5 hover:bg-slate-800/50 rounded-xl border border-transparent hover:border-slate-800 transition-all group"
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className={`w-1 h-3.5 rounded-full ${type === "Jenis Kendaraan Belum Diatur" ? "bg-amber-500" : "bg-slate-500"}`} />
                      <h3 className="text-[11px] sm:text-xs font-bold text-slate-300 uppercase tracking-widest">{type}</h3>
                      <span className="text-[9px] sm:text-[10px] bg-slate-800/80 text-slate-500 px-2 py-0.5 rounded-md border border-slate-700 font-mono">{groupVehicles.length} Unit</span>
                    </div>
                    <div className={`p-1 rounded-md bg-slate-800 border border-slate-700 text-slate-400 group-hover:text-emerald-500 transition-all ${isExpanded ? 'rotate-180 bg-emerald-500/10 border-emerald-500/20' : ''}`}>
                      <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden px-2"
                      >
                        <Card className="overflow-hidden bg-slate-900 border-slate-800">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[600px]">
                              <thead className="bg-slate-950/50 border-b border-slate-800">
                                <tr>
                                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Plat Nomor</th>
                                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Jenis</th>
                                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">UPT</th>
                                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">DO BBM</th>
                                  {isAdmin && <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aksi</th>}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800">
                                {groupVehicles.map((v: any) => (
                                  <tr key={v.id} className={`hover:bg-slate-800/30 transition-colors group ${v.status === 'Tidak Aktif' ? 'opacity-70' : ''}`}>
                                    <td className="px-6 py-4">
                                      <div className="flex flex-col">
                                        <span className={`font-mono font-bold ${v.status === 'Tidak Aktif' ? 'text-slate-500' : 'text-emerald-500'}`}>{v.plateNumber}</span>
                                        {v.defaultDriverName && <span className="text-[9px] text-slate-500 uppercase">{v.defaultDriverName}</span>}
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-white font-bold">{v.type || "-"}</td>
                                    <td className="px-6 py-4">
                                      <div className="flex flex-col gap-1">
                                        <div className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase w-fit tracking-wider ${v.status === 'Tidak Aktif' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                                          {v.status || 'Aktif'}
                                        </div>
                                        {v.status === 'Tidak Aktif' && v.status_description && (
                                          <span className="text-[9px] text-slate-500 italic max-w-[150px] truncate" title={v.status_description}>
                                            {v.status_description}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-400">
                                      {v.upts && v.upts.length > 0 ? v.upts.join(", ") : (v.upt || "-")}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-400 whitespace-nowrap">
                                      {v.do_bbm ? `${v.do_bbm} L/hari` : (v.bbm && !isNaN(Number(v.bbm)) ? `${v.bbm} L/hari` : '-')}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                      <div className="flex items-center justify-end gap-3 transition-all">
                                        {confirmDelete === v.id ? (
                                          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                                            <span className="text-[10px] font-bold text-rose-500 uppercase tracking-tight">Hapus?</span>
                                            <button type="button" onClick={() => handleDelete(v.id)} className="text-rose-500 hover:text-rose-400 text-xs font-bold underline">Ya</button>
                                            <button type="button" onClick={() => setConfirmDelete(null)} className="text-slate-500 hover:text-slate-300 text-xs font-bold underline">Batal</button>
                                          </div>
                                        ) : (
                                          <div className="flex items-center justify-end gap-3 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                            <button type="button" onClick={() => { setIsEditing(v); setShowModal(true); }} className="text-slate-500 hover:text-blue-400 text-xs font-bold underline text-right">Edit</button>
                                            <button type="button" onClick={() => setConfirmDelete(v.id)} className="text-slate-500 hover:text-rose-500 text-xs font-bold underline text-right">Hapus</button>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </Card>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            });
          })()}
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-8 flex flex-col gap-6">
            <Card className="bg-slate-900 border-emerald-500/20 p-4 sm:p-6 shadow-xl shadow-slate-950/50">
              <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-widest mb-6">Ringkasan Armada</h3>
              <div className="space-y-5 sm:space-y-6">
                {(() => {
                  const types = ["Arm Roll", "Dump Truck", "Motor Roda 3", "Pick Up"];
                  const total = vehicles.length;
                  const stats = types.map(t => ({
                    label: t,
                    count: vehicles.filter((v: any) => v.type === t).length
                  }));
                  const others = vehicles.filter((v: any) => !types.includes(v.type)).length;
                  if (others > 0) stats.push({ label: "Lainnya", count: others });

                  return stats.map(s => {
                    const percentage = total > 0 ? Math.round((s.count / total) * 100) : 0;
                    return (
                      <div key={s.label} className="space-y-2">
                        <div className="flex items-center justify-between text-[10px] sm:text-xs font-bold">
                          <span className="text-slate-400 truncate mr-2">{s.label}</span>
                          <span className="text-white shrink-0">{s.count} <span className="text-slate-500 sm:inline hidden">Unit</span> <span className="text-emerald-500 ml-1 sm:ml-2">{percentage}%</span></span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            className="h-full bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                          />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
              <div className="mt-8 pt-6 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Armada</span>
                  <span className="text-xl font-bold font-mono text-emerald-500">{vehicles.length}</span>
                </div>
              </div>
            </Card>
            
            <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
              <div className="flex items-center gap-3 text-emerald-500 mb-2">
                <Truck className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Info Operasional</span>
              </div>
              <p className="text-[10px] leading-relaxed text-slate-500">
                Data armada disinkronkan dengan laporan ritase harian untuk memvalidasi plat nomor kendaraan yang beroperasi.
              </p>
            </div>
          </div>
        </div>
      </div>

      <VehicleEditModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setIsEditing(null); }}
        isEditing={isEditing}
        upts={upts}
        drivers={drivers}
        onNotify={onNotify}
        profile={profile}
        onSuccess={() => { setShowModal(false); setIsEditing(null); }}
      />

      <Modal 
        isOpen={showSyncConfirm} 
        onClose={() => setShowSyncConfirm(false)}
        title="Konfirmasi Sinkronisasi & Kalibrasi"
      >
        <div className="flex flex-col gap-6">
          <div className="flex items-start gap-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <div className="p-2 bg-emerald-500 rounded-lg shrink-0">
              <RefreshCw className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm mb-1">Apakah Anda Yakin?</p>
              <p className="text-slate-400 text-xs leading-relaxed">
                Sinkronkan ULANG semua {trips.length} data ritase? Ini akan mengatur ulang urutan ritase dan menghitung ulang tonase berdasarkan konfigurasi Kendaraan & UPT.
              </p>
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <Button onClick={processSyncTonnage} className="w-full h-12">
              Ya, Mulai Sinkronisasi
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
