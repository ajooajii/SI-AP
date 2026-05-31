import React, { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { 
  Truck, 
  Eye, 
  ShieldCheck, 
  Lock, 
  Unlock, 
  RotateCcw, 
  Loader2, 
  AlertCircle 
} from "lucide-react";
import { doc, setDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../../lib/firebase";
import { Card, Button, Select } from "../master-data/components/SharedUI";
import { SettingsViewProps, SystemSettings } from "./settingsTypes";
import { QUALITY_CONTROL_ITEMS } from "./settingsConstants";
import { initializeDraftSettings, countChanges } from "./settingsUtils";

export function SettingsView({ onNotify, settings, tpas, profile, logActivity }: SettingsViewProps) {
  const [updatingSettings, setUpdatingSettings] = useState(false);
  const [draftSettings, setDraftSettings] = useState<SystemSettings | null>(null);

  // Initialize draft settings from saved settings
  useEffect(() => {
    if (settings && !draftSettings) {
      setDraftSettings(initializeDraftSettings(settings));
    }
  }, [settings, draftSettings]);

  const changedKeys = useMemo(() => {
    if (!settings || !draftSettings) return [];
    return countChanges(settings, draftSettings);
  }, [settings, draftSettings]);

  const hasChanges = changedKeys.length > 0;

  const handleUpdateSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!hasChanges || !draftSettings) return;

    setUpdatingSettings(true);
    const data = { ...draftSettings };

    try {
      await setDoc(doc(db, "settings", "global"), data);

      if (logActivity) {
        logActivity(
          'sistem', 
          'update_settings', 
          'Pengaturan Sistem', 
          `Pembaruan ${changedKeys.length} konfigurasi sistem: ${changedKeys.join(', ')}`,
          {
            beforeData: settings,
            afterData: data,
            profile
          }
        );
      }

      onNotify('success', 'Pengaturan global berhasil diperbarui');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "settings/global");
      onNotify('error', 'Gagal memperbarui pengaturan');
    } finally {
      setUpdatingSettings(false);
    }
  };

  const handleReset = () => {
    if (settings) {
      setDraftSettings(initializeDraftSettings(settings));
    }
  };

  if (!draftSettings) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-5xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Pusat Pengaturan Sistem</h2>
          <p className="text-slate-500 text-sm">Konfigurasi operasional, visibilitas data, dan kontrol kualitas database.</p>
        </div>
        
        {hasChanges && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="px-4 py-2 bg-orange-500/10 border border-orange-500/50 rounded-xl flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-bold text-orange-500 uppercase tracking-wider">Perubahan belum disimpan</span>
          </motion.div>
        )}
      </div>

      <form onSubmit={handleUpdateSettings} className="flex flex-col gap-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* GROUP: RITASE & OPERASIONAL */}
          <Card className="p-6 sm:p-8 bg-slate-900 border-slate-800 shadow-2xl flex flex-col gap-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
              <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                <Truck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">Ritase & Operasional</h3>
            </div>

            <Select 
              label="TPA Utama" 
              name="mainTpaId" 
              required 
              value={draftSettings.mainTpaId}
              onChange={(e: any) => setDraftSettings({ ...draftSettings, mainTpaId: e.target.value })}
              options={tpas.map((t: any) => ({ value: t.id, label: t.name }))}
            />
            
            <div className="flex flex-col gap-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Kunci Pilihan TPA</label>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  type="button"
                  onClick={() => setDraftSettings({ ...draftSettings, isTpaLocked: true })}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border cursor-pointer transition-all ${draftSettings.isTpaLocked ? 'bg-rose-500/10 border-rose-500/50 text-rose-500 shadow-lg shadow-rose-900/10' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                >
                  <Lock className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Dikunci</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setDraftSettings({ ...draftSettings, isTpaLocked: false })}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border cursor-pointer transition-all ${!draftSettings.isTpaLocked ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500 shadow-lg shadow-emerald-900/10' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                >
                  <Unlock className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Terbuka</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-600 italic">
                * Kunci Pilihan TPA berlaku untuk seluruh level akses (Admin & User).
              </p>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-800">
               <div className="flex items-center justify-between p-4 bg-slate-950/50 rounded-xl border border-slate-800">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-bold text-slate-200">Fitur Tonase (Berat)</span>
                    <span className="text-[10px] text-slate-500 italic">Aktifkan modul perhitungan berat sampah.</span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => setDraftSettings({ ...draftSettings, enableWeight: true })}
                      className={`px-3 py-1 rounded font-bold text-[10px] uppercase transition-all ${draftSettings.enableWeight ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'bg-slate-800 text-slate-500'}`}
                    >
                      ON
                    </button>
                    <button 
                      type="button"
                      onClick={() => setDraftSettings({ ...draftSettings, enableWeight: false })}
                      className={`px-3 py-1 rounded font-bold text-[10px] uppercase transition-all ${!draftSettings.enableWeight ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/20' : 'bg-slate-800 text-slate-500'}`}
                    >
                      OFF
                    </button>
                  </div>
                </div>
            </div>
          </Card>

          {/* GROUP: VISUAL & TAMPILAN DATA */}
          <Card className="p-6 sm:p-8 bg-slate-900 border-slate-800 shadow-2xl flex flex-col gap-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
              <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                <Eye className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">Visual & Tampilan Data</h3>
            </div>

            <div className="space-y-4">
              <div className={`flex items-center justify-between p-4 bg-slate-950/50 rounded-xl border border-slate-800 transition-opacity ${!draftSettings.enableWeight ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold text-slate-200">Tonase di Form Input</span>
                  <span className="text-[10px] text-slate-500 italic">Munculkan kolom input berat pada form ritase.</span>
                </div>
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => setDraftSettings({ ...draftSettings, showWeightInForm: true })}
                    className={`px-3 py-1 rounded font-bold text-[10px] uppercase transition-all ${draftSettings.showWeightInForm ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500'}`}
                  >
                    TAMPIL
                  </button>
                  <button 
                    type="button"
                    onClick={() => setDraftSettings({ ...draftSettings, showWeightInForm: false })}
                    className={`px-3 py-1 rounded font-bold text-[10px] uppercase transition-all ${!draftSettings.showWeightInForm ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-500'}`}
                  >
                    OFF
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-950/50 rounded-xl border border-slate-800">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold text-slate-200">Kolom Volume (m³)</span>
                  <span className="text-[10px] text-slate-500 italic">Tampilkan input volume sampah.</span>
                </div>
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => setDraftSettings({ ...draftSettings, showVolume: true })}
                    className={`px-3 py-1 rounded font-bold text-[10px] uppercase transition-all ${draftSettings.showVolume ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500'}`}
                  >
                    ON
                  </button>
                  <button 
                    type="button"
                    onClick={() => setDraftSettings({ ...draftSettings, showVolume: false })}
                    className={`px-3 py-1 rounded font-bold text-[10px] uppercase transition-all ${!draftSettings.showVolume ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-500'}`}
                  >
                    OFF
                  </button>
                </div>
              </div>

              <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-bold text-slate-200">Visual Data Ritase</span>
                    <span className="text-[10px] text-slate-500 italic">Cakupan visibilitas data untuk Role User.</span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => setDraftSettings({ ...draftSettings, visualDataRitase: true })}
                      className={`px-3 py-1 rounded font-bold text-[10px] uppercase transition-all ${draftSettings.visualDataRitase ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500'}`}
                    >
                      AKTIF
                    </button>
                    <button 
                      type="button"
                      onClick={() => setDraftSettings({ ...draftSettings, visualDataRitase: false })}
                      className={`px-3 py-1 rounded font-bold text-[10px] uppercase transition-all ${!draftSettings.visualDataRitase ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-500'}`}
                    >
                      OFF
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed italic pr-4">
                  * {draftSettings.visualDataRitase ? "User dapat melihat seluruh UPT." : "User hanya melihat UPT-nya sendiri."}
                </p>
              </div>
            </div>
          </Card>

          {/* GROUP: DATABASE QUALITY CONTROL */}
          <Card className="p-6 sm:p-8 bg-slate-900 border-slate-800 shadow-2xl flex flex-col gap-6 lg:col-span-2">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
              <div className="p-2 bg-orange-500/10 rounded-lg text-orange-500">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">Database Quality Control</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {QUALITY_CONTROL_ITEMS.map((item) => (
                <div key={item.key} className="p-4 bg-slate-950/50 rounded-xl border border-slate-800 flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-200">{item.label}</h4>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      {draftSettings[item.key] ? item.desc_on : item.desc_off}
                    </p>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-slate-800/50">
                    <button 
                      type="button"
                      onClick={() => setDraftSettings({ ...draftSettings, [item.key]: true })}
                      className={`flex-1 py-1.5 rounded font-bold text-[10px] uppercase transition-all ${draftSettings[item.key] ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500'}`}
                    >
                      ON
                    </button>
                    <button 
                      type="button"
                      onClick={() => setDraftSettings({ ...draftSettings, [item.key]: false })}
                      className={`flex-1 py-1.5 rounded font-bold text-[10px] uppercase transition-all ${!draftSettings[item.key] ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-500'}`}
                    >
                      OFF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* GROUP: SISTEM & KEAMANAN */}
          <Card className="p-6 sm:p-8 bg-slate-900 border-slate-800 shadow-2xl flex flex-col gap-6 lg:col-span-2">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
              <div className="p-2 bg-rose-500/10 rounded-lg text-rose-500">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">Sistem & Keamanan</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-4">
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                  <h4 className="text-sm font-bold text-emerald-500 mb-2">Audit Log</h4>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Setiap perubahan pada pengaturan ini akan dicatat ke dalam Log Aktivitas secara permanen untuk kebutuhan audit sistem.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                 <div className="flex items-center justify-between p-4 bg-slate-950/50 rounded-xl border border-slate-800">
                    <div>
                      <h4 className="text-sm font-bold text-white">Mode Pemeliharaan</h4>
                      <p className="text-[10px] text-slate-500 italic">Coming soon</p>
                    </div>
                    <div className="opacity-30 pointer-events-none">
                      <div className="w-10 h-5 bg-slate-800 rounded-full relative">
                        <div className="absolute left-1 top-1 w-3 h-3 bg-slate-600 rounded-full" />
                      </div>
                    </div>
                 </div>

                 <div className="flex items-center justify-between p-4 bg-slate-950/50 rounded-xl border border-slate-800">
                    <div className="flex flex-col gap-0.5">
                      <h4 className="text-sm font-bold text-slate-200">Tampilkan Menu Laporan untuk Co-Admin</h4>
                      <p className="text-[10px] text-slate-500 leading-normal max-w-xs italic">
                        Jika aktif, akun co-admin dapat melihat dan membuka menu Laporan. Jika nonaktif, menu Laporan disembunyikan dari co-admin.
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button 
                        type="button"
                        onClick={() => setDraftSettings({ ...draftSettings, showReportsForCoAdmin: true })}
                        className={`px-3 py-1 rounded font-bold text-[10px] uppercase transition-all ${draftSettings.showReportsForCoAdmin ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/50' : 'bg-slate-800 text-slate-500'}`}
                      >
                        AKTIF
                      </button>
                      <button 
                        type="button"
                        onClick={() => setDraftSettings({ ...draftSettings, showReportsForCoAdmin: false })}
                        className={`px-3 py-1 rounded font-bold text-[10px] uppercase transition-all ${!draftSettings.showReportsForCoAdmin ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/50' : 'bg-slate-800 text-slate-500'}`}
                      >
                        OFF
                      </button>
                    </div>
                 </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 mt-4">
          <Button 
            type="submit" 
            disabled={updatingSettings || !hasChanges} 
            className={`flex-1 sm:flex-none sm:min-w-[240px] py-4 transition-all duration-300 ${hasChanges ? 'shadow-lg shadow-emerald-900/40 scale-[1.02]' : 'opacity-50'}`}
          >
            {updatingSettings ? <Loader2 className="w-5 h-5 animate-spin" /> : "Simpan Semua Perubahan"}
          </Button>
          
          {hasChanges && (
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-2 px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-white transition-colors group"
            >
              <RotateCcw className="w-4 h-4 group-hover:rotate-[-45deg] transition-transform" />
              Reset Perubahan
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
