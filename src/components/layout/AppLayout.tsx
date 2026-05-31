import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Menu, 
  X, 
  User, 
  CheckCircle2, 
  Building2, 
  Truck, 
  UserRound, 
  Lock, 
  RefreshCw, 
  LogOut 
} from "lucide-react";
import { Sidebar } from "./Sidebar";
import { MobileNavigation } from "./MobileNavigation";
import { Logo } from "./Logo";
import { UserProfile } from "../../types";
import { 
  APP_NAME, 
  APP_VERSION, 
  APP_FULL_NAME, 
  APP_ORG, 
  APP_ORG_SHORT 
} from "../../constants";

// Badge Subcomponent for layout roles
const Badge = ({ variant, children, className = "" }: { variant: any, children: React.ReactNode, className?: string }) => {
  const styles: Record<string, string> = {
    admin: "bg-red-500/10 text-red-500 border-red-500/20",
    "co-admin": "bg-purple-500/10 text-purple-500 border-purple-500/20",
    user: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    operator_bakung: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    viewer: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
  };

  const currentStyle = styles[variant] || "bg-slate-500/10 text-slate-400 border-slate-500/20";

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border font-mono ${currentStyle} ${className}`}>
      {children}
    </span>
  );
};

interface AppLayoutProps {
  user: any;
  profile: UserProfile | null;
  vehicles: any[];
  drivers: any[];
  settings: any;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  isProfileOpen: boolean;
  setIsProfileOpen: (open: boolean) => void;
  dbExpanded: boolean;
  setDbExpanded: (expanded: boolean) => void;
  onShowChangePassword: () => void;
  onCheckUpdates: () => void;
  onSignOut: () => void;
  children: React.ReactNode;
}

export function AppLayout({
  user,
  profile,
  vehicles,
  drivers,
  settings,
  activeTab,
  setActiveTab,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  isProfileOpen,
  setIsProfileOpen,
  dbExpanded,
  setDbExpanded,
  onShowChangePassword,
  onCheckUpdates,
  onSignOut,
  children
}: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans text-slate-200">
      {/* Global Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-[60] h-20 shadow-xl shadow-slate-950/20">
        <div className="flex items-center gap-4">
          <Logo size="md" className="shadow-lg shadow-emerald-900/10 group overflow-hidden" />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-emerald-500 leading-tight tracking-tight text-xl">{APP_NAME}</h1>
              <Badge variant="user" className="hidden md:inline-flex text-[8px] px-1.5 py-0 h-4">{APP_VERSION}</Badge>
            </div>
            <div className="hidden md:block">
              <p className="text-[10px] text-slate-400 font-bold leading-tight uppercase tracking-wider">{APP_FULL_NAME}</p>
              <p className="text-[8px] text-slate-500 font-mono tracking-widest uppercase">{APP_ORG}</p>
            </div>
            <div className="md:hidden">
              <p className="text-[8px] text-slate-500 font-mono tracking-widest uppercase">{APP_ORG_SHORT}</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Mobile Toggle */}
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-slate-400 hover:text-white transition-colors bg-slate-800 rounded-lg border border-slate-700"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-3 pl-4 md:border-l border-slate-800 hover:bg-slate-800/40 p-2 rounded-xl transition-colors group"
            >
              <div className="hidden md:block text-right">
                <p className="text-[10px] font-bold text-white truncate max-w-[120px] group-hover:text-emerald-400 transition-colors">
                  {profile?.account_name || profile?.name || user?.displayName}
                </p>
                <div className="flex justify-end mt-0.5">
                  <Badge variant={profile?.role}>{profile?.role}</Badge>
                </div>
              </div>
              {user?.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt="" 
                  className="w-8 h-8 rounded-full ring-2 ring-emerald-500/20 group-hover:ring-emerald-500/50 transition-all referrer-no-referrer" 
                />
              ) : (
                <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center text-slate-500 border border-slate-700 group-hover:border-emerald-500/50 transition-all">
                  <User className="w-4 h-4" />
                </div>
              )}
            </button>

            <AnimatePresence>
              {isProfileOpen && (
                <>
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] bg-slate-950/20 backdrop-blur-[2px]" 
                    onClick={() => setIsProfileOpen(false)}
                  />
                  <motion.div
                    initial={{ x: "100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="fixed top-0 right-0 h-screen w-full sm:w-80 md:w-80 bg-slate-900 border-l border-slate-800 shadow-2xl p-4 sm:p-6 z-[110] flex flex-col overflow-x-hidden"
                  >
                    <div className="flex items-center justify-between mb-6 sm:mb-8">
                      <h3 className="text-xs sm:text-sm font-bold text-slate-500 underline decoration-emerald-500/50 underline-offset-4 uppercase tracking-widest">
                        Profil Pengguna
                      </h3>
                      <button 
                        onClick={() => setIsProfileOpen(false)} 
                        className="p-2 hover:bg-slate-800 rounded-full transition-colors"
                      >
                        <X className="w-5 h-5 text-slate-500" />
                      </button>
                    </div>

                    <div className="flex flex-col items-center text-center mb-6 sm:mb-8 p-4 sm:p-6 bg-slate-950 rounded-2xl border border-slate-800 shadow-inner group transition-all hover:border-emerald-500/20 w-full max-w-full overflow-hidden">
                      <div className="relative mb-4">
                        {user?.photoURL ? (
                          <img 
                            src={user.photoURL} 
                            alt="" 
                            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full ring-4 ring-emerald-500/20 shadow-xl referrer-no-referrer" 
                          />
                        ) : (
                          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-500 border border-slate-700 shadow-xl group-hover:border-emerald-500/30 transition-all">
                            <User className="w-8 h-8 sm:w-10 sm:h-10" />
                          </div>
                        )}
                        <div className="absolute -bottom-1 -right-1 p-1 bg-emerald-500 rounded-lg shadow-lg border-2 border-slate-950">
                          <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                        </div>
                      </div>
                      <h4 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-tight break-words w-full px-2">
                        {profile?.account_name || profile?.name || user?.displayName}
                      </h4>
                      <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-1 uppercase tracking-wider">
                        {profile?.operator_name || "Operator Lapangan"}
                      </p>
                      <div className="mt-2">
                        <Badge variant={profile?.role}>{profile?.role}</Badge>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-4">
                      <div className="flex items-center justify-center w-full">
                        <div className="w-full max-w-full p-3 bg-slate-950/50 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
                          <p className="text-[9px] sm:text-[10px] text-slate-600 font-bold uppercase tracking-widest shrink-0">Status Akun</p>
                          <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800 shrink-0">
                            <div className={`w-1.5 h-1.5 rounded-full ${profile?.status === "active" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"}`} />
                            <span className="text-[9px] sm:text-[10px] font-bold text-slate-300 capitalize">{profile?.status || "Active"}</span>
                          </div>
                        </div>
                      </div>

                      {profile?.role === "user" && (
                        <div className="w-full p-4 bg-slate-950/50 rounded-xl border border-slate-800 space-y-4">
                          <div>
                            <p className="text-[9px] sm:text-[10px] text-slate-600 font-bold uppercase tracking-widest mb-2">Penempatan Tugas</p>
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500 shrink-0">
                                <Building2 className="w-4 h-4" />
                              </div>
                              <p className="text-xs sm:text-sm font-bold text-slate-200 truncate">{profile?.assigned_upt_name || "Semua UPT"}</p>
                            </div>
                          </div>

                          <div className="h-px bg-slate-800" />

                          <div className="grid grid-cols-2 gap-3 sm:gap-4">
                            <div className="text-center p-2 rounded-lg bg-slate-900/40 border border-transparent hover:border-emerald-500/10 transition-colors">
                              <p className="text-[8px] sm:text-[9px] text-slate-600 font-bold uppercase tracking-widest mb-1.5">Armada</p>
                              <div className="flex items-center justify-center gap-1.5">
                                <Truck className="w-3 h-3 text-emerald-500/50" />
                                <p className="text-sm sm:text-base font-bold text-emerald-500 font-mono">
                                  {profile?.assigned_upt_name ? vehicles.filter((v: any) => v.upt === profile.assigned_upt_name || v.upts?.includes(profile.assigned_upt_name)).length : "-"}
                                </p>
                              </div>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-slate-900/40 border border-transparent hover:border-emerald-500/10 transition-colors">
                              <p className="text-[8px] sm:text-[9px] text-slate-600 font-bold uppercase tracking-widest mb-1.5">Personil</p>
                              <div className="flex items-center justify-center gap-1.5">
                                <UserRound className="w-3 h-3 text-emerald-500/50" />
                                <p className="text-sm sm:text-base font-bold text-emerald-500 font-mono">
                                  {profile?.assigned_upt_name ? drivers.filter((d: any) => d.upt === profile.assigned_upt_name || d.upts?.includes(profile.assigned_upt_name)).length : "-"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="w-full p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10 text-center">
                        <p className="text-[8px] sm:text-[9px] text-emerald-500/60 font-bold uppercase tracking-[0.2em] mb-1">Informasi</p>
                        <p className="text-[9px] sm:text-[10px] text-slate-500 leading-relaxed italic">Monitoring ritase pengangkutan sampah real-time Kota Bandar Lampung.</p>
                      </div>
                    </div>

                    <div className="mt-6 sm:mt-8 space-y-4 sm:space-y-6 pb-6 border-t border-slate-800/50 pt-6">
                      <button 
                        onClick={onShowChangePassword}
                        className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl transition-all font-bold text-[10px] sm:text-xs uppercase tracking-widest"
                      >
                        <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        GANTI PASSWORD
                      </button>

                      <button 
                        onClick={() => {
                          setIsProfileOpen(false);
                          onCheckUpdates();
                        }}
                        className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl transition-all font-bold text-[10px] sm:text-xs uppercase tracking-widest"
                      >
                        <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        Cek Pembaruan Aplikasi
                      </button>

                      <button 
                        onClick={onSignOut}
                        className="w-full flex items-center justify-center gap-3 px-6 py-3 sm:py-4 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/20 rounded-xl transition-all font-bold text-xs sm:text-sm shadow-lg shadow-rose-500/5 uppercase tracking-widest"
                      >
                        <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                        LOGOUT
                      </button>

                      <div className="flex flex-col items-center text-center space-y-1">
                        <h5 className="text-xl sm:text-2xl font-black text-emerald-500 tracking-tighter leading-none">{APP_NAME}</h5>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide leading-tight">{APP_FULL_NAME}</p>
                        <p className="text-[7px] text-slate-600 font-mono tracking-[0.2em] uppercase">{APP_ORG}</p>
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row relative">
        {/* Mobile Navigation Drawer */}
        <MobileNavigation
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          profile={profile}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          dbExpanded={dbExpanded}
          setDbExpanded={setDbExpanded}
          settings={settings}
        />

        {/* Desktop Sidebar */}
        <Sidebar
          profile={profile}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          dbExpanded={dbExpanded}
          setDbExpanded={setDbExpanded}
          settings={settings}
        />

        {/* Main Content Pane */}
        <main className="flex-1 px-4 py-6 md:px-10 md:py-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
