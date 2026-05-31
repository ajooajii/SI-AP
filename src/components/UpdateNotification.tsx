import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  X, 
  Loader2, 
  Info,
  ArrowRight
} from "lucide-react";
import { APP_VERSION, APP_BUILD_TIMESTAMP } from "../config/buildInfo";

interface UpdateNotificationProps {
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export interface UpdateCheckerRef {
  checkUpdates: (isManual: boolean) => Promise<void>;
}

export const UpdateNotification = forwardRef<UpdateCheckerRef, UpdateNotificationProps>(({ onNotify }, ref) => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [serverVersion, setServerVersion] = useState<any>(null);
  const [flowState, setFlowState] = useState<"main" | "confirm_skip" | "ack_skip" | "closed">("closed");
  const [checking, setChecking] = useState(false);
  const [updateCheckBlockedByCache, setUpdateCheckBlockedByCache] = useState(false);
  const [reloadAttempted, setReloadAttempted] = useState(false);

  // Read stored loop guards on Mount
  useEffect(() => {
    const attempted = sessionStorage.getItem("siap_update_reload_attempted") === "true";
    const savedTarget = sessionStorage.getItem("siap_update_target_timestamp");
    
    if (attempted && savedTarget) {
      if (APP_BUILD_TIMESTAMP === savedTarget) {
        // Successfully updated! Clear flags
        sessionStorage.removeItem("siap_update_reload_attempted");
        sessionStorage.removeItem("siap_update_target_timestamp");
      } else {
        // We attempted a reload, but local build timestamp is still older than target.
        setReloadAttempted(true);
      }
    }
  }, []);

  const checkUpdates = async (isManual: boolean) => {
    if (isManual) {
      setChecking(true);
    }
    try {
      // Fetch /version.json with cache: no-store and dynamic cache-buster t
      const response = await fetch(`/version.json?t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        }
      });
      
      if (!response.ok) {
        throw new Error("Gagal mengambil version metadata");
      }
      
      const contentType = response.headers.get("content-type") || "";
      let fileData: any = null;
      let blockedByCache = false;

      if (contentType.includes("application/json")) {
        fileData = await response.json();
      } else {
        const text = await response.text();
        if (text.toLowerCase().includes("<html") || text.toLowerCase().includes("<!doctype html>")) {
          blockedByCache = true;
        } else {
          try {
            fileData = JSON.parse(text);
          } catch (parseErr) {
            throw new Error("Format respons tidak valid");
          }
        }
      }

      // If blocked by cache, version check fails to give proper JSON because index.html is intercepted
      if (blockedByCache) {
        setUpdateCheckBlockedByCache(true);
        setUpdateAvailable(true);
        
        const isPostponed = sessionStorage.getItem("siap_update_postponed") === "true";
        if (isManual || !isPostponed) {
          setFlowState("main");
        }
        
        if (isManual) {
          onNotify("success", "Pembaruan versi terbaru terdeteksi!");
        }
        return;
      }

      setUpdateCheckBlockedByCache(false);
      
      const serverTimestamp = fileData?.buildTimestamp;
      
      // Perform strict date timestamp comparison if available
      let isStrictlyNewer = false;
      if (serverTimestamp && APP_BUILD_TIMESTAMP) {
        const serverTime = new Date(serverTimestamp).getTime();
        const localTime = new Date(APP_BUILD_TIMESTAMP).getTime();
        if (!isNaN(serverTime) && !isNaN(localTime)) {
          isStrictlyNewer = serverTime > localTime;
        }
      }

      if (isStrictlyNewer) {
        setServerVersion(fileData);
        setUpdateAvailable(true);
        
        // Handle target timestamp and reload attempt loop guard
        const attempted = sessionStorage.getItem("siap_update_reload_attempted") === "true";
        const savedTarget = sessionStorage.getItem("siap_update_target_timestamp");
        
        // If we already attempted reload for this specific version and we are still old
        if (attempted && savedTarget === serverTimestamp) {
          setReloadAttempted(true);
          const isPostponed = sessionStorage.getItem("siap_update_postponed") === "true";
          if (isManual || !isPostponed) {
            setFlowState("main");
          }
          if (isManual) {
            onNotify("success", "Versi baru tersedia tetapi browser memuat cache lama.");
          }
          return;
        }

        const isPostponed = sessionStorage.getItem("siap_update_postponed") === "true";
        if (isManual || !isPostponed) {
          setFlowState("main");
        }
        
        if (isManual) {
          onNotify("success", "Pembaruan versi terbaru terdeteksi!");
        }
      } else {
        // If matches or server is older/invalid, ensure we clear any stale session flags
        const savedTarget = sessionStorage.getItem("siap_update_target_timestamp");
        if (savedTarget === serverTimestamp || !isStrictlyNewer) {
          sessionStorage.removeItem("siap_update_reload_attempted");
          sessionStorage.removeItem("siap_update_target_timestamp");
        }
        setUpdateAvailable(false);
        if (isManual) {
          onNotify("success", "Aplikasi sudah menggunakan versi terbaru.");
        }
      }
    } catch (error) {
      console.error("Gagal memeriksa pembaruan:", error);
      if (isManual) {
        onNotify("error", "Gagal memeriksa pembaruan. Coba lagi beberapa saat lagi.");
      }
    } finally {
      if (isManual) {
        setChecking(false);
      }
    }
  };

  useImperativeHandle(ref, () => ({
    checkUpdates
  }));

  useEffect(() => {
    checkUpdates(false);
  }, []);

  const checkIsFillingForm = () => {
    const inputs = document.querySelectorAll(
      'input:not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), select, textarea'
    );
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i] as any;
      if (document.activeElement === input) {
        return true;
      }
      if (input.value && input.value !== "" && input.closest("form")) {
        return true;
      }
    }
    return false;
  };

  const handlePerformUpdate = async () => {
    if (checkIsFillingForm()) {
      onNotify("error", "Simpan data terlebih dahulu sebelum memperbarui aplikasi.");
      return;
    }

    // Set stable sessionStorage loop guards before reload
    const targetTimestamp = serverVersion?.buildTimestamp || "CACHE_BLOCKED";
    sessionStorage.setItem("siap_update_target_timestamp", targetTimestamp);
    sessionStorage.setItem("siap_update_reload_attempted", "true");

    try {
      // Unregister service workers first
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          if (reg.waiting) {
            reg.waiting.postMessage({ type: "SKIP_WAITING" });
          }
          await reg.unregister();
        }
      }

      // Clear app shell caches safely
      if ("caches" in window) {
        try {
          const cacheNames = await caches.keys();
          await Promise.all(
            cacheNames.map(name => {
              if (
                name.includes("workbox") || 
                name.includes("app-shell") || 
                name.includes("si-ap") || 
                name.includes("static") || 
                name.includes("runtime")
              ) {
                return caches.delete(name);
              }
              return Promise.resolve(false);
            })
          );
        } catch (cErr) {
          console.warn("Gagal membersihkan cache shell:", cErr);
        }
      }
    } catch (err) {
      console.error("Error selama proses aktivasi SW:", err);
    }

    // Reload with query cache buster
    window.location.href = window.location.origin + window.location.pathname + "?v=" + Date.now();
  };

  const handlePostponeUpdate = () => {
    setFlowState("confirm_skip");
  };

  const handleCancelPostpone = () => {
    setFlowState("main");
  };

  const handleConfirmPostpone = () => {
    setFlowState("ack_skip");
  };

  const handleDismissAck = () => {
    sessionStorage.setItem("siap_update_postponed", "true");
    setFlowState("closed");
  };

  const manualGuidanceText = "Jika aplikasi masih menampilkan versi lama, tutup aplikasi dari recent apps lalu buka kembali melalui browser dengan link terbaru. Jika masih belum berubah, hapus ikon SI-AP lama dari layar utama, buka https://siap-bandarlampung.web.app?v=pwa-update melalui Chrome, lalu tambahkan ulang ke layar utama.";

  return (
    <>
      {checking && (
        <div className="fixed bottom-4 right-4 z-[9999] bg-slate-900 border border-slate-800 text-slate-300 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 backdrop-blur-sm">
          <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
          <span className="text-xs font-semibold tracking-wide uppercase">Memeriksa Versi SI-AP...</span>
        </div>
      )}

      <AnimatePresence>
        {flowState !== "closed" && (
          <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/85 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 overflow-hidden z-[9991]"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500/20 via-emerald-500 to-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.3)]" />

              {/* State 1: MAIN NOTIFICATION */}
              {flowState === "main" && (
                <div className="flex flex-col text-center items-center">
                  <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 border border-emerald-500/20 mb-6 shadow-inner animate-pulse">
                    <RefreshCw className="w-7 h-7" />
                  </div>
                  
                  <h3 id="update-modal-title" className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-tight mb-3">
                    Terdapat versi terbaru SI-AP
                  </h3>
                  
                  <p className="text-sm text-slate-400 leading-relaxed font-normal mb-6 px-1">
                    Disarankan untuk memperbarui aplikasi agar mendapatkan fitur terbaru, perbaikan sistem, dan mengurangi potensi bug saat penggunaan.
                  </p>

                  {/* Cache Blocked or Reload Attempted Stale Warnings */}
                  {(updateCheckBlockedByCache || reloadAttempted) && (
                    <div className="w-full bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-left text-xs text-amber-400 leading-relaxed mb-6">
                      <p className="font-semibold mb-1 flex items-center gap-1.5 uppercase tracking-wide text-[10px]">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        Info Cache Terdeteksi
                      </p>
                      {manualGuidanceText}
                    </div>
                  )}

                  <div className="w-full flex items-center gap-3 mt-2">
                    <button
                      onClick={handlePostponeUpdate}
                      className="flex-1 py-3.5 bg-slate-950 hover:bg-slate-850 text-rose-500 border border-rose-500/10 rounded-2xl hover:border-rose-500/30 font-bold text-xs uppercase tracking-widest transition-all shadow-inner"
                    >
                      Nanti Saja
                    </button>
                    
                    <button
                      onClick={handlePerformUpdate}
                      className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-emerald-900/15 flex items-center justify-center gap-2 hover:scale-[1.02]"
                    >
                      Perbarui
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                  {!updateCheckBlockedByCache && serverVersion && (
                    <div className="mt-6 pt-5 border-t border-slate-800/60 w-full flex items-center justify-between text-[10px] font-mono text-slate-500">
                      <span>Versi Sekarang: {APP_VERSION}</span>
                      <span className="text-emerald-500">Menjadi: {serverVersion.appVersion}</span>
                    </div>
                  )}
                  {(updateCheckBlockedByCache || reloadAttempted) && (
                    <div className="mt-6 pt-5 border-t border-slate-800/60 w-full flex items-center justify-between text-[10px] font-mono text-slate-500">
                      <span>Versi Sekarang: {APP_VERSION}</span>
                      <span className="text-amber-500 font-bold">Butuh Reload Terpaksa</span>
                    </div>
                  )}
                </div>
              )}

              {/* State 2: CONFIRM POSTPONE SKIP */}
              {flowState === "confirm_skip" && (
                <div className="flex flex-col text-center items-center">
                  <div className="w-14 h-14 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-500 border border-rose-500/20 mb-6 font-medium">
                    <AlertTriangle className="w-7 h-7 animate-bounce" />
                  </div>
                  
                  <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-tight mb-3">
                    Perbarui nanti?
                  </h3>
                  
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-normal mb-8 px-1 text-center">
                    Anda belum akan menggunakan versi terbaru SI-AP. Beberapa fitur terbaru, perbaikan sistem, dan peningkatan stabilitas belum tersedia sampai aplikasi diperbarui. Apakah Anda yakin ingin memperbarui nanti?
                  </p>

                  <div className="w-full flex items-center gap-3 mt-2">
                    <button
                      onClick={handleCancelPostpone}
                      className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-emerald-990/20 hover:scale-[1.02]"
                    >
                      Tidak
                    </button>
                    
                    <button
                      onClick={handleConfirmPostpone}
                      className="flex-1 py-3.5 bg-slate-950 hover:bg-slate-850 text-rose-500 border border-rose-500/10 rounded-2xl hover:border-rose-500/30 font-bold text-xs uppercase tracking-widest transition-all"
                    >
                      Ya
                    </button>
                  </div>
                </div>
              )}

              {/* State 3: ACKNOWLEDGEMENT SKIP */}
              {flowState === "ack_skip" && (
                <div className="flex flex-col text-center items-center">
                  <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 border border-emerald-500/20 mb-6">
                    <Info className="w-7 h-7" />
                  </div>
                  
                  <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-tight mb-3">
                    Baik
                  </h3>
                  
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-normal mb-8 px-1">
                    Anda dapat melanjutkan penggunaan aplikasi. Disarankan untuk segera memperbarui SI-AP agar mendapatkan fitur terbaru dan mengurangi potensi kendala penggunaan.
                  </p>

                  <button
                    onClick={handleDismissAck}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-emerald-900/15"
                  >
                    Oke
                  </button>
                </div>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
});

UpdateNotification.displayName = "UpdateNotification";
