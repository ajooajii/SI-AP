import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  BarChart3, 
  Truck, 
  ClipboardList, 
  Database, 
  ChevronUp, 
  ChevronDown, 
  Building2, 
  UserRound, 
  MapPin, 
  Layers, 
  Users, 
  Download, 
  FileSpreadsheet, 
  History,
  X 
} from "lucide-react";
import { NavItem } from "./NavItem";
import { Logo } from "./Logo";
import { UserProfile } from "../../types";
import { APP_NAME, APP_FULL_NAME, APP_ORG_SHORT } from "../../constants";

interface MobileNavigationProps {
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  profile: UserProfile | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  dbExpanded: boolean;
  setDbExpanded: (expanded: boolean) => void;
  settings: any;
}

export function MobileNavigation({
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  profile,
  activeTab,
  setActiveTab,
  dbExpanded,
  setDbExpanded,
  settings
}: MobileNavigationProps) {
  const navigateTo = (tab: string) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <AnimatePresence>
      {isMobileMenuOpen && (
        <>
          {/* Overlay */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-x-0 bottom-0 top-20 z-40 bg-slate-950/40 backdrop-blur-sm md:hidden"
          />
          {/* Mobile Sidebar */}
          <motion.aside 
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-20 left-0 bottom-0 z-50 w-72 bg-slate-900 border-r border-slate-800 p-0 flex flex-col md:hidden shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4 p-6 pb-2">
              <div className="flex items-center gap-3">
                <Logo size="sm" className="shadow-lg shadow-emerald-900/20" />
                <div>
                  <h1 className="font-bold text-emerald-500 leading-tight tracking-tight text-sm">{APP_NAME}</h1>
                  <p className="text-[10px] text-slate-400 font-bold leading-tight">{APP_FULL_NAME}</p>
                  <p className="text-[8px] text-slate-500 font-mono tracking-widest uppercase">{APP_ORG_SHORT}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsMobileMenuOpen(false)} 
                className="text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 flex flex-col gap-2 p-6 pt-2 overflow-y-auto custom-scrollbar">
              {profile?.role !== "operator_bakung" && (
                <>
                  <NavItem 
                    active={activeTab === "dashboard"} 
                    onClick={() => navigateTo("dashboard")} 
                    icon={<BarChart3 />} 
                    label="Dashboard" 
                  />
                  <NavItem 
                    active={activeTab === "input-ritase"} 
                    onClick={() => navigateTo("input-ritase")} 
                    icon={<Truck />} 
                    label="Input Ritase" 
                  />
                  <NavItem 
                    active={activeTab === "trips"} 
                    onClick={() => navigateTo("trips")} 
                    icon={<ClipboardList />} 
                    label="Data Ritase" 
                  />
                  
                  <div className="mt-4 mb-2">
                    <button 
                      onClick={() => setDbExpanded(!dbExpanded)}
                      className="w-full flex items-center justify-between px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-slate-300 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Database className="w-3 h-3" />
                        Master Database
                      </div>
                      {dbExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    <AnimatePresence>
                      {dbExpanded && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden flex flex-col gap-1 mt-1 pl-2"
                        >
                          <NavItem 
                            active={activeTab === "vehicles"} 
                            onClick={() => navigateTo("vehicles")} 
                            icon={<Truck />} 
                            label="Kendaraan" 
                            isSub 
                          />
                          <NavItem 
                            active={activeTab === "drivers"} 
                            onClick={() => navigateTo("drivers")} 
                            icon={<UserRound />} 
                            label="Personil" 
                            isSub 
                          />
                          <NavItem 
                            active={activeTab === "upt-master"} 
                            onClick={() => navigateTo("upt-master")} 
                            icon={<Building2 />} 
                            label="UPT" 
                            isSub 
                          />
                          <NavItem 
                            active={activeTab === "tpa"} 
                            onClick={() => navigateTo("tpa")} 
                            icon={<MapPin />} 
                            label="TPA/TPS" 
                            isSub 
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              )}

              {(profile?.role === "admin" || profile?.role === "co-admin" || profile?.role === "operator_bakung") && (
                <NavItem 
                  active={activeTab === "bakung"} 
                  onClick={() => navigateTo("bakung")} 
                  icon={<Layers />} 
                  label="Bakung" 
                />
              )}

              {profile?.role !== "operator_bakung" && (
                <>
                  {(profile?.role === "admin" || profile?.role === "co-admin") && (
                    <NavItem 
                      active={activeTab === "users"} 
                      onClick={() => navigateTo("users")} 
                      icon={<Users />} 
                      label="Manajemen User" 
                    />
                  )}
                  
                  {profile?.role === "admin" && (
                    <NavItem 
                      active={activeTab === "export-center"} 
                      onClick={() => navigateTo("export-center")} 
                      icon={<Download />} 
                      label="Pusat Ekspor" 
                    />
                  )}
                  
                  {(profile?.role === "admin" || (profile?.role === "co-admin" && settings?.showReportsForCoAdmin === true)) && (
                    <NavItem 
                      active={activeTab === "reports"} 
                      onClick={() => navigateTo("reports")} 
                      icon={<FileSpreadsheet />} 
                      label="Laporan" 
                    />
                  )}
                  
                  {profile?.role === "admin" && (
                    <NavItem 
                      active={activeTab === "activity-log"} 
                      onClick={() => navigateTo("activity-log")} 
                      icon={<History />} 
                      label="Log Aktivitas" 
                    />
                  )}
                  
                  {profile?.role === "admin" && (
                    <NavItem 
                      active={activeTab === "settings"} 
                      onClick={() => navigateTo("settings")} 
                      icon={<Database />} 
                      label="Pengaturan" 
                    />
                  )}
                </>
              )}
            </nav>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
