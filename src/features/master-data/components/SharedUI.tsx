import React, { useState, useEffect, useRef } from "react";
import { Eye, EyeOff, ChevronDown, Search, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export const Button = ({ children, onClick, variant = "primary", className = "", disabled = false, type = "button" }: any) => {
  const base = "px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm";
  const variants: any = {
    primary: "bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-900/20",
    secondary: "bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700",
    danger: "bg-red-950/30 text-red-400 border border-red-900/50 hover:bg-red-900/40",
    ghost: "text-slate-400 hover:bg-slate-800"
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

export const Input = ({ label, icon, type, error, showError: propsShowError, ...props }: any) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isTouched, setIsTouched] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (showPassword ? "text" : "password") : type;
  const isRequired = props.required;
  
  const value = props.value !== undefined ? props.value : (props.defaultValue || "");
  const isEmpty = typeof value === 'string' ? !value.trim() : (value === null || value === undefined);
  const showError = propsShowError || (isRequired && isTouched && isEmpty) || error;

  return (
    <div className="flex flex-col gap-1 w-full relative">
      {label && (
        <div className="flex items-center justify-between ml-1 mb-0.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
            {label}
            {isRequired && <span className="text-rose-500 font-bold">*</span>}
          </label>
        </div>
      )}
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{icon}</div>}
        <input
          {...props}
          type={inputType}
          onBlur={(e) => {
            setIsTouched(true);
            if (props.onBlur) props.onBlur(e);
          }}
          onFocus={(e) => {
            if (props.type === "number" || props.type === "text") {
              e.target.select();
            }
            if (props.onFocus) props.onFocus(e);
          }}
          className={`w-full px-3 py-2 bg-slate-950 border rounded-lg text-slate-200 text-base md:text-sm placeholder:text-slate-700 focus:outline-none focus:ring-2 transition-all ${
            showError 
              ? 'border-rose-500/50 focus:ring-rose-500/20 focus:border-rose-500' 
              : 'border-slate-800 focus:ring-emerald-500/30 focus:border-emerald-500/50'
          } ${icon ? 'pl-10' : ''} ${isPassword ? 'pr-10' : ''} ${props.className || ''}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {showError && (
        <div className="ml-1 animate-in fade-in slide-in-from-top-1 duration-200">
          <span className="text-[9px] font-semibold text-rose-500 italic lowercase tracking-tight">
            {error || "Wajib diisi"}
          </span>
        </div>
      )}
    </div>
  );
};

export const Select = ({ label, options, value: propsValue, onChange, placeholder, name, required, disabled, defaultValue, error, showError: propsShowError }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isTouched, setIsTouched] = useState(false);
  const [search, setSearch] = useState("");
  const [internalValue, setInternalValue] = useState(defaultValue || "");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const value = propsValue !== undefined ? propsValue : internalValue;
  const isEmpty = value === "" || value === null || value === undefined;
  const showError = propsShowError || (required && isTouched && isEmpty) || error;

  const filteredOptions = options.filter((opt: any) => {
    const labelText = (typeof opt === 'object' ? (opt.label || opt.value || "") : opt).toString().toLowerCase();
    return labelText.includes(search.toLowerCase());
  });

  useEffect(() => {
    setActiveIndex(0);
  }, [search, isOpen]);

  const selectedOption = options.find((opt: any) => {
    const val = typeof opt === 'object' ? opt.value : opt;
    return val === value;
  });
  const displayLabel = selectedOption ? (typeof selectedOption === 'object' ? selectedOption.label : selectedOption) : "";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (isOpen) setIsTouched(true);
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleSelect = (opt: any) => {
    const val = typeof opt === 'object' ? (opt.value !== undefined ? opt.value : opt) : opt;
    if (propsValue === undefined) {
      setInternalValue(val);
    }
    if (onChange) {
      onChange({ target: { value: val, name } });
    }
    setIsTouched(true);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div className={`flex flex-col gap-1 w-full relative ${disabled ? 'opacity-50 pointer-events-none' : ''}`} ref={containerRef}>
      {label && (
        <div className="flex items-center justify-between ml-1 mb-0.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
            {label}
            {required && <span className="text-rose-500 font-bold">*</span>}
          </label>
        </div>
      )}
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`px-3 py-2 bg-slate-950 border rounded-lg text-slate-200 focus-within:ring-2 transition-all cursor-pointer flex items-center justify-between ${
          showError 
            ? 'border-rose-500/50 focus-within:ring-rose-500/20 focus-within:border-rose-500' 
            : 'border-slate-800 focus-within:ring-emerald-500/50 focus-within:border-emerald-500/50'
        }`}
      >
        <span className={displayLabel ? "text-slate-200 text-xs sm:text-sm" : "text-slate-600 text-xs sm:text-sm"}>
          {displayLabel || placeholder || "Pilih..."}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      <input type="hidden" name={name} value={value} required={required} />

      {showError && (
        <div className="ml-1 animate-in fade-in slide-in-from-top-1 duration-200">
          <span className="text-[9px] font-semibold text-rose-500 italic lowercase tracking-tight">
            {error || "Wajib diisi"}
          </span>
        </div>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 z-50 mt-2 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="p-2 border-b border-slate-800 bg-slate-950/50 flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-500" />
              <input 
                autoFocus
                className="bg-transparent border-none outline-none text-base md:text-sm text-slate-200 w-full"
                placeholder="Cari..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActiveIndex(prev => (filteredOptions.length > 0 ? (prev + 1) % filteredOptions.length : 0));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActiveIndex(prev => (filteredOptions.length > 0 ? (prev - 1 + filteredOptions.length) % filteredOptions.length : 0));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (filteredOptions.length > 0) {
                      handleSelect(filteredOptions[activeIndex]);
                    }
                  } else if (e.key === 'Escape') {
                    setIsOpen(false);
                  }
                }}
              />
            </div>
            <div className="max-h-60 overflow-y-auto">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt: any, idx: number) => {
                  const val = typeof opt === 'object' ? opt.value : opt;
                  const label = typeof opt === 'object' ? opt.label : opt;
                  const isActive = idx === activeIndex;
                  return (
                     <button
                       key={`${val}-${idx}`}
                       type="button"
                       onClick={() => handleSelect(opt)}
                       onMouseEnter={() => setActiveIndex(idx)}
                       className={`w-full text-left px-4 py-2 text-xs sm:text-sm transition-colors ${
                         isActive ? 'bg-emerald-500/10 text-emerald-500' : 
                         val === value ? 'bg-emerald-500/20 text-emerald-500' : 'text-slate-400'
                       }`}
                     >
                       {label}
                     </button>
                  );
                })
              ) : (
                <div className="px-4 py-3 text-sm text-slate-600 text-center italic">Tidak ada hasil</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const Card = ({ children, className = "", ...props }: any) => (
  <div {...props} className={`bg-slate-900 rounded-2xl border border-slate-800 shadow-xl ${className}`}>
    {children}
  </div>
);

export const Badge = ({ children, variant = "default" }: any) => {
  const normalizedVariant = String(variant).toLowerCase().replace('-', '').replace('_', '');
  const variants: any = {
    default: "bg-slate-800 text-slate-400 border border-slate-700",
    admin: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
    coadmin: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    user: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    viewer: "bg-amber-500/10 text-amber-500 border border-amber-500/20",
    operatorbakung: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
    operator_bakung: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
    active: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
    pending: "bg-amber-500/10 text-amber-500 border border-amber-500/20",
    inactive: "bg-red-500/10 text-red-500 border-red-500/20",
    rejected: "bg-rose-500/10 text-rose-500 border border-rose-500/20"
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap ${variants[normalizedVariant] || variants.default}`}>
      {children}
    </span>
  );
};

export const Modal = ({ isOpen, onClose, title, children, maxWidth = "max-w-md" }: any) => {
  if (!isOpen) return null;
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className={`relative w-full ${maxWidth} bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col`}
        >
          {title && (
            <div className="p-6 border-b border-slate-800/80 bg-slate-950/30 flex items-center justify-between">
              <h3 className="text-base font-bold text-white tracking-wide uppercase">{title}</h3>
              <button 
                onClick={onClose}
                className="p-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all text-xs"
              >
                ✕
              </button>
            </div>
          )}
          <div className="p-6 overflow-y-auto max-h-[80vh] custom-scrollbar">
            {children}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
