import React, { useState } from "react";
import { motion } from "motion/react";
import { MapPin, Loader2, RefreshCw, LogOut } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import { UserProfile } from "../../types";

interface UptAssignmentPendingViewProps {
  profile: UserProfile | null;
  onNotify: (type: "success" | "error" | "info" | "warning", message: string) => void;
  logActivity: any;
}

export function UptAssignmentPendingView({ profile, onNotify, logActivity }: UptAssignmentPendingViewProps) {
  const [checking, setChecking] = useState(false);

  const handleRefresh = async () => {
    setChecking(true);
    try {
      const user = auth.currentUser;
      if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.assigned_upt_id) {
            onNotify('success', 'Pembagian wilayah UPT tugas terdeteksi! Memuat ulang...');
            window.location.reload();
          } else {
            onNotify('error', 'Wilayah UPT tugas Anda belum ditentukan oleh Admin.');
          }
        }
      }
    } catch (err) {
      console.error(err);
      onNotify('error', 'Gagal memeriksa UPT tugas.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-200">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6 text-center"
      >
        <div className="flex justify-center">
          <div className="p-4 bg-amber-500/10 rounded-full text-amber-500 border border-amber-500/20 shadow-lg shadow-amber-500/5">
            <MapPin className="w-12 h-12" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">Akun belum memiliki UPT tugas.</h2>
          <p className="text-sm text-slate-400">Silakan hubungi administrator untuk penugasan wilayah UPT.</p>
        </div>

        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-left space-y-3">
          <p className="text-xs text-slate-400 leading-relaxed">
            Akun Anda sudah diaktifkan sebagai User Operasional, namun belum diberikan wilayah tugas UPT. Anda tidak dapat menginput atau melihat data ritase sebelum ditugaskan ke salah satu UPT.
          </p>
          {profile && (
            <div className="pt-2 border-t border-slate-800 text-[11px] space-y-1">
              <div className="flex justify-between"><span className="text-slate-500">Nama Akun:</span> <span className="font-mono text-slate-300">{profile.account_name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Email:</span> <span className="font-mono text-slate-300">{profile.email}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Username:</span> <span className="font-mono text-slate-300">{profile.username}</span></div>
              <div className="flex justify-between">
                <span className="text-slate-500">Role / Status:</span> 
                <span className="font-bold font-mono text-amber-500 uppercase">{profile.role} / {profile.status}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleRefresh}
            disabled={checking}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-850 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-950/20"
          >
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Cek Penugasan UPT
          </button>

          <button
            onClick={async () => {
              if (profile && logActivity) {
                await logActivity('login', 'logout', 'Autentikasi', 'User keluar dari sistem (Pending UPT Screen)', { profile });
              }
              signOut(auth);
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-500 border border-rose-500/20 font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
          >
            <LogOut className="w-4 h-4" />
            Keluar / Logout
          </button>
        </div>
      </motion.div>
    </div>
  );
}
