import React from "react";

interface NavItemProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactElement;
  label: string;
  isSub?: boolean;
}

export function NavItem({ active, onClick, icon, label, isSub }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium w-full text-left ${
        active 
          ? "bg-emerald-600/10 text-emerald-400 shadow-sm border border-emerald-500/20" 
          : "text-slate-500 hover:bg-slate-800 hover:text-slate-200"
      } ${isSub ? "py-2 px-3 text-xs" : ""}`}
    >
      {React.cloneElement(icon, { className: isSub ? "w-4 h-4 shrink-0" : "w-5 h-5 shrink-0" })}
      <span className={isSub ? "text-xs truncate" : "text-sm truncate"}>{label}</span>
    </button>
  );
}
