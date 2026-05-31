import React, { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Truck, ClipboardList } from "lucide-react";
import { auth, db, handleFirestoreError, OperationType } from "../../lib/firebase";
import { InputRitaseViewProps } from "./ritaseTypes";
import { TripForm } from "./TripForm";

// Micro-component for layout consistency
const Card = ({ children, className = "", ...props }: any) => (
  <div {...props} className={`bg-slate-900 rounded-2xl border border-slate-800 shadow-xl ${className}`}>
    {children}
  </div>
);

export function InputRitaseView({ 
  onNotify, 
  upts, 
  tpas, 
  settings, 
  profile, 
  drivers, 
  vehicles, 
  setActiveTab, 
  trips,
  logActivity 
}: InputRitaseViewProps) {
  const [loading, setLoading] = useState(false);

  const handleTripSubmit = async (data: any) => {
    console.log("DEBUG: Creating Trip as", profile?.role, "with UID", auth.currentUser?.uid);
    console.log("DEBUG: Current Profile:", JSON.stringify(profile, null, 2));
    setLoading(true);
    try {
      const tripData = {
        ...data,
        createdBy: auth.currentUser?.uid,
        created_by_upt_id: profile?.assigned_upt_id || profile?.uptId || "",
        created_by_upt_name: profile?.assigned_upt_name || profile?.uptName || profile?.upt || "",
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
      
      console.log("DEBUG: Trip Payload Data:", JSON.stringify(tripData, (key, value) => {
        if (typeof value === 'object' && value !== null && 'type' in value && value.type === 'server_timestamp') return "SERVER_TIMESTAMP";
        return value;
      }, 2));
      
      const docRef = await addDoc(collection(db, "trips"), tripData);
      
      // Log Activity: Ritase Input
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
      setActiveTab('trips');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "trips");
      onNotify('error', 'Gagal menyimpan data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-8">
      <div className="text-center">
        <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
          <Truck className="w-8 h-8 text-emerald-500" />
        </div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Input Ritase Baru</h2>
        <p className="text-slate-500 mt-2">Pastikan semua data sudah sesuai dengan laporan armada.</p>
      </div>

      <Card className="p-8 bg-slate-900/50 backdrop-blur-xl border-slate-800 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-5">
           <ClipboardList className="w-32 h-32 text-emerald-500" />
        </div>
        <TripForm 
          onNotify={onNotify}
          onSubmit={handleTripSubmit} 
          onCancel={() => setActiveTab('trips')}
          loading={loading}
          upts={upts}
          tpas={tpas}
          settings={settings}
          profile={profile}
          drivers={drivers}
          vehicles={vehicles}
          trips={trips}
        />
      </Card>
    </div>
  );
}
