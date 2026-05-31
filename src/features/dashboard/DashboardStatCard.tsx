import React from "react";
import { ArrowRight } from "lucide-react";
import { Card } from "../master-data/components/SharedUI";
import { StatsCardProps } from "./dashboardTypes";

export function DashboardStatCard({ label, value, subValue, icon, onClick }: StatsCardProps) {
  return (
    <Card 
      onClick={onClick}
      className={`p-4 sm:p-6 overflow-hidden relative group bg-slate-900 border-slate-800 transition-all ${onClick ? 'cursor-pointer hover:bg-slate-800/80 hover:border-emerald-500/30' : ''}`}
    >
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 group-hover:opacity-20 transition-all hidden sm:block">
        {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { size: 48 }) : icon}
      </div>
      <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 truncate">{label}</p>
      <div className="flex flex-col">
        <h3 className="text-xl sm:text-3xl font-light text-white truncate">{value}</h3>
        {subValue && <p className="text-[10px] sm:text-xs text-slate-500 mt-1 truncate">{subValue}</p>}
      </div>
      {onClick && (
        <div className="absolute bottom-2 right-3 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-1 text-[8px] font-bold text-emerald-500 uppercase tracking-tighter">
            <span className="hidden sm:inline">Klik untuk Ganti</span>
            <ArrowRight className="w-2 h-2" />
          </div>
        </div>
      )}
    </Card>
  );
}
