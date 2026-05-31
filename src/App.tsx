import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  deleteUser,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  User as FirebaseUser 
} from "firebase/auth";
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  serverTimestamp,
  writeBatch,
  orderBy,
  limit,
  where,
  deleteField,
  getAggregateFromServer,
  count,
  sum
} from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "./lib/firebase";
import firebaseConfig from "../firebase-applet-config.json";
import { UserProfile, TripRecord, UserRole, UPT_LIST, Vehicle, Driver, TPA, TPS, ActivityLog } from "./types";
import { INITIAL_TPS_DATA } from "./lib/seedData";
import { 
  BarChart3, 
  Plus, 
  LogOut, 
  ClipboardList, 
  Users, 
  FileSpreadsheet, 
  Trash2, 
  Edit2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Trash,
  User,
  Lock,
  Unlock,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Mail,
  Eye,
  EyeOff,
  Truck,
  UserRound,
  Building2,
  MapPin,
  Database,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Menu,
  X,
  Search,
  Check,
  CornerDownLeft,
  Download,
  ExternalLink,
  History,
  FileText,
  Layers,
  Weight,
  ShieldCheck,
  RotateCcw,
  Fuel,
  Filter
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { exportTripsToExcel, exportAllDataToExcel } from "./lib/excelExport";
import { APP_VERSION, APP_NAME, APP_FULL_NAME, APP_ORG, APP_ORG_SHORT } from "./constants";
import { UpdateNotification } from "./components/UpdateNotification";
import { BakungDashboardView } from "./features/bakung/BakungDashboardView";
import { UsersView } from "./features/users/UsersView";
import { InputRitaseView } from "./features/ritase/InputRitaseView";
import { TripForm } from "./features/ritase/TripForm";
import { TripsView } from "./features/ritase/TripsView";
import { ReportsView } from "./features/ritase/ReportsView";
import { MainDashboardView } from "./features/dashboard/MainDashboardView";
import { VehiclesView } from "./features/master-data/VehiclesView";
import { DriversView } from "./features/master-data/DriversView";
import { UptsView } from "./features/master-data/UptsView";
import { TpasTpsView } from "./features/master-data/TpasTpsView";
import { SettingsView } from "./features/settings/SettingsView";
import { VehicleEditModal } from "./features/master-data/components/VehicleEditModal";
import { DriverEditModal } from "./features/master-data/components/DriverEditModal";
import { AuthView } from "./features/auth/AuthView";
import { ActivationPendingView } from "./features/auth/ActivationPendingView";
import { UptAssignmentPendingView } from "./features/auth/UptAssignmentPendingView";
import { AppLayout } from "./components/layout/AppLayout";
import { Logo } from "./components/layout/Logo";
import { Button, Input, Select, Card, Badge, Modal } from "./features/master-data/components/SharedUI";

import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const logActivity = async (
  category: 'login' | 'operasional' | 'perubahan_data' | 'sistem',
  action: string,
  module: string,
  description: string,
  extra: {
    recordId?: string;
    recordLabel?: string;
    beforeData?: any;
    afterData?: any;
    metadata?: any;
    profile?: UserProfile | null;
  } = {}
) => {
  try {
    const currentProfile = extra.profile;
    if (!currentProfile) return;

    // Identities for log as per requirements
    const actorName = (currentProfile.operator_name || currentProfile.username || "-") + 
                    (currentProfile.account_name ? ` - ${currentProfile.account_name}` : 
                     (currentProfile.assigned_upt_name ? ` - ${currentProfile.assigned_upt_name}` : ""));

    const logData: any = {
      timestamp: serverTimestamp(),
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
    await addDoc(logsRef, logData);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, "activity_logs");
  }
};

// Components

// --- View Components ---


const ChangePasswordModal = ({ isOpen, onClose, user, profile, onNotify, isForced = false }: any) => {
  const [loading, setLoading] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      onNotify('error', 'Konfirmasi password tidak cocok');
      return;
    }
    if (newPassword.length < 6) {
      onNotify('error', 'Password minimal 6 karakter');
      return;
    }

    setLoading(true);
    try {
      if (!isForced) {
        // Must re-authenticate
        const credential = EmailAuthProvider.credential(user.email, oldPassword);
        await reauthenticateWithCredential(user, credential);
      }
      
      await updatePassword(user, newPassword);
      
      // Update Firestore flag if forced or exists
      if (isForced || profile?.force_password_change) {
        await updateDoc(doc(db, "users", user.uid), {
          force_password_change: false
        });
      }

      logActivity('perubahan_data', 'change_password_success', 'Profil', 'Pengguna mengganti password secara mandiri', { profile });
      onNotify('success', 'Password berhasil diperbarui');
      onClose();
    } catch (error: any) {
      console.error(error);
      let message = "Gagal memperbarui password";
      if (error.code === 'auth/wrong-password') message = "Password saat ini salah";
      else if (error.code === 'auth/requires-recent-login') message = "Silakan login kembali sebelum mengganti password";
      onNotify('error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={isForced ? () => {} : onClose} title={isForced ? "Wajib Ganti Password" : "Ganti Password"}>
      <form onSubmit={handleUpdate} className="flex flex-col gap-4">
        {isForced && (
          <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl flex items-start gap-3">
             <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
             <p className="text-xs text-orange-200 leading-relaxed font-medium">
               Admin telah mereset password Anda. Untuk keamanan data sistem, <strong>Anda wajib mengganti password</strong> sebelum dapat mengakses modul {APP_NAME}.
             </p>
          </div>
        )}
        {!isForced && (
          <Input 
            label="Password Saat Ini" 
            type="password" 
            value={oldPassword} 
            onChange={(e: any) => setOldPassword(e.target.value)} 
            required 
            placeholder="Masukkan password lama"
          />
        )}
        <Input 
          label="Password Baru" 
          type="password" 
          value={newPassword} 
          onChange={(e: any) => setNewPassword(e.target.value)} 
          required 
          placeholder="Minimal 6 karakter"
        />
        <Input 
          label="Konfirmasi Password Baru" 
          type="password" 
          value={confirmPassword} 
          onChange={(e: any) => setConfirmPassword(e.target.value)} 
          required 
          placeholder="Ulangi password baru"
        />
        <div className="flex gap-3 mt-4">
          {!isForced && (
            <Button variant="secondary" onClick={onClose} className="flex-1">Batal</Button>
          )}
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Perbarui Password"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

const ResetPasswordSuccessModal = ({ isOpen, onClose, tempPassword, username }: any) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Password Berhasil Direset">
      <div className="flex flex-col gap-6 text-center">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h4 className="text-white font-bold text-lg">Password Baru di-Generate</h4>
          <p className="text-slate-400 text-sm mt-1">Username: <span className="text-blue-400 font-mono">{username}</span></p>
        </div>

        <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Password Sementara</p>
          <div className="flex items-center justify-between gap-3 p-4 bg-slate-900 rounded-xl border border-slate-700">
             <span className="text-2xl font-mono font-bold text-emerald-500 tracking-widerSelection select-all">{tempPassword}</span>
             <button onClick={handleCopy} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
               {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <ClipboardList className="w-4 h-4 text-slate-400" />}
             </button>
          </div>
        </div>

        <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-xl">
           <p className="text-[10px] text-orange-500 leading-relaxed font-bold">
             ⚠️ PERINGATAN: Password ini hanya ditampilkan sekali. Harap segera sampaikan kepada {username}. Pengguna akan dipaksa mengganti password pada login pertama kali.
           </p>
        </div>

        <Button onClick={onClose} className="w-full py-4">Selesai & Tutup</Button>
      </div>
    </Modal>
  );
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [tripFilterRange, setTripFilterRange] = useState<{ start: string, end: string }>({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [upts, setUpts] = useState<any[]>([]);
  const [tpas, setTpas] = useState<TPA[]>([]);
  const [tps, setTps] = useState<TPS[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showAddTrip, setShowAddTrip] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [reportsCache, setReportsCache] = useState<any>(null);

  // Trigger Change Password if forced by Admin
  useEffect(() => {
    if (profile?.force_password_change) {
      setShowChangePassword(true);
    }
  }, [profile?.force_password_change]);

  // Set default tab for operator_bakung
  useEffect(() => {
    if (profile?.role === "operator_bakung") {
      setActiveTab("bakung");
    }
  }, [profile?.role]);
  const [resetSuccessData, setResetSuccessData] = useState<{ tempPassword: string, username: string } | null>(null);
  const [dbExpanded, setDbExpanded] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Global editing state for related records
  const [globalEditVehicle, setGlobalEditVehicle] = useState<Vehicle | null>(null);
  const [globalEditDriver, setGlobalEditDriver] = useState<Driver | null>(null);
  const [showGlobalVehicleModal, setShowGlobalVehicleModal] = useState(false);
  const [showGlobalDriverModal, setShowGlobalDriverModal] = useState(false);
  const [globalModalLoading, setGlobalModalLoading] = useState(false);

  const updateCheckerRef = useRef<any>(null);

  const prevUserRef = useRef<FirebaseUser | null>(null);
  const prevProfileRef = useRef<UserProfile | null>(null);

  // Auth Effect
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const isLoggingOut = prevUserRef.current && !firebaseUser;
      const isLoggingIn = !prevUserRef.current && firebaseUser;

      if (isLoggingOut && prevProfileRef.current) {
        // Logging is now handled in the signOut call to ensure auth context is available
      }

      setUser(firebaseUser);
      prevUserRef.current = firebaseUser;

      if (firebaseUser) {
        try {
          const docRef = doc(db, "users", firebaseUser.uid);
          const docSnap = await getDoc(docRef).catch(err => {
            handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`);
            throw err;
          });

          if (docSnap.exists()) {
            const data = docSnap.data();
            const newProfile = {
              ...data,
              userId: firebaseUser.uid,
              username: data.username || "",
              role: data.role as UserRole,
              assigned_upt_id: data.assigned_upt_id || data.uptId || "",
              assigned_upt_name: data.assigned_upt_name || data.uptName || "",
              account_name: data.account_name || data.upt || data.name || "",
              operator_name: data.operator_name || data.name || "",
              status: data.status || 'active',
              email: data.email || firebaseUser.email || ""
            } as UserProfile;
            
            if (isLoggingIn || !prevProfileRef.current) {
              logActivity('login', 'login_success', 'Autentikasi', 'Pengguna berhasil masuk ke sistem', { profile: newProfile });
            }
            
            setProfile(newProfile);
            prevProfileRef.current = newProfile;
          } else {
            // Profile document doesn't exist. This usually happens during manual registration.
            // We only auto-create it if the user is the master bootstrap admin to prevent lockout
            // while avoiding race conditions for regular manual registration.
            const username = firebaseUser.email?.split('@')[0] || "user";
            const isMasterAdmin = firebaseUser.email === "bpsdlh@gmail.com" || username === "bpsdlh";
            
            if (isMasterAdmin) {
              const initialProfile: UserProfile = {
                userId: firebaseUser.uid,
                username: username,
                email: firebaseUser.email || "",
                role: "admin",
                account_name: firebaseUser.displayName || username,
                operator_name: "",
                status: 'active',
                assigned_upt_id: "",
                assigned_upt_name: "",
                createdAt: serverTimestamp()
              };
              await setDoc(docRef, initialProfile).catch(err => {
                handleFirestoreError(err, OperationType.WRITE, `users/${firebaseUser.uid}`);
                throw err;
              });
              
              if (isLoggingIn || !prevProfileRef.current) {
                logActivity('login', 'login_success', 'Autentikasi', 'Pengguna berhasil masuk (Registrasi Baru)', { profile: initialProfile });
              }
              
              setProfile(initialProfile);
              prevProfileRef.current = initialProfile;
            } else {
              console.log("No profile doc yet for new user:", firebaseUser.uid, "- waiting for handleSubmit to create it.");
            }
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
        }
      } else {
        setProfile(null);
        prevProfileRef.current = null;
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Auto-Resolution for Profile UPT fields
  useEffect(() => {
    if (profile && profile.userId && upts.length > 0) {
      // If new fields are missing but legacy field exists, try to resolve it
      if ((!profile.uptId || !profile.uptName) && (profile as any).upt) {
        const legacyUpt = (profile as any).upt;
        const matchingUpt = upts.find((u: any) => u.name === legacyUpt);
        if (matchingUpt) {
          setProfile(prev => prev ? {
            ...prev,
            uptId: matchingUpt.id,
            uptName: matchingUpt.name
          } : null);
        }
      }
    }
  }, [profile?.userId, upts.length]);

  // Data Subscription Effect
  useEffect(() => {
    if (!user) return;

    // Filter trips by date range to save quota
    const tripsQuery = query(
      collection(db, "trips"), 
      where("date", ">=", tripFilterRange.start),
      where("date", "<=", tripFilterRange.end),
      orderBy("date", "desc"), 
      limit(2000)
    );

    const unsubTrips = onSnapshot(tripsQuery, (snapshot) => {
      setTrips(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TripRecord)));
    }, (err) => {
      if (err.message.includes("quota") || err.message.includes("limit")) {
        setNotification({ type: 'error', message: "Batas kuota database tercapai. Data ritase mungkin tidak lengkap." });
        return;
      }
      handleFirestoreError(err, OperationType.LIST, "trips");
    });

    const unsubVehicles = onSnapshot(query(collection(db, "vehicles"), orderBy("plateNumber", "asc")), (snapshot) => {
      setVehicles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vehicle)));
    }, (err) => {
      if (err.message.includes("quota") || err.message.includes("limit")) return;
      handleFirestoreError(err, OperationType.LIST, "vehicles");
    });

    const unsubDrivers = onSnapshot(query(collection(db, "drivers"), orderBy("name", "asc")), (snapshot) => {
      setDrivers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Driver)));
    }, (err) => {
      if (err.message.includes("quota") || err.message.includes("limit")) return;
      handleFirestoreError(err, OperationType.LIST, "drivers");
    });

    const unsubUpts = onSnapshot(query(collection(db, "upts"), orderBy("name", "asc")), (snapshot) => {
      setUpts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      if (err.message.includes("quota") || err.message.includes("limit")) return;
      handleFirestoreError(err, OperationType.LIST, "upts");
    });

    const unsubTpas = onSnapshot(query(collection(db, "tpas"), orderBy("name", "asc")), (snapshot) => {
      setTpas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TPA)));
    }, (err) => {
      if (err.message.includes("quota") || err.message.includes("limit")) return;
      handleFirestoreError(err, OperationType.LIST, "tpas");
    });

    const unsubTps = onSnapshot(query(collection(db, "tps"), orderBy("name", "asc")), (snapshot) => {
      setTps(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TPS)));
    }, (err) => {
      if (err.message.includes("quota") || err.message.includes("limit")) return;
      handleFirestoreError(err, OperationType.LIST, "tps");
    });

    const unsubSettings = onSnapshot(doc(db, "settings", "global"), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data());
      }
    }, (err) => {
      if (err.message.includes("quota") || err.message.includes("limit")) return;
      handleFirestoreError(err, OperationType.GET, "settings/global");
    });

    let unsubUsers = () => {};
    if (profile?.role === 'admin' || profile?.role === 'co-admin') {
      // Use a basic query for initial fetch to ensure we see all users, 
      // even those needing migration (missing account_name will be skipped by orderBy)
      const usersQuery = query(collection(db, "users"));
      unsubUsers = onSnapshot(usersQuery, (snapshot) => {
        const allUsers = snapshot.docs.map(doc => ({ userId: doc.id, ...doc.data() } as UserProfile));
        // Client-side sort as fallback if some fields are missing
        const sortedUsers = allUsers.sort((a, b) => (a.account_name || "").localeCompare(b.account_name || ""));
        setUsers(sortedUsers);
      }, (err) => {
        if (err.message.includes("quota") || err.message.includes("limit")) return;
        handleFirestoreError(err, OperationType.LIST, "users");
      });
    }

    return () => { 
      unsubTrips(); 
      unsubUsers(); 
      unsubVehicles();
      unsubDrivers();
      unsubUpts();
      unsubTpas();
      unsubTps();
      unsubSettings();
    };
  }, [user, profile, tripFilterRange]);

  // UPT ID Migration Effect
  useEffect(() => {
    if (profile?.role === 'admin' && upts.length > 0) {
      const needsMigration = upts.filter(u => !u.upt_id);
      if (needsMigration.length > 0) {
        console.log(`Migrating ${needsMigration.length} UPT records...`);
        const performMigration = async () => {
          const batch = writeBatch(db);
          let currentMax = upts
            .map(u => u.upt_id)
            .filter(id => id && id.startsWith('UPT'))
            .map(id => parseInt(id.replace('UPT', ''), 10))
            .filter(n => !isNaN(n))
            .reduce((max, val) => Math.max(max, val), 0);

          needsMigration.forEach((upt) => {
            currentMax++;
            const newUptId = `UPT${currentMax.toString().padStart(3, '0')}`;
            const uptRef = doc(db, "upts", upt.id);
            batch.update(uptRef, { 
              upt_id: newUptId,
              nama_upt: upt.nama_upt || upt.name || "",
              kode_pendek: upt.kode_pendek || "",
              penanggung_jawab: upt.penanggung_jawab || "",
              status_pimpinan: upt.status_pimpinan || "Definitif"
            });
          });
          await batch.commit().catch(err => console.error("Migration failed:", err));
        };
        performMigration();
      }
    }
  }, [profile?.role, upts.length]);

  // User Schema Migration Effect
  useEffect(() => {
    if (profile?.role === 'admin' && users.length > 0) {
      const needsMigration = users.filter((u: any) => !u.account_name || !u.status);
      if (needsMigration.length > 0) {
        console.log(`Migrating ${needsMigration.length} user records...`);
        const performMigration = async () => {
          const batch = writeBatch(db);
          needsMigration.forEach((u: any) => {
            const userRef = doc(db, "users", u.userId);
            batch.update(userRef, {
              username: u.username || u.email.split('@')[0],
              account_name: u.account_name || u.upt || u.name || "Default Account",
              operator_name: u.operator_name || u.name || "",
              status: u.status || 'active',
              assigned_upt_id: u.assigned_upt_id || u.uptId || "",
              assigned_upt_name: u.assigned_upt_name || u.uptName || "",
              updatedAt: serverTimestamp()
            });
          });
          await batch.commit().catch(err => console.error("User migration failed:", err));
        };
        performMigration();
      }
    }
  }, [profile?.role, users.length]);

  // Handle mobile keyboard and scrolling
  useEffect(() => {
    const handleVisualViewportChange = () => {
      const vv = window.visualViewport;
      if (!vv) return;

      // Detect if keyboard is likely open (height decreased significantly)
      if (vv.height < window.innerHeight * 0.85) {
        // Add padding to ensure scrollability
        document.body.style.paddingBottom = `${window.innerHeight - vv.height}px`;
        
        const activeEl = document.activeElement as HTMLElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) {
          setTimeout(() => {
            activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        }
      } else {
        document.body.style.paddingBottom = '0px';
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportChange);
      return () => {
        window.visualViewport?.removeEventListener('resize', handleVisualViewportChange);
        document.body.style.paddingBottom = '0px';
      };
    }
  }, []);

  const notify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-950 gap-6">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <Logo size="xl" className="shadow-2xl shadow-emerald-500/10" />
        </motion.div>
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] animate-pulse">Memuat Sistem {APP_NAME}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthView onNotify={notify} onRegisterSuccess={(p) => {
      setProfile(p);
      prevProfileRef.current = p;
    }} logActivity={logActivity} />;
  }

  if (profile && (profile.role === "viewer" || profile.status === "pending")) {
    return <ActivationPendingView profile={profile} onNotify={notify} logActivity={logActivity} />;
  }

  if (profile && profile.role === "user" && !profile.assigned_upt_id) {
    return <UptAssignmentPendingView profile={profile} onNotify={notify} logActivity={logActivity} />;
  }

  const navigateTo = (tab: string) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <AppLayout
        user={user}
        profile={profile}
      vehicles={vehicles}
      drivers={drivers}
      settings={settings}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      isMobileMenuOpen={isMobileMenuOpen}
      setIsMobileMenuOpen={setIsMobileMenuOpen}
      isProfileOpen={isProfileOpen}
      setIsProfileOpen={setIsProfileOpen}
      dbExpanded={dbExpanded}
      setDbExpanded={setDbExpanded}
      onShowChangePassword={() => setShowChangePassword(true)}
      onCheckUpdates={() => updateCheckerRef.current?.checkUpdates(true)}
      onSignOut={async () => {
        if (profile) {
          await logActivity('login', 'logout', 'Autentikasi', 'Pengguna keluar dari sistem', { profile });
        }
        signOut(auth);
      }}
    >
      <AnimatePresence mode="wait">
          {activeTab === "dashboard" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <MainDashboardView 
                trips={trips} 
                profile={profile} 
                upts={upts} 
                tpas={tpas} 
                settings={settings} 
                onAddClick={() => setActiveTab("trips")} 
                tripFilterRange={tripFilterRange}
                setTripFilterRange={setTripFilterRange}
              />
            </motion.div>
          )}
          {activeTab === "bakung" && (profile?.role === 'admin' || profile?.role === 'co-admin' || profile?.role === 'operator_bakung') && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <BakungDashboardView profile={profile} onNotify={notify} upts={upts} vehicles={vehicles} logActivity={logActivity} />
            </motion.div>
          )}
          {activeTab === "input-ritase" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <InputRitaseView 
                onNotify={notify}
                upts={upts}
                tpas={tpas}
                settings={settings}
                profile={profile}
                drivers={drivers}
                vehicles={vehicles}
                setActiveTab={setActiveTab}
                trips={trips}
                logActivity={logActivity}
              />
            </motion.div>
          )}
          {activeTab === "trips" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <TripsView 
                trips={trips} 
                profile={profile} 
                onNotify={notify}
                upts={upts}
                tpas={tpas}
                settings={settings}
                drivers={drivers}
                vehicles={vehicles}
                setActiveTab={setActiveTab}
                users={users}
                tripFilterRange={tripFilterRange}
                setTripFilterRange={setTripFilterRange}
                logActivity={logActivity}
              />
            </motion.div>
          )}
          {activeTab === "vehicles" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <VehiclesView 
                vehicles={vehicles} 
                onNotify={notify} 
                upts={upts} 
                profile={profile} 
                drivers={drivers} 
                trips={trips} 
                settings={settings} 
                logActivity={logActivity}
              />
            </motion.div>
          )}
          {activeTab === "drivers" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <DriversView 
                drivers={drivers} 
                onNotify={notify} 
                upts={upts} 
                profile={profile} 
                vehicles={vehicles} 
                settings={settings} 
                logActivity={logActivity}
              />
            </motion.div>
          )}
          {activeTab === "upt-master" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <UptsView 
                upts={upts} 
                vehicles={vehicles} 
                drivers={drivers} 
                onNotify={notify} 
                profile={profile} 
                onEditVehicle={(v: any) => {
                  setGlobalEditVehicle(v);
                  setShowGlobalVehicleModal(true);
                }}
                onEditDriver={(d: any) => {
                  setGlobalEditDriver(d);
                  setShowGlobalDriverModal(true);
                }}
                logActivity={logActivity}
              />
            </motion.div>
          )}
          {activeTab === "tpa" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <TpasTpsView 
                tpas={tpas} 
                tps={tps} 
                onNotify={notify} 
                settings={settings} 
                profile={profile} 
                logActivity={logActivity}
              />
            </motion.div>
          )}
          {activeTab === "users" && (profile?.role === 'admin' || profile?.role === 'co-admin') && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <UsersView users={users} profile={profile} onNotify={notify} upts={upts} onResetPasswordSuccess={(data: any) => setResetSuccessData(data)} logActivity={logActivity} />
            </motion.div>
          )}
          {activeTab === "export-center" && (profile?.role === 'admin') && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <ExportCenterView 
                trips={trips}
                drivers={drivers}
                vehicles={vehicles}
                upts={upts}
                tpas={tpas}
                tps={tps}
                users={users}
                profile={profile}
                onNotify={notify}
              />
            </motion.div>
          )}
          {activeTab === "reports" && (profile?.role === 'admin' || (profile?.role === 'co-admin' && settings?.showReportsForCoAdmin === true)) && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <ReportsView 
                trips={trips} 
                onNotify={notify} 
                settings={settings} 
                upts={upts} 
                users={users} 
                profile={profile} 
                tripFilterRange={tripFilterRange}
                setTripFilterRange={setTripFilterRange}
                reportsCache={reportsCache}
                setReportsCache={setReportsCache}
                logActivity={logActivity}
              />
            </motion.div>
          )}
          {activeTab === "activity-log" && (profile?.role === 'admin') && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <ActivityLogView profile={profile} />
            </motion.div>
          )}
          {activeTab === "settings" && (profile?.role === 'admin') && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <SettingsView onNotify={notify} settings={settings} tpas={tpas} profile={profile} logActivity={logActivity} />
            </motion.div>
          )}
        </AnimatePresence>
    </AppLayout>

      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border ${
              notification.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'
            }`}>
              {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <p className="text-sm font-medium">{notification.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Modals for Cross-Module Editing */}
      <VehicleEditModal 
        isOpen={showGlobalVehicleModal} 
        onClose={() => { setShowGlobalVehicleModal(false); setGlobalEditVehicle(null); }}
        isEditing={globalEditVehicle}
        upts={upts}
        drivers={drivers}
        onNotify={notify}
        profile={profile}
        onSuccess={() => { setShowGlobalVehicleModal(false); setGlobalEditVehicle(null); }}
      />

      <DriverEditModal
        isOpen={showGlobalDriverModal}
        onClose={() => { setShowGlobalDriverModal(false); setGlobalEditDriver(null); }}
        isEditing={globalEditDriver}
        upts={upts}
        vehicles={vehicles}
        onNotify={notify}
        profile={profile}
        onSuccess={() => { setShowGlobalDriverModal(false); setGlobalEditDriver(null); }}
      />

      <ChangePasswordModal 
        isOpen={showChangePassword} 
        onClose={() => setShowChangePassword(false)}
        user={user}
        profile={profile}
        onNotify={notify}
        isForced={profile?.force_password_change}
      />

      <UpdateNotification ref={updateCheckerRef} onNotify={notify} />
    </>
  );
}

// --- Global Modals ---

function VehicleEditModal_Deprecated({ isOpen, onClose, isEditing, upts, drivers, onNotify, profile, onSuccess }: any) {
  const [loading, setLoading] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [modalUpts, setModalUpts] = useState<string[]>([]);
  const [ritaseTonnage, setRitaseTonnage] = useState<{ [upt: string]: { [rit: number]: number } }>({});
  const [activeRitaseUpt, setActiveRitaseUpt] = useState<string>("");
  const [duplicateData, setDuplicateData] = useState<any | null>(null);
  const [status, setStatus] = useState<'Aktif' | 'Tidak Aktif'>('Aktif');
  const [statusDescription, setStatusDescription] = useState("");
  const [doBbm, setDoBbm] = useState<number | string>("");
  const [tahunPengadaan, setTahunPengadaan] = useState<number | string>("");
  const [nomorRangka, setNomorRangka] = useState("");
  const [nomorMesin, setNomorMesin] = useState("");

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
        <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-colors">
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
            <Button type="submit" disabled={loading} className="flex-1">{loading ? <Loader2 className="animate-spin" /> : "Simpan"}</Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function DriverEditModal_Deprecated({ isOpen, onClose, isEditing, upts, vehicles, onNotify, profile, onSuccess }: any) {
  const [loading, setLoading] = useState(false);
  const [modalUpts, setModalUpts] = useState<string[]>([]);
  const [jabatan, setJabatan] = useState("");
  const [statusAsn, setStatusAsn] = useState("");
  const [nip, setNip] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (isEditing && isOpen) {
      setModalUpts(isEditing.upts || (isEditing.upt ? [isEditing.upt] : []));
      setJabatan(isEditing.jabatan || "");
      setStatusAsn(isEditing.status_asn || "");
      setNip(isEditing.nip || "");
      setPhone(isEditing.phone || "");
    } else if (!isEditing && isOpen) {
      setModalUpts([]);
      setJabatan("");
      setStatusAsn("");
      setNip("");
      setPhone("");
    }
  }, [isEditing, isOpen]);

  const saveData = async (data: any) => {
    setLoading(true);
    const path = isEditing ? `drivers/${isEditing.id}` : "drivers";
    try {
      const batch = writeBatch(db);
      let driverRef;
      const uploadData: any = { ...data };
      if (isEditing) {
        uploadData.upt = deleteField();
        driverRef = doc(db, "drivers", isEditing.id);
        batch.update(driverRef, uploadData);
      } else {
        driverRef = doc(collection(db, "drivers"));
        batch.set(driverRef, uploadData);
      }

      if (data.vehiclePlate) {
        const oldVehicles = vehicles.filter((v: any) => v.defaultDriverName === data.name && v.plateNumber !== data.vehiclePlate);
        oldVehicles.forEach((v: any) => batch.update(doc(db, "vehicles", v.id), { defaultDriverName: "", upt: deleteField() }));
        const newVehicle = vehicles.find((v: any) => v.plateNumber === data.vehiclePlate);
        if (newVehicle) batch.update(doc(db, "vehicles", newVehicle.id), { defaultDriverName: data.name, upts: data.upts, upt: deleteField() });
      } else if (isEditing?.vehiclePlate) {
        const oldVehicle = vehicles.find((v: any) => v.plateNumber === isEditing.vehiclePlate && v.defaultDriverName === data.name);
        if (oldVehicle) batch.update(doc(db, "vehicles", oldVehicle.id), { defaultDriverName: "", upt: deleteField() });
      }

      await batch.commit();
      logActivity('perubahan_data', isEditing ? 'edit_personil' : 'tambah_personil', 'Master Personil', `${isEditing ? 'Pembaruan' : 'Registrasi'} personil: ${data.name}`, 
        { recordId: isEditing?.id || "", recordLabel: data.name, beforeData: isEditing, afterData: data, profile });

      onNotify('success', isEditing ? 'Data personil diperbarui' : 'Personil baru ditambahkan');
      onSuccess();
    } catch (error) {
      handleFirestoreError(error, isEditing ? OperationType.UPDATE : OperationType.CREATE, path);
      onNotify('error', 'Gagal menyimpan data personil');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    
    // Validation
    const needsNip = ["ASN", "PPPK", "PPPK Paruh Waktu"].includes(statusAsn);
    if (needsNip && !nip.trim()) {
      onNotify('error', `NIP wajib diisi untuk status ${statusAsn}`);
      return;
    }

    await saveData({ 
      name, 
      shift: formData.get("shift") as string || "", 
      upts: modalUpts, 
      vehiclePlate: formData.get("vehiclePlate") as string || "",
      jabatan,
      status_asn: statusAsn,
      nip: needsNip ? nip.trim() : (nip.trim() || null),
      phone: phone.trim()
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-slate-900 rounded-2xl w-full max-w-md p-8 border border-slate-800 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        <h3 className="text-xl font-bold text-white mb-6 uppercase tracking-tight">{isEditing ? "Edit Personil" : "Tambah Personil"}</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 p-4 bg-slate-950 border border-slate-800 rounded-xl">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Identitas Personil</h4>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Nama Lengkap" name="name" required defaultValue={isEditing?.name} placeholder="Ahmad..." />
              <Input label="Nomor HP" value={phone} onChange={(e: any) => setPhone(e.target.value)} placeholder="0812..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select label="Jabatan" value={jabatan} onChange={(e: any) => setJabatan(e.target.value)} options={[
                { label: "Pilih Jabatan", value: "" },
                { label: "Supir", value: "Supir" },
                { label: "Kenek", value: "Kenek" },
                { label: "Petugas", value: "Petugas" },
                { label: "Koordinator", value: "Koordinator" },
                { label: "Lainnya", value: "Lainnya" }
              ]} />
              <Select label="Shift Kerja" name="shift" defaultValue={isEditing?.shift || ""} options={[
                { label: "Tanpa Shift", value: "" }, { label: "Shift 1 (Pagi)", value: "Shift 1" }, { label: "Shift 2 (Siang)", value: "Shift 2" }, { label: "Shift 3 (Malam)", value: "Shift 3" },
              ]} />
            </div>
          </div>

          <div className="flex flex-col gap-4 p-4 bg-slate-950 border border-slate-800 rounded-xl">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Data Kepegawaian</h4>
            <div className="grid grid-cols-2 gap-4">
              <Select label="Status Kepegawaian" value={statusAsn} onChange={(e: any) => setStatusAsn(e.target.value)} options={[
                { label: "Pilih Status", value: "" },
                { label: "ASN", value: "ASN" },
                { label: "PPPK", value: "PPPK" },
                { label: "PPPK Paruh Waktu", value: "PPPK Paruh Waktu" },
                { label: "Alih Daya", value: "Alih Daya" },
              ]} />
              {["ASN", "PPPK", "PPPK Paruh Waktu"].includes(statusAsn) ? (
                <Input label="NIP / NI PPPK" value={nip} onChange={(e: any) => setNip(e.target.value)} required placeholder="19XXXXXXXXXX..." />
              ) : (
                <Input label="NIP (Opsional)" value={nip} onChange={(e: any) => setNip(e.target.value)} placeholder="-" />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Koneksi Wilayah UPT</label>
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
          <Select label="Kendaraan Utama" name="vehiclePlate" defaultValue={isEditing?.vehiclePlate} placeholder="Pilih..." options={[
            { label: "Tanpa Kendaraan", value: "" },
            ...vehicles.filter((v: any) => modalUpts.length === 0 ? (!v.upts || v.upts.length === 0) : v.upts?.some((u: string) => modalUpts.includes(u)) || modalUpts.includes(v.upt))
              .map((v: any) => ({ label: v.defaultDriverName && v.defaultDriverName !== (isEditing?.name || "") ? `${v.plateNumber} (${v.defaultDriverName})` : v.plateNumber, value: v.plateNumber }))
          ]} />
          <div className="flex gap-4 mt-6">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Batal</Button>
            <Button type="submit" disabled={loading} className="flex-1">{loading ? <Loader2 className="animate-spin" /> : "Simpan"}</Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
// --- View Components ---

function ExportCenterView({ profile, onNotify }: any) {
  const [isExporting, setIsExporting] = useState(false);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const fetchFullCollection = async (colName: string, filters: any[] = []) => {
    try {
      const { getDocs, collection, query, orderBy, where } = await import("firebase/firestore");
      const { db } = await import("./lib/firebase");
      
      let constraints: any[] = filters;
      
      if (colName === 'trips') {
        constraints.push(orderBy('date', 'desc'));
      } else if (colName === 'users') {
        constraints.push(orderBy('name', 'asc'));
      }
      
      const q = query(collection(db, colName), ...constraints);
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error(`Error fetching ${colName}:`, error);
      return [];
    }
  };

  const handleExportCustomRange = async () => {
    if (!startDate || !endDate) {
      onNotify('error', 'Pilih rentang tanggal terlebih dahulu');
      return;
    }
    
    setIsExporting(true);
    try {
      const { where } = await import("firebase/firestore");
      const tripFilters = [
        where("date", ">=", startDate),
        where("date", "<=", endDate)
      ];

      const [trips, users] = await Promise.all([
        fetchFullCollection('trips', tripFilters),
        fetchFullCollection('users')
      ]);

      if (trips.length === 0) {
        onNotify('error', 'Tidak ada data ritase pada rentang tanggal tersebut');
        setIsExporting(false);
        return;
      }

      await exportTripsToExcel(trips, `Data_Ritase_${startDate}_to_${endDate}`, users);
      onNotify('success', `Data ritase (${trips.length} baris) berhasil diekspor.`);
    } catch (error) {
      console.error(error);
      onNotify('error', 'Gagal mengekspor data');
    } finally {
      setIsExporting(false);
    }
  };

  const exportTypes = [
    { 
      name: 'Pusat Master Data', 
      description: 'Ekspor seluruh Master (Kendaraan, SOP, UPT, Lokasi, Pengguna). Tidak termasuk data ritase.',
      icon: <Database className="w-5 h-5" />, 
      action: async () => {
        setIsExporting(true);
        try {
          const [drivers, vehicles, upts, tpas, tps, users] = await Promise.all([
            fetchFullCollection('drivers'),
            fetchFullCollection('vehicles'),
            fetchFullCollection('upts'),
            fetchFullCollection('tpas'),
            fetchFullCollection('tps'),
            fetchFullCollection('users')
          ]);

          await exportAllDataToExcel({
            trips: [],
            drivers,
            vehicles,
            upts,
            tpas,
            tps,
            users
          });
          onNotify('success', 'Master data berhasil diekspor.');
        } catch (err) {
          onNotify('error', 'Gagal mengekspor master data');
        } finally {
          setIsExporting(false);
        }
      }
    }
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Pusat Ekspor Data</h2>
        <p className="text-slate-500 text-sm mt-1">Gunakan halaman ini untuk melakukan backup atau audit data sistem. Ekspor data ritase kini wajib menggunakan rentang tanggal.</p>
      </div>

      <Card className="p-8 bg-slate-900 border-slate-800">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
              <ClipboardList className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Ekspor Data Ritase</h3>
              <p className="text-xs text-slate-500 font-medium">Download riwayat operasional sesuai periode yang dipilih.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950 p-6 rounded-2xl border border-slate-800/50">
            <Input 
              label="Tanggal Mulai"
              type="date"
              value={startDate}
              onChange={(e: any) => setStartDate(e.target.value)}
            />
            <Input 
              label="Tanggal Selesai"
              type="date"
              value={endDate}
              onChange={(e: any) => setEndDate(e.target.value)}
            />
          </div>

          <Button 
            variant="primary" 
            onClick={handleExportCustomRange} 
            disabled={isExporting}
            className="h-14 px-8 gap-3 text-sm font-bold tracking-widest shadow-xl shadow-emerald-500/10"
          >
            {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            UNDUH DATA RITASE (PERIODE)
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {exportTypes.map((type, idx) => (
          <Card key={idx} className="p-6 hover:border-emerald-500/30 transition-all group">
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 group-hover:text-emerald-500 group-hover:border-emerald-500/30 transition-all`}>
                {type.icon}
              </div>
              <div className="w-2 h-2 rounded-full bg-slate-800 group-hover:bg-emerald-500 transition-colors" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">{type.name}</h3>
            <p className="text-xs text-slate-500 mb-6 font-medium">{type.description}</p>
            <button 
              onClick={type.action}
              disabled={isExporting}
              className="w-full py-3 px-4 bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
            >
              Unduh Excel (.xlsx)
              <Download className="w-3.5 h-3.5" />
            </button>
          </Card>
        ))}
      </div>

      <Card className="p-6 bg-emerald-500/5 border-emerald-500/20 overflow-hidden relative">
        <div className="flex items-start gap-4 z-10 relative">
          <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-500 shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-emerald-400 leading-tight">Keamanan & Integritas Data</h4>
            <p className="text-emerald-500/70 text-sm mt-1 max-w-2xl">
              Proses ekspor ini mengambil data langsung dari server (Real-time). Seluruh data yang diekspor menyertakan tanda waktu pembuatan dan pembaruan terakhir sesuai standar audit sistem informasi.
            </p>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -mr-16 -mt-16" />
      </Card>
    </div>
  );
}

function ActivityLogView({ profile }: any) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("semua");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "activity_logs"), orderBy("timestamp", "desc"), limit(200));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog)));
      setLoading(false);
    }, (err) => {
      if (err.message.includes("quota") || err.message.includes("limit")) {
        setLoading(false);
        return;
      }
      handleFirestoreError(err, OperationType.LIST, "activity_logs");
    });
    return unsubscribe;
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesCategory = activeCategory === "semua" || log.category === activeCategory;
      
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        (log.performedBy?.username || "").toLowerCase().includes(searchLower) ||
        (log.performedBy?.operatorName || "").toLowerCase().includes(searchLower) ||
        (log.performedBy?.accountName || "").toLowerCase().includes(searchLower) ||
        (log.module || "").toLowerCase().includes(searchLower) ||
        (log.action || "").toLowerCase().includes(searchLower) ||
        (log.recordLabel || "").toLowerCase().includes(searchLower) ||
        (log.description || "").toLowerCase().includes(searchLower);

      let matchesDate = true;
      if (dateFilter) {
        let logDate = "";
        if (log.timestamp?.seconds) {
           logDate = format(new Date(log.timestamp.seconds * 1000), 'yyyy-MM-dd');
        } else if (log.timestamp instanceof Date) {
           logDate = format(log.timestamp, 'yyyy-MM-dd');
        }
        matchesDate = !logDate || logDate === dateFilter;
      }

      return matchesCategory && matchesSearch && matchesDate;
    });
  }, [logs, activeCategory, searchQuery, dateFilter]);

  if (loading) {
    return (
      <div className="h-64 h-full flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        <div className="flex flex-col items-center">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] animate-pulse">Memuat Log Aktivitas</p>
             <p className="text-[8px] text-slate-700 font-mono mt-1">SISTEM AUDIT {APP_NAME}</p>
        </div>
      </div>
    );
  }

  const categories = [
    { id: "semua", label: "Semua" },
    { id: "login", label: "Login" },
    { id: "operasional", label: "Operasional" },
    { id: "perubahan_data", label: "Perubahan Data" },
    { id: "sistem", label: "Sistem" }
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Log Aktivitas</h2>
          <p className="text-slate-500 text-sm mt-1">Audit trail seluruh aktivitas operasional dan sistem untuk transparansi data.</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${
                  activeCategory === cat.id 
                    ? "bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-900/20" 
                    : "bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300 hover:bg-slate-850"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
              <input 
                type="text" 
                placeholder="Cari aktor, modul, aksi..."
                className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 outline-none transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <input 
              type="date" 
              className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/20"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>
        </div>
      </div>

      <Card className="overflow-hidden border-slate-800 shadow-2xl">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">Waktu</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">Aktor Identity</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">Modul & Aksi</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Keterangan Aktivitas</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredLogs.length > 0 ? filteredLogs.map((log) => (
                <React.Fragment key={log.id}>
                  <tr className={`hover:bg-slate-800/40 transition-colors group ${expandedLog === log.id ? 'bg-slate-800/20' : ''}`}>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-200">
                          {log.timestamp?.seconds ? format(new Date(log.timestamp.seconds * 1000), 'HH:mm:ss') : '-'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono tracking-tighter">
                          {log.timestamp?.seconds ? format(new Date(log.timestamp.seconds * 1000), 'dd MMM yyyy') : '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-sm font-bold text-white whitespace-nowrap group-hover:text-emerald-400 transition-colors">
                          {log.performedBy?.operatorName || log.performedBy?.username || '-'}{log.performedBy?.accountName ? ` - ${log.performedBy.accountName}` : ''}
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge variant={log.performedBy?.role as any || 'user'}>{log.performedBy?.role || 'user'}</Badge>
                          <div className="flex items-center gap-1 text-[9px] text-slate-500 font-bold uppercase tracking-tighter bg-slate-950/50 px-1.5 py-0.5 rounded border border-slate-800/50">
                            <Building2 className="w-2.5 h-2.5 opacity-50" />
                            <span className="truncate max-w-[120px]">{log.performedBy?.uptName || '-'}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${
                            log.category === 'login' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                            log.category === 'operasional' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                            log.category === 'perubahan_data' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                            'bg-purple-500/10 text-purple-500 border-purple-500/20'
                          }`}>
                            {log.module || '-'}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight ml-0.5 opacity-80">{log.action?.replace(/_/g, ' ') || '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-2">
                        <p className="text-xs text-slate-300 leading-relaxed max-w-sm font-medium">
                          {log.description}
                        </p>
                        {log.recordLabel && (
                          <div className="flex items-center gap-2 group/record">
                            <div className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 flex items-center gap-1.5">
                              <span className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em]">RECORD</span>
                              <span className="text-[10px] font-bold text-emerald-500 font-mono tracking-tighter group-hover/record:text-emerald-400 transition-colors uppercase">{log.recordLabel}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      {(log.beforeData || log.afterData || log.metadata) ? (
                        <button 
                          onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id!)}
                          className={`p-2 rounded-xl transition-all shadow-lg border ${
                            expandedLog === log.id 
                              ? 'bg-emerald-600 text-white border-emerald-500' 
                              : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750 hover:text-slate-200'
                          }`}
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${expandedLog === log.id ? 'rotate-180' : ''}`} />
                        </button>
                      ) : (
                        <div className="w-8 h-8 rounded-xl border border-slate-800/50 flex items-center justify-center mx-auto opacity-20">
                          <EyeOff className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </td>
                  </tr>
                  <AnimatePresence>
                    {expandedLog === log.id && (
                      <tr>
                        <td colSpan={5} className="p-0 border-none">
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden bg-slate-950/40"
                          >
                            <div className="px-6 py-8 border-x-4 border-emerald-500/20 bg-gradient-to-b from-slate-950/60 to-transparent">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
                                {log.beforeData && (
                                  <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                      <h4 className="text-[10px] font-bold text-rose-500 uppercase tracking-[0.3em] flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                        State Sebelumnya
                                      </h4>
                                      <span className="text-[8px] font-mono text-slate-600 uppercase tracking-widest">READ ONLY DATA</span>
                                    </div>
                                    <div className="relative group">
                                      <div className="absolute -inset-1 bg-gradient-to-r from-rose-500/5 to-transparent rounded-2xl blur opacity-25 group-hover:opacity-40 transition-opacity" />
                                      <pre className="relative p-5 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-mono text-slate-400 overflow-auto whitespace-pre-wrap max-h-80 shadow-2xl scrollbar-thin scrollbar-thumb-slate-800">
                                        {JSON.stringify(log.beforeData, (key, value) => {
                                          if (key === 'timestamp' && value?.seconds) return format(new Date(value.seconds * 1000), 'yyyy-MM-dd HH:mm:ss');
                                          return value;
                                        }, 2)}
                                      </pre>
                                    </div>
                                  </div>
                                )}
                                {log.afterData && (
                                  <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                      <h4 className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.3em] flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        State Sesudah
                                      </h4>
                                      <span className="text-[8px] font-mono text-slate-600 uppercase tracking-widest">SYSTEM GENERATED</span>
                                    </div>
                                    <div className="relative group">
                                      <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/10 to-transparent rounded-2xl blur opacity-25 group-hover:opacity-40 transition-opacity" />
                                      <pre className="relative p-5 bg-slate-900 border border-emerald-500/10 rounded-xl text-[10px] font-mono text-slate-200 overflow-auto whitespace-pre-wrap max-h-80 shadow-2xl scrollbar-thin scrollbar-thumb-slate-800">
                                        {JSON.stringify(log.afterData, (key, value) => {
                                          if (key === 'timestamp' && value?.seconds) return format(new Date(value.seconds * 1000), 'yyyy-MM-dd HH:mm:ss');
                                          if (key === 'updatedAt' && value?.seconds) return format(new Date(value.seconds * 1000), 'yyyy-MM-dd HH:mm:ss');
                                          return value;
                                        }, 2)}
                                      </pre>
                                    </div>
                                  </div>
                                )}
                                {log.metadata && !log.beforeData && !log.afterData && (
                                  <div className="col-span-2 space-y-4">
                                    <div className="flex items-center justify-between">
                                      <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-[0.3em] flex items-center gap-2">
                                        <Database className="w-3 h-3" />
                                        Metadata Audit Tambahan
                                      </h4>
                                    </div>
                                    <div className="relative group">
                                      <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/5 to-transparent rounded-2xl blur opacity-25 group-hover:opacity-40 transition-opacity" />
                                      <pre className="relative p-5 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-mono text-slate-400 overflow-auto whitespace-pre-wrap max-h-80 shadow-2xl scrollbar-thin scrollbar-thumb-slate-800">
                                        {JSON.stringify(log.metadata, null, 2)}
                                      </pre>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-30">
                      <History className="w-16 h-16 text-slate-500" />
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Tidak Ada Log Aktivitas</p>
                        <p className="text-[10px] text-slate-600 font-medium">Sesuaikan filter atau kata kunci pencarian Anda</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      
      <div className="flex items-center justify-center p-4">
        <div className="p-4 bg-slate-950/30 rounded-2xl border border-slate-800/50 flex flex-col items-center gap-2 text-center max-w-md">
          <Lock className="w-4 h-4 text-emerald-500/50" />
          <p className="text-[10px] text-slate-500 leading-relaxed uppercase tracking-wider font-bold">
            Data log sistem bersifat read-only dan dilindungi oleh protokol keamanan {APP_NAME}.
          </p>
        </div>
      </div>
    </div>
  );
}




function ReportsView_Deprecated({ trips, onNotify, settings, upts = [], users = [], profile, tripFilterRange, setTripFilterRange, reportsCache, setReportsCache }: any) {
  const isWeightEnabled = settings?.enableWeight !== false;
  const showVolume = settings?.showVolume !== false;

  const [reportType, setReportType] = useState<"daily" | "monthly" | "yearly">("daily");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedYear, setSelectedYear] = useState(format(new Date(), 'yyyy'));

  const [loadingAggregates, setLoadingAggregates] = useState(false);

  const currentKey = `${reportType}-${
    reportType === 'daily' ? selectedDate : (reportType === 'monthly' ? selectedMonth : selectedYear)
  }-${profile?.role || ''}`;

  const isCached = reportsCache && reportsCache.key === currentKey;
  const displayAggregatedRitase = isCached ? reportsCache.ritase : null;
  const displayAggregatedTonnage = isCached ? reportsCache.tonnage : null;
  const displayAggregatedVolume = isCached ? reportsCache.volume : null;
  const displayMonthlyBreakdown = isCached ? (reportsCache.monthlyBreakdown || []) : [];

  // Reusable aggregation helper function
  const getTripAggregatesByDateRange = async (startDate: string, endDate: string, userProfile: any) => {
    let q = query(
      collection(db, "trips"),
      where("date", ">=", startDate),
      where("date", "<=", endDate)
    );
    
    if (userProfile?.role === 'user') {
      const assignedUptName = userProfile?.assigned_upt_name || userProfile?.uptName || userProfile?.upt || "";
      if (assignedUptName) {
        q = query(q, where("upt", "==", assignedUptName));
      }
    }
    
    try {
      const snapshot = await getAggregateFromServer(q, {
        totalTrips: count(),
        totalTonnage: sum("tonnage"),
        totalVolume: sum("volume"),
        totalTripCount: sum("tripCount")
      });
      
      const data = snapshot.data();
      return {
        ritase: Number(data.totalTripCount || data.totalTrips || 0),
        tonnage: Number(data.totalTonnage || 0),
        volume: Number(data.totalVolume || 0),
        docCount: Number(data.totalTrips || 0)
      };
    } catch (error) {
      console.error("Aggregation error for range:", startDate, "to", endDate, error);
      if (error instanceof Error && (error.message.includes("quota") || error.message.includes("Quota"))) {
        onNotify('error', "Batas kuota database tercapai saat mengambil data laporan.");
      }
      return {
        ritase: 0,
        tonnage: 0,
        volume: 0,
        docCount: 0
      };
    }
  };

  const handleCalculateReport = async () => {
    setLoadingAggregates(true);
    try {
      let dataToCache: any = null;
      if (reportType === "daily") {
        const res = await getTripAggregatesByDateRange(selectedDate, selectedDate, profile);
        dataToCache = {
          key: currentKey,
          ritase: res.ritase,
          tonnage: res.tonnage,
          volume: res.volume,
          monthlyBreakdown: []
        };
        if (tripFilterRange.start !== selectedDate || tripFilterRange.end !== selectedDate) {
          setTripFilterRange({ start: selectedDate, end: selectedDate });
        }
      } else if (reportType === "monthly") {
        const date = new Date(selectedMonth + "-01");
        const start = format(startOfMonth(date), 'yyyy-MM-dd');
        const end = format(endOfMonth(date), 'yyyy-MM-dd');
        const res = await getTripAggregatesByDateRange(start, end, profile);
        dataToCache = {
          key: currentKey,
          ritase: res.ritase,
          tonnage: res.tonnage,
          volume: res.volume,
          monthlyBreakdown: []
        };
        if (tripFilterRange.start !== start || tripFilterRange.end !== end) {
          setTripFilterRange({ start, end });
        }
      } else if (reportType === "yearly") {
        const yearVal = parseInt(selectedYear);
        const promises = [];
        const indonesianMonths = [
          "Januari", "Februari", "Maret", "April", "Mei", "Juni",
          "Juli", "Agustus", "September", "Oktober", "November", "Desember"
        ];
        for (let m = 0; m < 12; m++) {
          const start = format(new Date(yearVal, m, 1), 'yyyy-MM-dd');
          const end = format(endOfMonth(new Date(yearVal, m, 1)), 'yyyy-MM-dd');
          promises.push(
            getTripAggregatesByDateRange(start, end, profile).then(res => ({
              monthIndex: m,
              monthName: indonesianMonths[m],
              ...res
            }))
          );
        }
        const results = await Promise.all(promises);
        
        const sumRitase = results.reduce((sum, item) => sum + item.ritase, 0);
        const sumTonnage = results.reduce((sum, item) => sum + item.tonnage, 0);
        const sumVolume = results.reduce((sum, item) => sum + item.volume, 0);
        
        dataToCache = {
          key: currentKey,
          ritase: sumRitase,
          tonnage: sumTonnage,
          volume: sumVolume,
          monthlyBreakdown: results
        };

        const yearStart = format(startOfYear(new Date(yearVal, 0, 1)), 'yyyy-MM-dd');
        const yearEnd = format(endOfYear(new Date(yearVal, 0, 1)), 'yyyy-MM-dd');
        if (tripFilterRange.start !== yearStart || tripFilterRange.end !== yearEnd) {
          setTripFilterRange({ start: yearStart, end: yearEnd });
        }
      }
      
      setReportsCache(dataToCache);
      onNotify('success', 'Laporan berhasil diperbarui.');
    } catch (error) {
      console.error("Gagal mematikan/memuat agregasi laporan:", error);
      onNotify('error', 'Gagal memproses agregasi laporan.');
    } finally {
      setLoadingAggregates(false);
    }
  };

  const getFilteredTrips = () => {
    if (reportType === "daily") {
      return trips.filter((t: any) => t.date === selectedDate);
    } else if (reportType === "monthly") {
      return trips.filter((t: any) => t.date.startsWith(selectedMonth));
    } else {
      return trips.filter((t: any) => t.date.startsWith(selectedYear));
    }
  };

  const filtered = getFilteredTrips();
  const title = reportType === "daily" ? `Laporan Harian ${selectedDate}` : reportType === "monthly" ? `Laporan Bulanan ${selectedMonth}` : `Laporan Tahunan ${selectedYear}`;

  const summaryByUpt = filtered.reduce((acc: any, t: any) => {
    acc[t.upt] = (acc[t.upt] || 0) + (t.tripCount || 1);
    return acc;
  }, {});

  // UPT Coverage Logic
  const submittedUptNames = Object.keys(summaryByUpt);
  const totalUptCount = upts.length;
  const submittedCount = submittedUptNames.length;
  const missingUpts = upts.filter((u: any) => !submittedUptNames.includes(u.name));

  const summaryByVehicleType = filtered.reduce((acc: any, t: any) => {
    acc[t.vehicleType || "Lainnya"] = (acc[t.vehicleType || "Lainnya"] || 0) + (t.tripCount || 1);
    return acc;
  }, {});

  // Assign screen-displayed values strictly from aggregated values (if cached and calculated) or 0
  const displayRitase = isCached ? (displayAggregatedRitase ?? 0) : 0;
  const displayTonnage = isCached ? (displayAggregatedTonnage ?? 0) : 0;
  const displayVolume = isCached ? (displayAggregatedVolume ?? 0) : 0;

  const handleExportExcel = async () => {
    if (!isCached) {
      onNotify('error', 'Silakan tampilkan laporan terlebih dahulu sebelum mengekspor data');
      return;
    }
    if (filtered.length === 0) {
      onNotify('error', 'Tidak ada data detail untuk periode terpilih');
      return;
    }
    try {
      const fileName = title.replace(/\s/g, '_');
      await exportTripsToExcel(filtered, fileName, users);

      // Log Activity: Export Excel
      logActivity(
        'sistem', 
        'ekspor_excel', 
        'Laporan', 
        `Ekspor laporan Excel: ${title}`,
        {
          metadata: { recordCount: filtered.length, reportType, title },
          profile
        }
      );

      onNotify('success', 'Laporan Excel berhasil diunduh. Data tetap tersimpan di dalam sistem.');
    } catch (e) {
      onNotify('error', 'Gagal mengunduh laporan Excel');
    }
  };

  const handleExportPdf = () => {
    if (!isCached) {
      onNotify('error', 'Silakan tampilkan laporan terlebih dahulu sebelum mengekspor data');
      return;
    }
    if (filtered.length === 0) {
      onNotify('error', 'Tidak ada data detail untuk periode terpilih');
      return;
    }
    
    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(18);
      doc.text("Laporan Ritase Pengangkutan Sampah", 14, 22);
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Periode: ${title}`, 14, 30);
      doc.text(`Dicetak pada: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 35);
      
      // Summary
      doc.setTextColor(0);
      doc.setFontSize(14);
      doc.text("Ringkasan Data", 14, 50);
      
      const summaryData = [
        ["Total Ritase", `${displayRitase} Rit`],
        ...(isWeightEnabled ? [["Total Tonase", `${(displayTonnage / 1000).toFixed(2)} Ton`]] : []),
        ...(showVolume ? [["Total Volume", `${displayVolume.toFixed(2)} m3`]] : [])
      ];
      
      autoTable(doc, {
        startY: 55,
        head: [['Indikator', 'Nilai']],
        body: summaryData,
        theme: 'grid',
        headStyles: { fillColor: '#10b981', textColor: 255 }
      });
      
      // Breakdown by UPT
      doc.text("Ringkasan per UPT", 14, (doc as any).lastAutoTable.finalY + 15);
      const uptData = Object.entries(summaryByUpt).map(([upt, rit]) => [upt, rit + " Rit"]);
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [['UPT', 'Ritase']],
        body: uptData,
        theme: 'striped',
        headStyles: { fillColor: '#10b981', textColor: 255 }
      });

      // Data Table
      doc.addPage();
      doc.text("Detail Log Ritase", 14, 22);
      
      const tableBody = filtered.map(t => [
        t.date,
        t.operationalTime || "-",
        t.upt,
        t.driverName,
        t.vehiclePlate,
        t.tripCount + " Rit"
      ]);
      
      autoTable(doc, {
        startY: 30,
        head: [['Tanggal', 'Jam', 'UPT', 'Sopir', 'Plat', 'Ritase']],
        body: tableBody,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: '#10b981', textColor: 255 }
      });

      doc.save(`${title.replace(/\s/g, '_')}.pdf`);

      // Log Activity: Export PDF
      logActivity(
        'sistem', 
        'ekspor_pdf', 
        'Laporan', 
        `Ekspor laporan PDF: ${title}`,
        {
          metadata: { recordCount: filtered.length, reportType, title },
          profile
        }
      );

      onNotify('success', 'Laporan PDF berhasil diunduh');
    } catch (error) {
      console.error(error);
      onNotify('error', 'Gagal mengunduh laporan PDF');
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Laporan & Rekapitulasi</h2>
          <p className="text-slate-500 text-sm">Analisa dan unduh rekapitulasi data pengangkutan.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="p-6 flex flex-col gap-6 bg-slate-900 border-slate-800 lg:col-span-1 h-fit">
          <div className="flex flex-col gap-4">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Jenis Laporan</label>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => setReportType("daily")}
                className={`px-4 py-3 rounded-xl border text-sm font-bold transition-all text-left flex items-center justify-between ${reportType === "daily" ? "bg-emerald-600/10 text-emerald-400 border-emerald-500/30" : "bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-700"}`}
              >
                Harian
                {reportType === "daily" && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
              </button>
              <button 
                onClick={() => setReportType("monthly")}
                className={`px-4 py-3 rounded-xl border text-sm font-bold transition-all text-left flex items-center justify-between ${reportType === "monthly" ? "bg-emerald-600/10 text-emerald-400 border-emerald-500/30" : "bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-700"}`}
              >
                Bulanan
                {reportType === "monthly" && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
              </button>
              <button 
                onClick={() => setReportType("yearly")}
                className={`px-4 py-3 rounded-xl border text-sm font-bold transition-all text-left flex items-center justify-between ${reportType === "yearly" ? "bg-emerald-600/10 text-emerald-400 border-emerald-500/30" : "bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-700"}`}
              >
                Tahunan
                {reportType === "yearly" && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Pilih Periode</label>
            {reportType === "daily" && <Input type="date" value={selectedDate} onChange={(e: any) => setSelectedDate(e.target.value)} />}
            {reportType === "monthly" && <Input type="month" value={selectedMonth} onChange={(e: any) => setSelectedMonth(e.target.value)} />}
            {reportType === "yearly" && (
              <Select 
                value={selectedYear} 
                onChange={(e: any) => setSelectedYear(e.target.value)} 
                options={Array.from({ length: 5 }).map((_, i) => ({ value: (new Date().getFullYear() - i).toString(), label: (new Date().getFullYear() - i).toString() }))}
              />
            )}
            <Button 
              onClick={handleCalculateReport} 
              disabled={loadingAggregates}
              className="w-full mt-2 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-950/20 text-xs uppercase tracking-wider flex items-center justify-center gap-2"
            >
              {loadingAggregates ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  {reportType === "yearly" ? "Tampilkan Rekap Tahunan" : "Tampilkan Laporan"}
                </>
              )}
            </Button>
          </div>

          <div className="pt-6 border-t border-slate-800 flex flex-col gap-3">
             {profile?.role === 'admin' && (
                <>
                  <Button onClick={handleExportExcel} className="w-full py-4 text-xs font-bold uppercase tracking-widest gap-3">
                    <FileSpreadsheet className="w-5 h-5" /> Export Excel
                  </Button>
                  <Button onClick={handleExportPdf} variant="secondary" className="w-full py-4 text-xs font-bold uppercase tracking-widest gap-3">
                    <ClipboardList className="w-5 h-5" /> Export PDF
                  </Button>
                </>
             )}
          </div>
        </Card>

        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-slate-900/50 border-slate-800">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Ritase</p>
              <h4 className="text-2xl font-bold text-white">
                {loadingAggregates ? (
                  <Loader2 className="w-5 h-5 animate-spin inline-block text-slate-400" />
                ) : (
                  <>
                    {displayRitase} <span className="text-sm font-medium text-slate-500">Rit</span>
                  </>
                )}
              </h4>
            </Card>
            {isWeightEnabled && (
              <Card className="p-4 bg-slate-900/50 border-slate-800">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Tonase</p>
                <h4 className="text-2xl font-bold text-emerald-500">
                  {loadingAggregates ? (
                    <Loader2 className="w-5 h-5 animate-spin inline-block text-slate-400" />
                  ) : (
                    <>
                      {(displayTonnage / 1000).toFixed(1)} <span className="text-sm font-medium text-slate-500">Ton</span>
                    </>
                  )}
                </h4>
              </Card>
            )}
            {showVolume && (
              <Card className="p-4 bg-slate-900/50 border-slate-800">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Volume</p>
                <h4 className="text-2xl font-bold text-blue-500">
                  {loadingAggregates ? (
                    <Loader2 className="w-5 h-5 animate-spin inline-block text-slate-400" />
                  ) : (
                    <>
                      {displayVolume.toFixed(1)} <span className="text-sm font-medium text-slate-500">m³</span>
                    </>
                  )}
                </h4>
              </Card>
            )}
            <Card className="p-4 bg-slate-900/50 border-slate-800 relative group overflow-hidden">
               <div className="flex items-center justify-between mb-1">
                 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Input UPT</p>
                 <Badge variant={submittedCount === totalUptCount ? "success" : submittedCount > 0 ? "user" : "status"}>
                    {submittedCount} / {totalUptCount}
                 </Badge>
               </div>
               <h4 className="text-2xl font-bold text-white mb-2">{submittedCount === totalUptCount ? "Selesai" : `${submittedCount} Input`}</h4>
               <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${(submittedCount / (totalUptCount || 1)) * 100}%` }} />
               </div>
               
               {missingUpts.length > 0 && (
                 <div className="mt-4 pt-3 border-t border-slate-800 flex flex-col gap-2">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Wilayah Belum Input:</p>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto scrollbar-hide">
                       {missingUpts.map((u: any) => (
                         <span key={u.id} className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-slate-800 text-slate-400 group-hover:text-slate-300 transition-colors uppercase truncate">
                           {u.name}
                         </span>
                       ))}
                    </div>
                 </div>
               )}
            </Card>
          </div>

          <Card className="bg-slate-900 border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-950/20 flex items-center justify-between">
               <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ringkasan per Wilayah UPT</h3>
               <Badge variant="user">{filtered.length} {filtered.length === 2000 ? "Records (Capped)" : "Records"}</Badge>
            </div>
            <div className="p-4 overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                   <tr>
                     <th className="pb-3 px-2">UPT</th>
                     <th className="pb-3 px-2 text-right">Ritase</th>
                     <th className="pb-3 px-2 text-right">Progress</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {isCached ? (
                    Object.entries(summaryByUpt).length > 0 ? Object.entries(summaryByUpt).sort((a: any, b: any) => b[1] - a[1]).map(([upt, rit]: any) => {
                      const percentage = displayRitase > 0 ? (rit / displayRitase) * 100 : 0;
                      return (
                        <tr key={upt} className="group">
                          <td className="py-3 px-2 text-sm font-bold text-slate-300">{upt}</td>
                          <td className="py-3 px-2 text-sm font-mono text-emerald-500 text-right">{rit} Rit</td>
                          <td className="py-3 px-2 text-right min-w-[120px]">
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${percentage}%` }} />
                            </div>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-xs text-slate-600 italic">Tidak ada data detail untuk periode ini</td>
                      </tr>
                    )
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-xs text-slate-500 italic font-medium">
                        Silakan klik tombol "Tampilkan Laporan" untuk memproses data UPT
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="bg-slate-900 border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-950/20">
               <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ringkasan per Jenis Kendaraan</h3>
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
               {isCached ? (
                 <>
                   {Object.entries(summaryByVehicleType).map(([type, rit]: any) => (
                     <div key={type} className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter mb-1 truncate">{type}</p>
                        <p className="text-xl font-bold text-white">{rit} <span className="text-[10px] text-slate-500">Rit</span></p>
                     </div>
                   ))}
                   {Object.entries(summaryByVehicleType).length === 0 && (
                     <div className="col-span-full py-4 text-center text-xs text-slate-600 italic">Data kosong</div>
                   )}
                 </>
               ) : (
                 <div className="col-span-full py-4 text-center text-xs text-slate-500 italic font-medium">
                    Silakan klik tombol "Tampilkan Laporan" untuk memproses data jenis kendaraan
                 </div>
               )}
            </div>
          </Card>

          {/* Yearly Month-by-Month breakdown with accurate aggregates */}
          {reportType === "yearly" && (
            <Card className="bg-slate-900 border-slate-800 overflow-hidden">
              <div className="p-4 border-b border-slate-800 bg-slate-950/20 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Detail Ritase & Tonase per Bulan</h3>
                {loadingAggregates && <Loader2 className="w-4 h-4 animate-spin text-slate-500" />}
              </div>
              <div className="p-4 overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    <tr>
                      <th className="pb-3 px-2">Bulan</th>
                      <th className="pb-3 px-2 text-right">Ritase</th>
                      {isWeightEnabled && <th className="pb-3 px-2 text-right">Tonase</th>}
                      {showVolume && <th className="pb-3 px-2 text-right">Volume</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {isCached && displayMonthlyBreakdown.length > 0 ? displayMonthlyBreakdown.map((item) => (
                      <tr key={item.monthIndex} className="group hover:bg-slate-850/35 transition-colors">
                        <td className="py-3 px-2 text-sm font-bold text-slate-300">{item.monthName}</td>
                        <td className="py-3 px-2 text-sm font-mono text-emerald-500 text-right">{item.ritase} Rit</td>
                        {isWeightEnabled && (
                          <td className="py-3 px-2 text-sm font-mono text-emerald-400 text-right">
                            {(item.tonnage / 1000).toFixed(1)} Ton
                          </td>
                        )}
                        {showVolume && (
                          <td className="py-3 px-2 text-sm font-mono text-blue-500 text-right">
                            {item.volume.toFixed(1)} m³
                          </td>
                        )}
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={isWeightEnabled ? (showVolume ? 4 : 3) : (showVolume ? 3 : 2)} className="py-8 text-center text-xs text-slate-500 italic font-medium">
                          {loadingAggregates ? "Sedang memposting data..." : "Silakan klik tombol \"Tampilkan Rekap Tahunan\" untuk memproses"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}

function VehiclesView_Deprecated({ vehicles, onNotify, upts, profile, drivers, trips, settings }: any) {
  const isAdmin = profile?.role === 'admin' || profile?.role === 'co-admin';
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState<Vehicle | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [expandedTypes, setExpandedTypes] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredVehicles = vehicles.filter((v: any) => {
    const s = searchTerm.toLowerCase();
    const vUpts = v.upts ? v.upts.join(" ").toLowerCase() : (v.upt || "").toLowerCase();
    const vRoute = (v.route || "").toLowerCase();
    const vTps = (v.tps || "").toLowerCase();
    const vStatus = (v.status || "").toLowerCase();
    const tonList = v.ritaseTonnage || {};
    const tonText = JSON.stringify(tonList).toLowerCase();

    return (
      v.plateNumber?.toLowerCase().includes(s) ||
      v.type?.toLowerCase().includes(s) ||
      vUpts.includes(s) ||
      vRoute.includes(s) ||
      vTps.includes(s) ||
      vStatus.includes(s) ||
      tonText.includes(s) ||
      (v.defaultDriverName || "").toLowerCase().includes(s)
    );
  });

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
        if (driver) batch.update(doc(db, "drivers", driver.id), { vehiclePlate: "", upt: deleteField() });
      }
      batch.delete(doc(db, "vehicles", id));
      await batch.commit();

      logActivity('perubahan_data', 'hapus_kendaraan', 'Master Kendaraan', `Penghapusan kendaraan: ${vehicleToDelete?.plateNumber || id}`, 
        { recordId: id, recordLabel: vehicleToDelete?.plateNumber || id, beforeData: vehicleToDelete, profile });
      onNotify('success', 'Kendaraan berhasil dihapus');
      setConfirmDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `vehicles/${id}`);
      onNotify('error', 'Gagal menghapus kendaraan');
    }
  };

  const handleSyncTonnage = async () => {
    if (trips.length === 0) {
      onNotify('success', 'Tidak ada data ritase untuk disinkronkan');
      return;
    }
    setShowSyncConfirm(true);
  };

  const processSyncTonnage = async () => {
    setShowSyncConfirm(false);
    setIsSyncing(true);
    let syncCount = 0;
    try {
      // 1. Group trips by vehicle|date|driver|upt (as per current requirement)
      const groups: { [key: string]: any[] } = {};
      trips.forEach((t: any) => {
        // Ensure values are strings to prevent "undefined" keys
        const vPlate = t.vehiclePlate || "";
        const tDate = t.date || "";
        const dName = t.driverName || "";
        const uName = t.upt || "";
        const key = `${vPlate}|${tDate}|${dName}|${uName}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(t);
      });

      // Sort each group by operational time
      for (const key in groups) {
        groups[key].sort((a: any, b: any) => {
          if (a.operationalTime && b.operationalTime) return a.operationalTime.localeCompare(b.operationalTime);
          return (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0);
        });
      }

      const updates: { id: string, tonnage: number, volume: number }[] = [];

      // 2. Determine updates
      for (const trip of trips) {
        const vPlate = trip.vehiclePlate || "";
        const tDate = trip.date || "";
        const dName = trip.driverName || "";
        const uName = trip.upt || "";
        const key = `${vPlate}|${tDate}|${dName}|${uName}`;
        
        const groupTrips = groups[key] || [];
        const vehicle = vehicles.find((v: any) => v.plateNumber === vPlate);
        
        if (!vehicle || !vehicle.ritaseTonnage) continue;

        const ritaseIndex = groupTrips.findIndex((t: any) => t.id === trip.id);
        if (ritaseIndex === -1) continue;
        
        const ritaseNum = ritaseIndex + 1;
        let calculatedTonnageKg = 0;
        
        // Configuration Resolution Logic
        const homeUpts = vehicle.upts || (vehicle.upt ? [vehicle.upt] : []);
        let targetConfig = null;

        // 1. Try Home UPTs
        for (const hUpt of homeUpts) {
          if (vehicle.ritaseTonnage[hUpt]) {
            targetConfig = vehicle.ritaseTonnage[hUpt];
            break;
          }
        }
        
        // 2. Try "default"
        if (!targetConfig) {
          targetConfig = (vehicle.ritaseTonnage as any)["default"];
        }
        
        // 3. Try first key that contains numeric entries
        if (!targetConfig || typeof targetConfig !== 'object' || Object.keys(targetConfig).length === 0) {
          const firstValidKey = Object.keys(vehicle.ritaseTonnage).find(k => 
            typeof (vehicle.ritaseTonnage as any)[k] === 'object' && 
            Object.keys((vehicle.ritaseTonnage as any)[k]).some(sk => !isNaN(Number(sk)))
          );
          if (firstValidKey) targetConfig = (vehicle.ritaseTonnage as any)[firstValidKey];
        }

        // 5. Legacy Fallback (flat object)
        if (!targetConfig || typeof targetConfig !== 'object' || Object.keys(targetConfig).length === 0) {
          targetConfig = vehicle.ritaseTonnage;
        }

        // Validate if targetConfig actually has ritase keys (numeric)
        if (targetConfig && typeof targetConfig === 'object') {
          const ritaseKeys = Object.keys(targetConfig)
            .map(Number)
            .filter(k => !isNaN(k))
            .sort((a, b) => a - b);
            
          if (ritaseKeys.length > 0) {
            const circularIndex = (ritaseNum - 1) % ritaseKeys.length;
            calculatedTonnageKg = (targetConfig as any)[ritaseKeys[circularIndex]];
          }
        }

        if (calculatedTonnageKg > 0) {
          // Check if tonnage OR volume needs update
          // Formula: Vol = Ton / 400
          const currentTonnage = trip.tonnage || 0;
          const calculatedVolume = parseFloat((calculatedTonnageKg / 400).toFixed(1));
          const currentVolume = trip.volume || 0;

          if (Math.abs(currentTonnage - calculatedTonnageKg) > 0.1 || Math.abs(currentVolume - calculatedVolume) > 0.1) {
            updates.push({ 
              id: trip.id, 
              tonnage: calculatedTonnageKg,
              volume: calculatedVolume
            });
          }
        }
      }

      if (updates.length === 0) {
        onNotify('success', 'Semua data tonase & volume sudah akurat');
        return;
      }

      // 3. Batch updates
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
      
      logActivity('sistem', 'sync_tonase_kalibrasi', 'Master Kendaraan', 
        `Sinkronisasi massal \& kalibrasi ulang ${syncCount} data ritase dilakukan oleh admin`, 
        { metadata: { syncCount, totalTrips: trips.length }, profile });

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

                    // Try to find first available valid tonnage
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
                                    <button onClick={() => handleDelete(v.id)} className="text-rose-500 hover:text-rose-400 text-[9px] sm:text-[10px] font-bold uppercase">Ya</button>
                                    <button onClick={() => setConfirmDelete(null)} className="text-slate-500 hover:text-white text-[9px] sm:text-[10px] font-bold uppercase">Batal</button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-3">
                                    <button onClick={() => { setIsEditing(v); setShowModal(true); }} className="text-slate-500 hover:text-blue-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-colors">Edit</button>
                                    <button onClick={() => setConfirmDelete(v.id)} className="text-slate-500 hover:text-rose-500 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-colors">Hapus</button>
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

          {/* Handle other types if any (though select is restricted) */}
          {(() => {
            const standardTypes = ["Arm Roll", "Dump Truck", "Motor Roda 3", "Pick Up"];
            const otherVehicles = filteredVehicles.filter((v: any) => !standardTypes.includes(v.type));
            if (otherVehicles.length === 0) return null;
            
            // Group other vehicles by specific types
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
                                            <button onClick={() => handleDelete(v.id)} className="text-rose-500 hover:text-rose-400 text-xs font-bold underline">Ya</button>
                                            <button onClick={() => setConfirmDelete(null)} className="text-slate-500 hover:text-slate-300 text-xs font-bold underline">Batal</button>
                                          </div>
                                        ) : (
                                          <div className="flex items-center justify-end gap-3 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => { setIsEditing(v); setShowModal(true); }} className="text-slate-500 hover:text-blue-400 text-xs font-bold underline text-right">Edit</button>
                                            <button onClick={() => setConfirmDelete(v.id)} className="text-slate-500 hover:text-rose-500 text-xs font-bold underline text-right">Hapus</button>
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

function DriversView_Deprecated({ drivers, onNotify, upts, profile, vehicles, settings }: any) {
  const isAdmin = profile?.role === 'admin' || profile?.role === 'co-admin';
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState<Driver | null>(null);
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

      logActivity('perubahan_data', 'hapus_personil', 'Master Personil', `Penghapusan personil: ${driverToDelete?.name || id}`, 
        { recordId: id, recordLabel: driverToDelete?.name || id, beforeData: driverToDelete, profile });
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
             // Still show UPT card if it's not searching? 
             // Actually, if a UPT has 0 drivers, we might want to hide it to keep it compact.
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
                                      <button onClick={(e) => { e.stopPropagation(); handleDelete(d.id); }} className="p-1 bg-rose-500/10 text-rose-500 rounded hover:bg-rose-500 hover:text-white transition-all">
                                        <Check className="w-3 h-3" />
                                      </button>
                                      <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }} className="p-1 bg-slate-800 text-slate-400 rounded hover:text-white transition-all">
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                      <button onClick={(e) => { e.stopPropagation(); setIsEditing(d); setShowModal(true); }} className="p-1.5 bg-slate-800 rounded-md text-slate-500 hover:text-blue-400 transition-colors">
                                        <Edit2 className="w-3 h-3" />
                                      </button>
                                      <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(d.id); }} className="p-1.5 bg-slate-800 rounded-md text-slate-500 hover:text-rose-500 transition-colors">
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
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(d.id); }} className="px-3 py-1.5 bg-rose-600 text-white text-[10px] font-bold rounded-lg uppercase shadow-lg shadow-rose-900/20">Ya, Hapus</button>
                          <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }} className="px-3 py-1.5 bg-slate-800 text-slate-400 text-[10px] font-bold rounded-lg uppercase">Batal</button>
                        </div>
                      ) : (
                        <div className="flex gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); setIsEditing(d); setShowModal(true); }} className="text-slate-400 hover:text-blue-400 p-2 bg-slate-800/50 rounded-lg transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(d.id); }} className="text-slate-400 hover:text-rose-500 p-2 bg-slate-800/50 rounded-lg transition-colors">
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

function UptsView_Deprecated({ upts, vehicles, drivers, onNotify, profile, onEditVehicle, onEditDriver }: any) {
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

        // Log Activity: UPT Update
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

        onNotify('success', 'Data UPT diperbarui');
      } else {
        // Generate upt_id for new records
        const lastUptId = upts
          .map(u => u.upt_id)
          .filter(id => id && id.startsWith('UPT'))
          .map(id => parseInt(id.replace('UPT', ''), 10))
          .filter(n => !isNaN(n))
          .reduce((max, val) => Math.max(max, val), 0);
        
        const nextId = `UPT${(lastUptId + 1).toString().padStart(3, '0')}`;
        
        const newUptData = {
          ...data,
          upt_id: nextId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        const docRef = await addDoc(collection(db, "upts"), newUptData);

        // Log Activity: UPT Create
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

    // Duplicate check
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

      // Log Activity: Sync UPT Defaults
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

      // Log Activity: UPT Delete
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
                    <Building2 className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
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
                        <button onClick={() => handleDelete(u.id)} className="text-rose-500 hover:text-rose-400 text-[10px] font-bold uppercase py-1">Ya</button>
                        <button onClick={() => setConfirmDelete(null)} className="text-slate-500 hover:text-white text-[10px] font-bold uppercase py-1">Batal</button>
                      </div>
                    ) : isAdmin ? (
                      <div className="flex items-center gap-3 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => { setIsEditing(u); setShowModal(true); }} className="text-slate-500 hover:text-blue-400 text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1.5 py-1">
                          <Edit2 className="w-3 h-3" /> Edit
                        </button>
                        <button onClick={() => setConfirmDelete(u.id)} className="text-slate-500 hover:text-rose-500 text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1.5 py-1">
                          <Trash2 className="w-3 h-3" /> Hapus
                        </button>
                      </div>
                    ) : <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest italic opacity-50 py-1">Read Only</span>}
                </div>
                
                <button 
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
            <h3 className="text-xl font-bold text-white mb-6">{isEditing ? "Edit UPT" : "Tambah UPT"}</h3>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Input label="Nama Lengkap UPT" name="nama_upt" required showError={submitAttempted && !(isEditing?.nama_upt || isEditing?.name)} defaultValue={isEditing?.nama_upt || isEditing?.name} placeholder="UPT Kedaton / UPT Tanjung Karang Pusat" />
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
                <Button type="submit" disabled={loading} className="flex-1">{loading ? <Loader2 className="animate-spin" /> : "Simpan Data UPT"}</Button>
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

function TpaTpsView_Deprecated({ tpas, tps, onNotify, settings, profile }: any) {
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
      const batch = writeBatch(db);
      INITIAL_TPS_DATA.forEach(data => {
        const newRef = doc(collection(db, "tps"));
        batch.set(newRef, {
          ...data,
          location: data.address, // For compatibility
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();

      // Log Activity: Import TPS
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
      await setDoc(doc(db, "settings", "global"), data);
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

        // Log Activity: TPA/TPS Update
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

        onNotify('success', `Data ${label} diperbarui`);
      } else {
        const docRef = await addDoc(collection(db, collectionName), data);

        // Log Activity: TPA/TPS Create
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
      delete data.createdAt; // Don't overwrite createdAt on edit
    }

    // Duplicate check
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

      // Log Activity: TPA/TPS Delete
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
          onClick={() => setActiveSubTab('tpa')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeSubTab === 'tpa' ? 'bg-emerald-500 text-white' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Database TPA
        </button>
        <button 
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
                    className="text-xs bg-slate-800 border-slate-700 hover:bg-slate-700"
                  >
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                      <><Download className="w-4 h-4 mr-1 text-emerald-500" /> Impor Data CSV</>
                    )}
                  </Button>
                )}
                <Button onClick={() => { setIsEditing(null); setShowModal(true); }} className="text-xs">
                  <Plus className="w-4 h-4" /> Tambah {label}
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
                              <MapPin className="w-3 h-3 text-emerald-500" />
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
                              className="text-[10px] text-blue-400 hover:text-blue-300 underline flex items-center gap-1 w-fit"
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
                                <button onClick={() => handleDelete(t.id)} className="text-rose-500 hover:text-rose-400 text-xs font-bold underline transition-colors">Ya</button>
                                <button onClick={() => setConfirmDelete(null)} className="text-slate-500 hover:text-slate-300 text-xs font-bold underline transition-colors">Batal</button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-3 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                <button onClick={() => { setIsEditing(t); setShowModal(true); }} className="text-slate-400 hover:text-blue-400 text-xs font-medium underline transition-colors">Edit</button>
                                <button onClick={() => setConfirmDelete(t.id)} className="text-slate-400 hover:text-rose-500 text-xs font-medium underline transition-colors">Hapus</button>
                              </div>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                {currentData.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-6 py-12 text-center">
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
                  {updatingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan Pengaturan"}
                </Button>
              </form>
            </Card>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-slate-900 rounded-2xl w-full max-w-md p-8 border border-slate-800">
            <h3 className="text-xl font-bold text-white mb-6">{isEditing ? `Edit ${label}` : `Tambah ${label}`}</h3>
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
                <Button type="submit" disabled={loading} className="flex-1">{loading ? <Loader2 className="animate-spin" /> : "Simpan"}</Button>
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
