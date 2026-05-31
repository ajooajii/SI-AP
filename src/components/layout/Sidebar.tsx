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
  History 
} from "lucide-react";
import { NavItem } from "./NavItem";
import { UserProfile } from "../../types";

interface SidebarProps {
  profile: UserProfile | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  dbExpanded: boolean;
  setDbExpanded: (expanded: boolean) => void;
  settings: any;
}

export function Sidebar({
  profile,
  activeTab,
  setActiveTab,
  dbExpanded,
  setDbExpanded,
  settings
}: SidebarProps) {
  return (
    <aside className="hidden md:flex w-72 flex-col border-r border-slate-800 bg-slate-900 sticky top-20 h-[calc(100vh-80px)] p-6 z-30">
      <nav className="flex-1 flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-2">
        {profile?.role !== "operator_bakung" && (
          <>
            <NavItem 
              active={activeTab === "dashboard"} 
              onClick={() => setActiveTab("dashboard")} 
              icon={<BarChart3 />} 
              label="Dashboard" 
            />
            <NavItem 
              active={activeTab === "input-ritase"} 
              onClick={() => setActiveTab("input-ritase")} 
              icon={<Truck />} 
              label="Input Ritase" 
            />
            <NavItem 
              active={activeTab === "trips"} 
              onClick={() => setActiveTab("trips")} 
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
                      onClick={() => setActiveTab("vehicles")} 
                      icon={<Truck />} 
                      label="Kendaraan" 
                      isSub 
                    />
                    <NavItem 
                      active={activeTab === "drivers"} 
                      onClick={() => setActiveTab("drivers")} 
                      icon={<UserRound />} 
                      label="Personil" 
                      isSub 
                    />
                    <NavItem 
                      active={activeTab === "upt-master"} 
                      onClick={() => setActiveTab("upt-master")} 
                      icon={<Building2 />} 
                      label="UPT" 
                      isSub 
                    />
                    <NavItem 
                      active={activeTab === "tpa"} 
                      onClick={() => setActiveTab("tpa")} 
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
            onClick={() => setActiveTab("bakung")} 
            icon={<Layers />} 
            label="Bakung" 
          />
        )}

        {profile?.role !== "operator_bakung" && (
          <>
            {(profile?.role === "admin" || profile?.role === "co-admin") && (
              <NavItem 
                active={activeTab === "users"} 
                onClick={() => setActiveTab("users")} 
                icon={<Users />} 
                label="Manajemen User" 
              />
            )}

            {profile?.role === "admin" && (
              <NavItem 
                active={activeTab === "export-center"} 
                onClick={() => setActiveTab("export-center")} 
                icon={<Download />} 
                label="Pusat Ekspor" 
              />
            )}

            {(profile?.role === "admin" || (profile?.role === "co-admin" && settings?.showReportsForCoAdmin === true)) && (
              <NavItem 
                active={activeTab === "reports"} 
                onClick={() => setActiveTab("reports")} 
                icon={<FileSpreadsheet />} 
                label="Laporan" 
              />
            )}

            {profile?.role === "admin" && (
              <NavItem 
                active={activeTab === "activity-log"} 
                onClick={() => setActiveTab("activity-log")} 
                icon={<History />} 
                label="Log Aktivitas" 
              />
            )}

            {profile?.role === "admin" && (
              <NavItem 
                active={activeTab === "settings"} 
                onClick={() => setActiveTab("settings")} 
                icon={<Database />} 
                label="Pengaturan" 
              />
            )}
          </>
        )}
      </nav>
    </aside>
  );
}
