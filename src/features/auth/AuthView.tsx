import React, { useState } from "react";
import { motion } from "motion/react";
import { 
  AlertCircle, 
  Building2, 
  User as UserIcon, 
  Lock, 
  Loader2, 
  ArrowRight 
} from "lucide-react";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  deleteUser 
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "../../lib/firebase";
import { UserProfile } from "../../types";
import { APP_NAME, APP_FULL_NAME, APP_ORG, APP_ORG_SHORT } from "../../constants";
import { Card, Button, Input } from "../master-data/components/SharedUI";

// Reusable Logo Component
export const Logo = ({ size = "md", className = "" }: { size?: "sm" | "md" | "lg" | "xl", className?: string }) => {
  const sizes = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-24 h-24",
    xl: "w-32 h-32"
  };

  return (
    <div className={`relative flex items-center justify-center ${sizes[size]} ${className}`}>
      {/* Primary Logo Image */}
      <img 
        src="/logo_siap.png" 
        alt={`${APP_NAME} Logo`} 
        className="w-full h-full object-contain relative z-10"
        referrerPolicy="no-referrer"
        onError={(e: any) => {
          // If image fails to load, hide it and show SVG fallback
          e.target.style.display = 'none';
          if (e.target.nextSibling) {
            (e.target.nextSibling as HTMLElement).style.display = 'block';
          }
        }}
      />

      {/* Modern SVG Fallback */}
      <svg 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg" 
        className="w-full h-full drop-shadow-xl hidden"
      >
        <circle cx="50" cy="50" r="48" fill="white" />
        <circle cx="50" cy="50" r="42" stroke="#059669" strokeWidth="2" strokeDasharray="4 2" />
        
        {/* Stylized Truck Shape */}
        <path d="M25 60H35V45H75V65H25V60Z" fill="#059669" />
        <path d="M35 45L40 40H70L75 45H35Z" fill="#10B981" />
        <circle cx="35" cy="65" r="4" fill="#1e293b" />
        <circle cx="65" cy="65" r="4" fill="#1e293b" />
        
        {/* Environment Leaves */}
        <path d="M45 35C45 35 48 25 55 28C62 31 60 40 60 40C60 40 52 40 48 37C44 34 45 35 45 35Z" fill="#10B981" />
        <path d="M55 35C55 35 52 25 45 28C38 31 40 40 40 40C40 40 48 40 52 37C56 34 55 35 55 35Z" fill="#059669" />
        
        {/* Text Area */}
        <text x="50" y="85" textAnchor="middle" fill="#059669" fontSize="10" fontWeight="bold" className="font-sans">{APP_NAME}</text>
      </svg>
    </div>
  );
};

interface AuthViewProps {
  onNotify: (type: 'success' | 'error', message: string) => void;
  onRegisterSuccess: (profile: UserProfile) => void;
  logActivity: any;
}

export function AuthView({ onNotify, onRegisterSuccess, logActivity }: AuthViewProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    
    if (isRegistering && password.length < 6) {
      setLoginError('Kata sandi harus minimal 6 karakter.');
      return;
    }

    setLoading(true);
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (isRegistering && trimmedPassword.length < 6) {
      setLoginError('Kata sandi harus minimal 6 karakter.');
      setLoading(false);
      return;
    }

    // Convert username to a dummy email for Firebase Auth
    const internalEmail = trimmedEmail.includes('@') ? trimmedEmail : `${trimmedEmail}@ritase.dlh`;
    
    try {
      if (isRegistering) {
        // Validation for registration
        if (!name.trim()) {
          setLoginError('Nama Akun / Entitas wajib diisi.');
          setLoading(false);
          return;
        }

        let userCredential;
        try {
          userCredential = await createUserWithEmailAndPassword(auth, internalEmail, trimmedPassword);
        } catch (authError: any) {
          console.error("Auth creation failed for:", internalEmail, authError);
          let message = "Gagal membuat akun autentikasi.";
          if (authError.code === 'auth/email-already-in-use') {
            message = "Username/Email sudah digunakan. Silakan gunakan yang lain.";
          } else if (authError.code === 'auth/weak-password') {
            message = "Password terlalu lemah (min. 6 karakter).";
          } else if (authError.code === 'auth/invalid-email') {
            message = "Format username/email tidak valid.";
          }
          setLoginError(message);
          setLoading(false);
          return;
        }
        
        // At this point, account is created in Auth. Now create Firestore profile.
        // If profile creation fails, we must rollback (delete) the Auth account.
        try {
          const isMasterAdmin = internalEmail === "bpsdlh@gmail.com" || trimmedEmail === "bpsdlh";
          const profileData: UserProfile = {
            userId: userCredential.user.uid,
            username: trimmedEmail,
            email: internalEmail,
            role: isMasterAdmin ? "admin" : "viewer",
            account_name: name.trim(),
            operator_name: "",
            status: isMasterAdmin ? 'active' : 'pending',
            assigned_upt_id: "",
            assigned_upt_name: "",
            createdAt: serverTimestamp()
          };

          // EXPLICIT LOGGING FOR EACH FIELD AND ITS TYPE PRIOR TO WRITE
          console.group("=== FIRESTORE WRITE PAYLOAD (SELF-REGISTRATION) ===");
          console.log("%cTarget Doc Path: %c" + `users/${userCredential.user.uid}`, "font-weight: bold; color: #10b981", "font-family: monospace; color: #ffffff");
          console.log("%cDetailed Fields, Values, and Types:", "font-weight: bold; color: #10b981");
          
          Object.entries(profileData).forEach(([key, val]) => {
            let typeStr: string = typeof val;
            let displayVal = val;
            if (val && typeof val === 'object') {
              if (val.constructor && val.constructor.name) {
                typeStr = val.constructor.name;
              } else {
                typeStr = "Object/Sentinel";
              }
              displayVal = "[Firestore Server Timestamp (FieldValue)]";
            }
            console.log(`%c[Field] %c${key.padEnd(20)} %c: value= %c"${displayVal}"%c (type: %c${typeStr}%c)`, 
              "color: #a855f7; font-weight: bold;", 
              "font-family: monospace; color: #3b82f6; font-weight: bold;",
              "color: #94a3b8;",
              "color: #e2e8f0; font-family: monospace;",
              "color: #94a3b8;",
              "color: #f59e0b; font-family: monospace; font-weight: bold;",
              "color: #94a3b8;");
          });

          // Print friendly representation
          const cleanJsonRepr = JSON.stringify(profileData, (k, v) => {
            if (v && typeof v === 'object' && !Array.isArray(v) && k === 'createdAt') {
              return "[Firestore_Server_Timestamp]";
            }
            return v;
          }, 2);
          console.log("%cFull JSON payload representation (sentinels abstracted):", "font-weight: bold; color: #10b981");
          console.log(cleanJsonRepr);
          console.groupEnd();

          await setDoc(doc(db, "users", userCredential.user.uid), profileData);
          
          // Log manual registration activity
          if (logActivity) {
            await logActivity('login', 'login_success', 'Autentikasi', 'Pengguna berhasil masuk (Registrasi Baru)', { profile: profileData });
          }

          // Selesaikan login dengan mengisi state profile lokal
          onRegisterSuccess(profileData);

          onNotify('success', 'Akun berhasil dibuat dan profil disinkronkan!');
        } catch (dbError: any) {
          console.error("CRITICAL: Firestore profile creation failed.", dbError);

          // Build precise payload description for user convenience
          const isMasterAdmin = internalEmail === "bpsdlh@gmail.com" || trimmedEmail === "bpsdlh";
          const formattedPayload = `
- userId: "${userCredential.user.uid}" [string]
- username: "${trimmedEmail}" [string]
- email: "${internalEmail}" [string]
- role: "${isMasterAdmin ? "admin" : "viewer"}" [string]
- account_name: "${name.trim()}" [string]
- operator_name: "" [string]
- status: "${isMasterAdmin ? "active" : "pending"}" [string]
- assigned_upt_id: "" [string]
- assigned_upt_name: "" [string]
- can_input_ritase: [Not sent / Absent]
- createdAt: [Firestore ServerTimestamp FieldValue]
          `.trim();
          
          // ROLLBACK
          try {
            await deleteUser(userCredential.user);
            console.log("Auth account rollback successful after Firestore failure.");
          } catch (rollbackError) {
            console.error("Auth account rollback FAILED. Orphan account created:", rollbackError);
          }

          let message = "Gagal sinkronisasi data profil. Akun dibatalkan demi keamanan.";
          if (dbError.message?.includes('permission-denied') || dbError.code === 'permission-denied') {
            message = `Akses ditolak (Firestore Security Rules). Payload yang dikirim:\n${formattedPayload}`;
          }
          setLoginError(message);
          // Re-throw with mandatory handler for system diagnostics
          handleFirestoreError(dbError, OperationType.CREATE, `users/${userCredential.user.uid}`);
        }
      } else {
        await signInWithEmailAndPassword(auth, internalEmail, trimmedPassword);
        onNotify('success', 'Selamat datang kembali!');
      }
    } catch (error: any) {
      console.error("Auth error for:", internalEmail, error);
      let message = "Terjadi kesalahan. Silakan coba lagi.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential' || error.code === 'auth/invalid-login-credentials') {
        message = "Username atau password yang Anda masukkan salah.";
      } else if (error.code === 'auth/email-already-in-use') {
        message = "Email sudah terdaftar.";
      } else if (error.code === 'auth/weak-password') {
        message = "Password terlalu lemah (min. 6 karakter).";
      } else if (error.code === 'auth/operation-not-allowed') {
        message = "Metode login Email/Password belum diaktifkan di Firebase Console.";
      } else if (error.code === 'auth/invalid-email') {
        message = "Format email tidak valid.";
      } else if (error.code === 'auth/too-many-requests') {
        message = "Terlalu banyak percobaan login. Coba lagi beberapa saat.";
      } else if (error.code === 'auth/user-disabled') {
        message = "Akun ini telah dinonaktifkan.";
      } else if (error.code === 'auth/network-request-failed') {
        message = "Gagal terhubung ke server. Periksa koneksi internet Anda.";
      }
      setLoginError(message);
      
      // Clear password field on error
      setPassword("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 p-6 relative overflow-x-hidden">
      <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-[400px] md:w-[600px] h-[400px] md:h-[600px] bg-emerald-900/10 rounded-full blur-[80px] md:blur-[120px] opacity-40 shrink-0" />
      <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-[400px] md:w-[600px] h-[400px] md:h-[600px] bg-blue-900/10 rounded-full blur-[80px] md:blur-[120px] opacity-40 shrink-0" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md z-10 mx-auto"
      >
        <Card className="p-8 border-slate-800 bg-slate-900/80 backdrop-blur-xl shadow-2xl">
          <div className="flex flex-col items-center mb-8 w-full text-center">
            <Logo size="lg" className="mb-6 shadow-xl shadow-emerald-500/10" />
            <div className="w-full space-y-2">
              <h1 className="text-3xl font-black text-white tracking-tighter leading-none">{APP_NAME}</h1>
              <div className="max-w-[280px] mx-auto px-1">
                <p className="text-slate-400 font-bold text-[10px] sm:text-[11px] tracking-wider uppercase leading-tight whitespace-normal break-words">
                  {APP_FULL_NAME}
                </p>
              </div>
              <p className="text-emerald-500 font-mono text-[8px] sm:text-[9px] tracking-[0.2em] uppercase font-bold">{APP_ORG}</p>
            </div>
          </div>

          <h2 className="text-lg font-bold text-white mb-6 text-center border-b border-slate-800 pb-4">
            {isRegistering ? "Pendaftaran Personil" : "Login Portal Sistem"}
          </h2>
          
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {loginError && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl p-3 flex items-start gap-3"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="text-[11px] font-bold leading-tight uppercase tracking-wide text-left">{loginError}</p>
              </motion.div>
            )}

            {isRegistering && (
              <Input 
                label="Nama Akun / Entitas" 
                placeholder="Contoh: UPT Kedaton"
                value={name}
                onChange={(e: any) => { setName(e.target.value); if(loginError) setLoginError(null); }}
                icon={<Building2 className="w-4 h-4" />}
                required
              />
            )}
            <Input 
              label="Username Akun" 
              placeholder="Contoh: bidangps atau unit01"
              value={email}
              onChange={(e: any) => { setEmail(e.target.value); if(loginError) setLoginError(null); }}
              icon={<UserIcon className="w-4 h-4" />}
              required
            />
            <Input 
              label="Kata Sandi" 
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e: any) => { setPassword(e.target.value); if(loginError) setLoginError(null); }}
              icon={<Lock className="w-4 h-4" />}
              required
            />
            {isRegistering && (
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider -mt-2 ml-1">
                Minimal 6 karakter
              </p>
            )}

            <Button type="submit" disabled={loading} className="w-full h-12 mt-4 text-sm uppercase tracking-widest font-bold">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  {isRegistering ? "Registrasi" : "Masuk"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <button 
              onClick={() => { setIsRegistering(!isRegistering); setLoginError(null); }}
              className="text-[10px] font-bold text-slate-500 hover:text-emerald-500 uppercase tracking-widest transition-colors"
            >
              {isRegistering ? "Sudah punya akun? Login di sini" : "Personil Baru? Registrasi Akun"}
            </button>
          </div>
        </Card>

        <p className="mt-8 text-center text-[10px] text-slate-700 font-mono tracking-[0.3em] uppercase">
          &copy; {new Date().getFullYear()} {APP_ORG_SHORT}
        </p>
      </motion.div>
    </div>
  );
}
