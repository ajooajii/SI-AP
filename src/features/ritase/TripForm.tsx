import React, { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { 
  Unlock, 
  Lock, 
  AlertCircle, 
  Loader2, 
  Eye, 
  EyeOff, 
  ChevronDown,
  Search
} from "lucide-react";

// Micro-components inside features/ritase context to maintain clean styling and modularity
const Button = ({ children, onClick, variant = "primary", className = "", disabled = false, type = "button" }: any) => {
  const base = "px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
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

const Input = ({ label, icon, type, error, showError: propsShowError, ...props }: any) => {
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

const Select = ({ label, options, value: propsValue, onChange, placeholder, name, required, disabled, defaultValue, error, showError: propsShowError }: any) => {
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
    <div className={`flex flex-col gap-1 w-full relative ${disabled ? 'opacity-55 pointer-events-none' : ''}`} ref={containerRef}>
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
        <span className={displayLabel ? "text-slate-200" : "text-slate-600"}>
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

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
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
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
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
        </div>
      )}
    </div>
  );
};

export function TripForm({ initialData, onSubmit, onCancel, loading, upts, tpas, settings, profile, drivers, vehicles, trips, onNotify }: any) {
  const [tonnageKg, setTonnageKg] = useState(initialData?.tonnage || 0);
  const [volume, setVolume] = useState(initialData?.volume || 0);
  const [selectedUpt, setSelectedUpt] = useState(initialData?.upt || (profile?.assigned_upt_name || profile?.uptName || profile?.upt || (upts.length > 0 ? upts[0].name : "")));
  const [tonnageWarning, setTonnageWarning] = useState("");

  useEffect(() => {
    if (profile?.role === 'user' && !initialData) {
      setSelectedUpt(profile?.assigned_upt_name || profile?.uptName || profile?.upt || "");
    }
  }, [profile, initialData]);
  const [selectedDate, setSelectedDate] = useState(initialData?.date || format(new Date(), 'yyyy-MM-dd'));

  const mainTpa = tpas.find((t: any) => t.id === settings?.mainTpaId);
  const isLocked = settings?.isTpaLocked;

  const defaultTpaName = initialData?.tpa || mainTpa?.name || (tpas.length > 0 ? tpas[0].name : "");

  const [formData, setFormData] = useState({
    driverName: initialData?.driverName || "",
    vehiclePlate: initialData?.vehiclePlate || "",
    tpa: initialData?.tpa || defaultTpaName,
    keterangan: initialData?.keterangan || ""
  });

  const [showAllDrivers, setShowAllDrivers] = useState(false);
  const [showAllVehicles, setShowAllVehicles] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        driverName: initialData.driverName || "",
        vehiclePlate: initialData.vehiclePlate || "",
        tpa: initialData.tpa || defaultTpaName,
        keterangan: initialData.keterangan || ""
      });
      setTonnageKg(initialData.tonnage || 0);
      setVolume(initialData.volume || 0);
      setSelectedUpt(initialData.upt || (profile?.assigned_upt_name || profile?.uptName || profile?.upt || (upts.length > 0 ? upts[0].name : "")));
      setSelectedDate(initialData.date);
    }
  }, [initialData]);

  // Auto-populate tonnage based on ritase configuration with circular logic
  useEffect(() => {
    if (!formData.vehiclePlate || !selectedDate || !formData.driverName || initialData) {
      setTonnageWarning("");
      return;
    }
    
    // Group by vehicle, driver, and UPT as requested
    const dailyTrips = trips.filter((t: any) => 
      t.vehiclePlate === formData.vehiclePlate && 
      t.date === selectedDate &&
      t.driverName === formData.driverName &&
      t.upt === selectedUpt
    );
    
    const nextRitNum = dailyTrips.length + 1;
    const vehicle = vehicles.find((v: any) => v.plateNumber === formData.vehiclePlate);
    
    if (!vehicle || !vehicle.ritaseTonnage) {
      setTonnageWarning("Tonase default kendaraan belum tersedia. Periksa Database Kendaraan.");
      return;
    }

    // Resolve target configuration
    // Order: Vehicle's home UPTs -> "default" -> first numeric object -> legacy flat
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
      targetConfig = vehicle.ritaseTonnage["default"];
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

    if (!targetConfig || typeof targetConfig !== 'object' || Object.keys(targetConfig).length === 0) {
      setTonnageWarning("Tonase default kendaraan belum tersedia. Periksa Database Kendaraan.");
      return;
    }

    const ritaseKeys = Object.keys(targetConfig).map(Number).filter(k => !isNaN(k)).sort((a, b) => a - b);
    if (ritaseKeys.length > 0) {
      const circularIndex = (nextRitNum - 1) % ritaseKeys.length;
      const targetKey = ritaseKeys[circularIndex];
      const tonnage = (targetConfig as any)[targetKey];
      if (typeof tonnage === 'number') {
        handleKgChange(tonnage);
        setTonnageWarning("");
        return;
      }
    }
    
    setTonnageWarning("Tonase default kendaraan belum tersedia. Periksa Database Kendaraan.");
  }, [formData.vehiclePlate, formData.driverName, selectedDate, trips, vehicles, initialData, selectedUpt]);

  const [isFlexible, setIsFlexible] = useState(false);

  // Sync driver and vehicle
  const handleVehicleChange = (plate: string) => {
    setFormData(prev => ({
      ...prev,
      vehiclePlate: plate
    }));

    if (!isFlexible && plate) {
      const vehicle = vehicles.find((v: any) => v.plateNumber === plate);
      const matchingDrivers = drivers.filter((d: any) => 
        d.vehiclePlate === plate && 
        (d.upts?.includes(selectedUpt) || d.upt === selectedUpt)
      );
      
      let driverToSet = matchingDrivers.length === 1 ? matchingDrivers[0].name : (vehicle?.defaultDriverName || "");
      if (driverToSet) {
        setFormData(prev => ({ ...prev, driverName: driverToSet }));
      }
    }
  };

  const handleDriverChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      driverName: name
    }));

    if (!isFlexible && name) {
      const driver = drivers.find((d: any) => d.name === name);
      const assignedVehicle = vehicles.find((v: any) => 
        v.defaultDriverName === name && 
        (v.upts?.includes(selectedUpt) || v.upt === selectedUpt)
      );
      
      let vehicleToSet = driver?.vehiclePlate || (assignedVehicle?.plateNumber || "");
      if (vehicleToSet) {
        setFormData(prev => ({ ...prev, vehiclePlate: vehicleToSet }));
      }
    }
  };

  const handleKgChange = (kg: number) => {
    setTonnageKg(kg);
    // Auto sync volume: KG / 400 (using standard 0.4 density: Ton / 0.4 = Vol)
    // kg / 1000 / 0.4 = kg / 400
    const calculatedVol = parseFloat((kg / 400).toFixed(1));
    setVolume(calculatedVol);
  };

  const [submitAttempted, setSubmitAttempted] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitAttempted(true);
    const fData = new FormData(e.currentTarget);
    const vehiclePlate = formData.vehiclePlate;
    const vehicle = vehicles.find((v: any) => v.plateNumber === vehiclePlate);

    if (tonnageKg === 0 && tonnageWarning && !initialData) {
      if (onNotify) onNotify('error', tonnageWarning);
      return;
    }

    const data = {
      date: fData.get("date") as string,
      operationalTime: fData.get("operationalTime") as string,
      vehiclePlate: vehiclePlate,
      vehicleType: vehicle?.type || "Lainnya",
      driverName: formData.driverName,
      upt: selectedUpt,
      tpa: isLocked ? defaultTpaName : formData.tpa,
      tonnage: (tonnageKg || 0),
      volume: volume || 0,
      tripCount: 1, 
      keterangan: fData.get("keterangan") as string
    };
    onSubmit(data);
  };

  const filteredDrivers = (showAllDrivers || isFlexible) ? drivers : drivers.filter((d: any) => {
    if (selectedUpt === "") {
      return (!d.upts || d.upts.length === 0) && (!d.upt || !upts.some((u: any) => u.name === d.upt));
    }
    return d.upts?.includes(selectedUpt) || d.upt === selectedUpt;
  });
  
  const filteredVehicles = (showAllVehicles || isFlexible) ? vehicles : vehicles.filter((v: any) => {
    if (selectedUpt === "") {
      return (!v.upts || v.upts.length === 0) && (!v.upt || !upts.some((u: any) => u.name === v.upt));
    }
    return v.upts?.includes(selectedUpt) || v.upt === selectedUpt;
  });

  const isWeightEnabled = settings?.enableWeight !== false;
  const showWeightInForm = settings?.showWeightInForm !== false;
  const actualShowWeight = isWeightEnabled && showWeightInForm;
  const showVolume = settings?.showVolume !== false;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input 
          label="Tanggal Log" 
          type="date" 
          name="date" 
          required 
          showError={submitAttempted && !selectedDate}
          value={selectedDate}
          onChange={(e: any) => setSelectedDate(e.target.value)}
        />
        <Input 
          label="Jam Operasional" 
          type="time" 
          name="operationalTime" 
          required 
          showError={submitAttempted && !(initialData?.operationalTime || format(new Date(), 'HH:mm'))}
          defaultValue={initialData?.operationalTime || format(new Date(), 'HH:mm')} 
        />
      </div>
      
      <Select 
        label="Wilayah UPT" 
        name="upt" 
        options={[
          { label: "Tanpa UPT / Data Arsip", value: "" },
          ...upts.map((u: any) => ({ label: u.name, value: u.name }))
        ]} 
        required 
        showError={submitAttempted && selectedUpt === undefined}
        value={selectedUpt}
        onChange={(e: any) => setSelectedUpt(e.target.value)}
        disabled={profile?.role === 'user'}
      />

      {(profile?.role === 'admin' || profile?.role === 'co-admin' || profile?.role === 'user') && (
        <div className="flex items-center justify-between bg-slate-950/50 p-4 rounded-2xl border border-slate-800 shadow-inner group transition-all hover:bg-slate-950">
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isFlexible ? 'bg-orange-500/10 text-orange-500 ring-2 ring-orange-500/20 shadow-lg shadow-orange-500/10' : 'bg-emerald-500/10 text-emerald-500 ring-2 ring-emerald-500/20 shadow-lg shadow-emerald-500/10'}`}>
              {isFlexible ? <Unlock className="w-5 h-5 animate-pulse" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 leading-none mb-1">Status Sinkronisasi</p>
              <p className="text-sm font-bold text-white tracking-tight">{isFlexible ? "Mode Fleksibel" : "Mode Otomatis Terkunci"}</p>
              <p className="text-[10px] text-slate-500 font-medium">{isFlexible ? "Personil & Kendaraan bisa dipilih bebas (lintas UPT)" : "Kendaraan otomatis mengikuti personil & berdasarkan UPT"}</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={() => setIsFlexible(!isFlexible)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${isFlexible ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}
          >
            {isFlexible ? "Aktifkan Cerdas" : "Buka Fleksibel"}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Sopir</span>
            {(profile?.role === 'admin' || profile?.role === 'co-admin') && (
              <button 
                type="button"
                onClick={() => setShowAllDrivers(!showAllDrivers)}
                className={`text-[9px] px-2 py-0.5 rounded border transition-colors ${showAllDrivers ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-400'}`}
              >
                {showAllDrivers ? "Hanya UPT Terpilih" : "Tampilkan Semua UPT"}
              </button>
            )}
          </div>
          <Select 
            name="driverName" 
            required 
            value={formData.driverName}
            onChange={(e: any) => handleDriverChange(e.target.value)}
            options={filteredDrivers.map((d: any) => {
              const info = [];
              if (d.shift) info.push(d.shift);
              if (showAllDrivers && d.upt) info.push(d.upt);
              const labelSuffix = info.length > 0 ? ` (${info.join(' - ')})` : "";
              
              return {
                label: `${d.name}${labelSuffix}`,
                value: d.name
              };
            })}
            placeholder="Pilih Sopir"
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Kendaraan</span>
            {(profile?.role === 'admin' || profile?.role === 'co-admin') && (
              <button 
                type="button"
                onClick={() => setShowAllVehicles(!showAllVehicles)}
                className={`text-[9px] px-2 py-0.5 rounded border transition-colors ${showAllVehicles ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-400'}`}
              >
                {showAllVehicles ? "Hanya UPT Terpilih" : "Tampilkan Semua UPT"}
              </button>
            )}
          </div>
          <Select 
            name="vehiclePlate" 
            required 
            value={formData.vehiclePlate}
            onChange={(e: any) => handleVehicleChange(e.target.value)}
            options={filteredVehicles.map((v: any) => ({
              label: `${v.plateNumber} (${v.type})${showAllVehicles ? ` [${v.upt}]` : ''}`,
              value: v.plateNumber
            }))}
            placeholder="Pilih Plat Nomor"
          />
        </div>
      </div>

      <Select 
        label="Tujuan TPA" 
        name="tpa" 
        options={tpas.map((t: any) => t.name)} 
        required 
        value={isLocked ? defaultTpaName : (formData.tpa || defaultTpaName)}
        onChange={(e: any) => setFormData({...formData, tpa: e.target.value})}
        disabled={isLocked}
      />
      
      {(actualShowWeight || showVolume) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-950/50 rounded-xl border border-slate-800">
          {actualShowWeight && (
            <div className="flex flex-col gap-2">
              <Input 
                label="Tonase (KG)" 
                name="tonnageKg" 
                type="number" 
                required 
                value={tonnageKg}
                onChange={(e: any) => handleKgChange(parseFloat(e.target.value) || 0)} 
                className={tonnageWarning ? "border-amber-500" : ""}
              />
              {tonnageWarning && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <p className="text-[10px] font-bold text-amber-500 uppercase tracking-tight">{tonnageWarning}</p>
                </div>
              )}
            </div>
          )}
          {showVolume && (
            <Input 
              label="Volume (m³)" 
              name="volume" 
              type="number" 
              required 
              value={volume}
              onChange={(e: any) => setVolume(parseFloat(e.target.value) || 0)} 
            />
          )}
        </div>
      )}

      <Input 
        label="Keterangan (Opsional)" 
        name="keterangan" 
        placeholder="Tambahkan catatan jika diperlukan..."
        defaultValue={formData.keterangan}
      />
      
      <div className="flex gap-4 pt-6 border-t border-slate-800">
        {onCancel && <Button variant="secondary" className="flex-1" onClick={onCancel} type="button">Batal</Button>}
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (initialData ? "Perbarui Log" : "Simpan Log Ritase")}
        </Button>
      </div>
    </form>
  );
}
