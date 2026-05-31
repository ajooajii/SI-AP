import React, { useState, useEffect, useMemo } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { doc, updateDoc, addDoc, collection, serverTimestamp, deleteDoc } from "firebase/firestore";
import { 
  Plus, 
  Download, 
  ClipboardList, 
  LogOut, 
  Trash2, 
  Loader2 
} from "lucide-react";
import { motion } from "motion/react";
import { auth, db, handleFirestoreError, OperationType } from "../../lib/firebase";
import { exportTripsToExcel } from "../../lib/excelExport";
import { Button, Input, Select, Card, Badge } from "../master-data/components/SharedUI";
import { TripForm } from "./TripForm";
import { TripsViewProps } from "./ritaseTypes";
import { TripRecord } from "../../types";

export function TripsView({ 
  trips, 
  profile, 
  onNotify, 
  upts, 
  tpas, 
  settings, 
  drivers, 
  vehicles, 
  setActiveTab, 
  users = [], 
  tripFilterRange, 
  setTripFilterRange,
  logActivity
}: TripsViewProps) {
  const isWeightEnabled = settings?.enableWeight !== false;
  const showVolume = settings?.showVolume !== false;

  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState<TripRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  
  // Filter state
  const [driverFilter, setDriverFilter] = useState("");
  const [plateFilter, setPlateFilter] = useState("");
  const [uptFilter, setUptFilter] = useState("");
  const [dateFilter, setDateFilter] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [statusFilter, setStatusFilter] = useState("monthly"); // Default to monthly to save quota

  // Sync global tripFilterRange with local view filters to optimize Firestore reads
  useEffect(() => {
    let newStart = tripFilterRange.start;
    let newEnd = tripFilterRange.end;

    if (statusFilter === 'daily') {
      newStart = dateFilter;
      newEnd = dateFilter;
    } else if (statusFilter === 'monthly') {
      const date = new Date(selectedMonth + "-01");
      newStart = format(startOfMonth(date), 'yyyy-MM-dd');
      newEnd = format(endOfMonth(date), 'yyyy-MM-dd');
    }

    if (newStart !== tripFilterRange.start || newEnd !== tripFilterRange.end) {
      setTripFilterRange({ start: newStart, end: newEnd });
    }
  }, [statusFilter, dateFilter, selectedMonth]);
  
  // Reactively reset UPT filter for user role when Visual Data Ritase is turned OFF
  useEffect(() => {
    if (profile?.role === 'user' && !settings?.visualDataRitase) {
      const userUpt = profile?.assigned_upt_name || profile?.uptName || profile?.upt || "";
      if (uptFilter !== userUpt) {
        setUptFilter(userUpt);
      }
    }
  }, [profile, settings?.visualDataRitase, uptFilter]);

  // Pre-calculate ritase numbers efficiently using useMemo
  const ritaseMap = useMemo(() => {
    const map = new Map<string, number>();
    const grouped: { [key: string]: any[] } = {};
    
    // Group only valid trips to minimize iterations
    trips.forEach(t => {
      const key = `${t.date}_${t.vehiclePlate}_${t.driverName}_${t.upt}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(t);
    });

    // Sort and map indices
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => (a.operationalTime || "").localeCompare(b.operationalTime || ""));
      grouped[key].forEach((t, index) => {
        map.set(t.id, index + 1);
      });
    });
    
    return map;
  }, [trips]);

  const filteredTrips = useMemo(() => {
    return trips.filter((t: any) => {
      const driverSearch = String(driverFilter || "").toLowerCase();
      const plateSearch = String(plateFilter || "").toLowerCase();
      
      const matchesDriver = !driverFilter || (t.driverName || "").toLowerCase().includes(driverSearch);
      const matchesPlate = !plateFilter || (t.vehiclePlate || "").toLowerCase().includes(plateSearch);
      
      // User role is restricted to their assigned UPT
      const userUpt = profile?.assigned_upt_name || profile?.uptName || profile?.upt || "";
      const isUser = profile?.role === 'user';
      
      const matchesUpt = isUser 
        ? (settings?.visualDataRitase ? (!uptFilter || t.upt === uptFilter) : t.upt === userUpt)
        : (!uptFilter || t.upt === uptFilter);
      
      let matchesTime = true;
      if (statusFilter === 'daily') {
        matchesTime = t.date === dateFilter;
      } else if (statusFilter === 'monthly') {
        matchesTime = t.date?.startsWith(selectedMonth);
      }
      
      return matchesDriver && matchesPlate && matchesUpt && matchesTime;
    }).sort((a: any, b: any) => {
      // Sort by date DESC
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      // Within same date, sort by operationalTime DESC
      if (a.operationalTime !== b.operationalTime) return (b.operationalTime || "").localeCompare(a.operationalTime || "");
      // Fallback to timestamp
      return (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0);
    });
  }, [trips, driverFilter, plateFilter, uptFilter, dateFilter, selectedMonth, statusFilter, settings?.visualDataRitase]);

  // Unique options for searchable filters
  const driverOptions = useMemo(() => Array.from(new Set(trips.map(t => t.driverName))).sort().filter(Boolean), [trips]);
  const plateOptions = useMemo(() => Array.from(new Set(trips.map(t => t.vehiclePlate))).sort().filter(Boolean), [trips]);

  const handleTripSubmit = async (data: any) => {
    console.log("DEBUG: (Data Ritase Tab) Creating Trip as", profile?.role, "with UID", auth.currentUser?.uid);
    console.log("DEBUG: Current Profile:", JSON.stringify(profile, null, 2));
    setLoading(true);
    try {
      if (isEditing) {
        const tripRef = doc(db, "trips", isEditing.id);
        const updateData = {
          ...data,
          updatedBy: auth.currentUser?.uid,
          updated_by_user_name: profile?.operator_name || profile?.name || "",
          updatedAt: serverTimestamp(),
          updated_at_timestamp: serverTimestamp()
        };
        console.log("DEBUG: Updating Trip Payload:", JSON.stringify(updateData, null, 2));
        await updateDoc(tripRef, updateData);

        // Log Activity: Update Ritase
        logActivity(
          'operasional', 
          'edit_ritase', 
          'Data Ritase', 
          `Perubahan data ritase: ${isEditing.vehiclePlate} (${isEditing.date})`,
          {
            recordId: isEditing.id,
            recordLabel: isEditing.vehiclePlate,
            beforeData: isEditing,
            afterData: data,
            profile
          }
        );

        onNotify('success', 'Data ritase berhasil diperbarui');
      } else {
        const tripData = {
          ...data,
          createdBy: auth.currentUser?.uid,
          created_by_upt_id: profile?.assigned_upt_id || profile?.uptId || "",
          created_by_upt_name: profile?.assigned_upt_name || profile?.uptName || "",
          created_by_user_name: profile?.operator_name || profile?.name || "",
          created_by_username: profile?.username || "",
          created_by_account_name: profile?.account_name || profile?.upt || "",
          timestamp: serverTimestamp(),
          created_at_timestamp: serverTimestamp(),
          updated_at_timestamp: serverTimestamp(),
          is_submission_approved: null,
          approved_by: "",
          approved_at: null,
          submission_note: ""
        };
        
        console.log("DEBUG: Trip Payload Data (Create):", JSON.stringify(tripData, (key, value) => {
          if (typeof value === 'object' && value !== null && 'type' in value && value.type === 'server_timestamp') return "SERVER_TIMESTAMP";
          return value;
        }, 2));
        
        const docRef = await addDoc(collection(db, "trips"), tripData);

        // Log Activity: Tambah Ritase (dari menu Data Ritase)
        logActivity(
          'operasional', 
          'tambah_ritase', 
          'Data Ritase', 
          `Input data ritase baru: ${data.vehiclePlate} oleh ${data.driverName}`,
          {
            recordId: docRef.id,
            recordLabel: data.vehiclePlate,
            afterData: data,
            profile
          }
        );

        onNotify('success', 'Data ritase berhasil disimpan');
      }
      setShowModal(false);
      setIsEditing(null);
    } catch (error) {
      handleFirestoreError(error, isEditing ? OperationType.UPDATE : OperationType.CREATE, "trips");
      onNotify('error', 'Gagal menyimpan data');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      const tripToDelete = trips.find((t: any) => t.id === id);
      await deleteDoc(doc(db, "trips", id));

      // Log Activity: Hapus Ritase
      logActivity(
        'operasional', 
        'hapus_ritase', 
        'Data Ritase', 
        `Penghapusan data ritase: ${tripToDelete?.vehiclePlate || id}`,
        {
          recordId: id,
          recordLabel: tripToDelete?.vehiclePlate || id,
          beforeData: tripToDelete,
          profile
        }
      );

      onNotify('success', 'Data ritase berhasil dihapus');
      setConfirmDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `trips/${id}`);
      onNotify('error', 'Gagal menghapus data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white tracking-tight">Data Ritase</h2>
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-500 uppercase tracking-wider">{trips.length} Records Terbaru</span>
          </div>
          <p className="text-slate-500 text-sm">Menampilkan porsi data untuk performa maksimal. Gunakan Pusat Ekspor untuk seluruh data historis.</p>
        </div>
        <div className="flex items-center gap-3">
          {profile?.role === 'admin' && (
            <Button 
              variant="secondary" 
              onClick={async () => {
                let suffix = "Semua";
                if (statusFilter === 'daily') suffix = dateFilter;
                else if (statusFilter === 'monthly') suffix = selectedMonth;
                const fileName = `Data_Ritase_${suffix}`;
                await exportTripsToExcel(filteredTrips, fileName, users);
                onNotify('success', 'Data diunduh ke Excel. Data di app tetap tersimpan.');
              }}
              disabled={filteredTrips.length === 0}
              className="text-xs py-3"
            >
              <Download className="w-4 h-4" /> Ekspor Tampilan (Excel)
            </Button>
          )}
          <Button onClick={() => setActiveTab("input-ritase")}>
            <Plus className="w-5 h-5" /> Input Ritase Baru
          </Button>
        </div>
      </div>

      <Card className="p-4 md:p-6 bg-slate-900 border-slate-800">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Tampilan</span>
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1">
              <button 
                onClick={() => setStatusFilter('monthly')}
                className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${statusFilter === 'monthly' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:bg-slate-900'}`}
              >
                Bulan
              </button>
              <button 
                onClick={() => setStatusFilter('daily')}
                className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${statusFilter === 'daily' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:bg-slate-900'}`}
              >
                Hari
              </button>
            </div>
          </div>
          {statusFilter === 'daily' && (
            <Input 
              label="Pilih Tanggal"
              type="date"
              value={dateFilter}
              onChange={(e: any) => setDateFilter(e.target.value)}
            />
          )}
          {statusFilter === 'monthly' && (
            <Input 
              label="Pilih Bulan"
              type="month"
              value={selectedMonth}
              onChange={(e: any) => setSelectedMonth(e.target.value)}
            />
          )}
          <Select 
            label="Filter UPT"
            options={[
              { label: "Semua UPT", value: "" },
              ...upts.map((u: any) => ({ label: u.name, value: u.name }))
            ]} 
            value={(profile?.role === 'user' && !settings?.visualDataRitase) ? (profile?.assigned_upt_name || profile?.uptName || profile?.upt || "") : uptFilter}
            onChange={(e: any) => setUptFilter(e.target.value)}
            placeholder="Filter UPT..."
            disabled={profile?.role === 'user' && !settings?.visualDataRitase}
          />
          <Select 
            label="Filter Sopir"
            placeholder="Filter Sopir..." 
            value={driverFilter}
            onChange={(e: any) => setDriverFilter(e.target.value)}
            options={[{ label: "Semua Sopir", value: "" }, ...driverOptions]}
          />
          <Select 
            label="Filter Plat"
            placeholder="Filter Plat Nomor..." 
            value={plateFilter}
            onChange={(e: any) => setPlateFilter(e.target.value)}
            options={[{ label: "Semua Plat", value: "" }, ...plateOptions]}
          />
        </div>

        <div className="overflow-x-auto -mx-4 md:-mx-6 custom-scrollbar-horizontal pb-2">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="bg-slate-950/50 border-y border-slate-800">
              <tr>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Waktu Ops / Input</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">UPT</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">TPA</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sopir / Plat</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Jenis</th>
                {(isWeightEnabled && (profile?.role === 'admin' || profile?.role === 'co-admin')) && <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tonase (Kg)</th>}
                {showVolume && <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Volume (m³)</th>}
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ritase Ke</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Input Oleh</th>
                {(profile?.role === 'admin' || profile?.role === 'co-admin') && (
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aksi</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredTrips.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center">
                        <ClipboardList className="w-8 h-8 text-slate-600" />
                      </div>
                      <h3 className="text-white font-bold">Data Tidak Ditemukan</h3>
                      <p className="text-slate-500 text-sm max-w-xs mx-auto">
                        Tidak ada data untuk filter {statusFilter === 'daily' ? 'Hari' : 'Bulan'} ini.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredTrips.map((trip) => (
                <tr key={trip.id} className="hover:bg-slate-800/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-300">
                          {format(new Date(trip.date.replace(/-/g, '/')), 'dd MMM yyyy')}
                        </span>
                        <span className="text-xs font-mono text-emerald-500">{trip.operationalTime || "-"}</span>
                      </div>
                      {trip.timestamp && (
                        <span className="text-[9px] text-slate-600 font-bold uppercase mt-1 opacity-70">
                          Entry: {format(trip.timestamp.toDate(), 'dd/MM/yy HH:mm')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="user">{trip.upt}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{trip.tpa}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-sm font-bold text-white mb-0.5">{trip.driverName}</p>
                    <p className="text-[10px] text-emerald-500 font-mono font-bold tracking-tight">{trip.vehiclePlate}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                      {trip.vehicleType || "-"}
                    </span>
                  </td>
                  {(isWeightEnabled && (profile?.role === 'admin' || profile?.role === 'co-admin')) && (
                    <td className="px-6 py-4 text-sm text-slate-200 font-bold whitespace-nowrap">
                      {trip.tonnage || 0} Kg
                    </td>
                  )}
                  {showVolume && <td className="px-6 py-4 text-sm text-slate-400 font-mono whitespace-nowrap">{trip.volume || 0}</td>}
                  <td className="px-6 py-4 whitespace-nowrap">
                     <span className="text-sm font-bold text-white bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 whitespace-nowrap">Rit ke-{ritaseMap.get(trip.id) || 1}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-0.5">
                      {trip.created_by_user_name ? (
                        <>
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                            <span className="text-[10px] font-bold text-white uppercase tracking-tight">
                              {trip.created_by_user_name}
                            </span>
                          </div>
                          <p className="text-[9px] text-slate-500 font-bold ml-3 uppercase tracking-tighter">
                            {trip.created_by_upt_name || (profile?.role === 'admin' ? "ADMIN DLH" : "SISTEM")}
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-600"></div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{trip.upt || "Sistem"}</span>
                          </div>
                          <p className="text-[9px] text-slate-600 font-medium ml-3">Legacy/Auto Record</p>
                        </>
                      )}
                    </div>
                  </td>
                  {(profile?.role === 'admin' || profile?.role === 'co-admin') && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3 md:opacity-0 md:group-hover:opacity-100 transition-all">
                        <button onClick={() => { setIsEditing(trip); setShowModal(true); }} className="text-slate-500 hover:text-emerald-500 text-xs font-bold underline transition-colors">
                          Edit
                        </button>
                        <button onClick={() => setConfirmDelete(trip.id)} className="text-slate-500 hover:text-rose-500 text-xs font-bold underline transition-colors">
                          Hapus
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filteredTrips.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-24 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-20">
                      <ClipboardList size={64} className="text-slate-400" />
                      <p className="text-sm font-bold tracking-widest uppercase text-slate-500">Database Kosong</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="bg-slate-900 rounded-2xl w-full max-w-lg p-8 shadow-2xl border border-slate-800"
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-white tracking-tight">{isEditing ? "Edit Data Ritase" : "Input Ritase Baru"}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white transition-colors">
                <LogOut className="w-6 h-6 rotate-180" />
              </button>
            </div>
            <TripForm 
              onNotify={onNotify}
              initialData={isEditing} 
              onSubmit={handleTripSubmit} 
              onCancel={() => setShowModal(false)}
              loading={loading}
              upts={upts}
              tpas={tpas}
              settings={settings}
              profile={profile}
              drivers={drivers}
              vehicles={vehicles}
              trips={trips}
            />
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            className="bg-slate-900 rounded-2xl w-full max-w-sm p-8 border border-slate-800 shadow-2xl"
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div className="p-4 bg-rose-500/10 rounded-full text-rose-500 mb-2">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white">Hapus Data Ritase?</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Tindakan ini tidak dapat dibatalkan. Seluruh informasi ritase ini akan dihapus permanen dari database.
              </p>
              <div className="flex flex-col w-full gap-3 mt-6">
                <Button 
                  variant="primary" 
                  className="w-full bg-rose-600 hover:bg-rose-500 text-white" 
                  onClick={() => handleDelete(confirmDelete)}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Ya, Hapus Data"}
                </Button>
                <Button 
                  variant="secondary" 
                  className="w-full" 
                  onClick={() => setConfirmDelete(null)}
                  disabled={loading}
                >
                  Batal
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
