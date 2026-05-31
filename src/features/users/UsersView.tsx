import React, { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, 
  X, 
  Loader2, 
  Eye, 
  EyeOff, 
  ChevronDown 
} from "lucide-react";
import { doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "../../lib/firebase";
import { UserProfile, UserRole } from "../../types";
import { UsersViewProps } from "./userTypes";
import { getStatusLabelAndStyles } from "./userUtils";
import { 
  STATUS_OPTIONS_PENDING, 
  STATUS_OPTIONS_DEFAULT, 
  ROLE_OPTIONS_CO_ADMIN, 
  ROLE_OPTIONS_ADMIN 
} from "./userConstants";

// Reusable micro-components inside the features/users context to avoid circular dependency
const Badge = ({ children, variant = "default" }: any) => {
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

const Card = ({ children, className = "", ...props }: any) => (
  <div {...props} className={`bg-slate-900 rounded-2xl border border-slate-800 shadow-xl ${className}`}>
    {children}
  </div>
);

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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export function UsersView({ 
  users, 
  profile, 
  onNotify, 
  upts, 
  onResetPasswordSuccess,
  logActivity 
}: UsersViewProps) {
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const pendingCount = users.filter((u: any) => u.status === 'pending').length;

  const filteredUsers = useMemo(() => {
    return users.filter((u: any) => {
      const matchSearch = 
        (u.username || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.account_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.operator_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.assigned_upt_name || u.uptName || "").toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus = 
        statusFilter === 'all' || 
        u.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [users, searchTerm, statusFilter]);

  const handleResetPassword = async (u: UserProfile) => {
    // Generate an 8-character temporary password
    const tempPassword = Math.random().toString(36).slice(-8).toUpperCase();
    
    setLoading(true);
    try {
      // 1. Mark in Firestore that this user MUST change password
      const userRef = doc(db, "users", u.userId);
      await updateDoc(userRef, {
        force_password_change: true
      });

      // Log: Admin reset password
      logActivity(
        'perubahan_data', 
        'reset_password_user', 
        'Manajemen User', 
        `Admin mereset password user: ${u.username}`,
        {
          recordId: u.userId,
          recordLabel: u.username,
          profile
        }
      );

      // Trigger the success modal in App component
      if (onResetPasswordSuccess) {
        onResetPasswordSuccess({ tempPassword, username: u.username });
      }
      
      onNotify('success', `Password ${u.username} berhasil di-reset`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${u.userId}`);
      onNotify('error', 'Gagal mereset password');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const selectedUptId = formData.get("assigned_upt_id") as string;
    const selectedUpt = upts.find((u: any) => u.id === selectedUptId);
    const assignedRole = formData.get("role") as UserRole;
    const assignedStatus = formData.get("status") as string;

    if (!assignedRole) {
      onNotify('error', 'Role akun harus dipilih.');
      setLoading(false);
      return;
    }

    if (assignedRole === 'user' && !selectedUptId) {
      onNotify('error', 'Penempatan UPT wajib dipilih untuk role user.');
      setLoading(false);
      return;
    }

    if (profile?.role === 'co-admin') {
      if (assignedRole === 'admin' || assignedRole === 'co-admin') {
        onNotify('error', 'Co-admin tidak diizinkan menetapkan peran Admin/Co-Admin.');
        setLoading(false);
        return;
      }
    }

    const data: any = {
      account_name: formData.get("account_name") as string,
      operator_name: formData.get("operator_name") as string,
      role: assignedRole,
      assigned_upt_id: selectedUptId || "",
      assigned_upt_name: selectedUpt?.nama_upt || selectedUpt?.name || "",
      status: assignedStatus,
      username: isEditing?.username || "",
      // Legacy compatibility (optional but safe)
      name: formData.get("account_name") as string,
      upt: formData.get("account_name") as string,
      uptName: selectedUpt?.nama_upt || selectedUpt?.name || "",
      uptId: selectedUptId || "",
    };

    // Auto-activate to active status if status is still pending but they are given user or active admin roles
    if (data.status === 'pending' && (data.role === 'user' || data.role === 'admin' || data.role === 'co-admin' || data.role === 'operator_bakung')) {
      data.status = 'active';
    }

    try {
      if (isEditing) {
        const isActivating = isEditing.status === 'pending' && data.status !== 'pending';

        const finalData = {
          ...data,
          email: isEditing.email,
          userId: isEditing.userId,
          updatedAt: serverTimestamp()
        };
        const userRef = doc(db, "users", isEditing.userId);
        await updateDoc(userRef, finalData);

        // Log Activity: User Activation or Update
        logActivity(
          'perubahan_data', 
          isActivating ? 'activate_user' : 'edit_user', 
          'Manajemen User', 
          isActivating
            ? `Mengaktifkan akun user: ${isEditing.username} sebagai ${assignedRole} di ${finalData.assigned_upt_name || "Kantor Pusat"}`
            : `Pembaruan profil/akses user: ${isEditing.username}`,
          {
            recordId: isEditing.userId,
            recordLabel: isEditing.username,
            beforeData: isEditing,
            afterData: finalData,
            profile
          }
        );

        onNotify('success', isActivating ? 'Akun berhasil diaktifkan' : 'User berhasil diperbarui');
      }
      setShowModal(false);
      setIsEditing(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${isEditing?.userId}`);
      onNotify('error', 'Gagal memproses perubahan user');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (auth.currentUser?.uid === userId) {
      onNotify('error', 'Anda tidak dapat menghapus akun Anda sendiri');
      return;
    }
    
    try {
      const userToDelete = users.find((u: any) => u.userId === userId);
      await deleteDoc(doc(db, "users", userId));

      // Log Activity: User Delete
      logActivity(
        'perubahan_data', 
        'hapus_user', 
        'Manajemen User', 
        `Penghapusan akun user: ${userToDelete?.username || userId}`,
        {
          recordId: userId,
          recordLabel: userToDelete?.username || userId,
          beforeData: userToDelete,
          profile
        }
      );

      onNotify('success', 'Profil user berhasil dihapus');
      setConfirmDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
      onNotify('error', 'Gagal menghapus user');
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white tracking-tight">Manajemen User</h2>
            <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{users.length} Data</span>
          </div>
          <p className="text-slate-500 text-sm">Kelola akses, peran, dan aktivasi penugasan personil.</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between bg-slate-900/40 p-4 rounded-xl border border-slate-800/60">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input 
            type="text"
            placeholder="Cari username, nama akun, operator..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.currentTarget.value)}
            className="w-full bg-slate-950 border border-slate-850 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-colors shadow-inner"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { value: "all", label: "Semua" },
            { value: "pending", label: "Menunggu Aktivasi", count: pendingCount },
            { value: "active", label: "Aktif" },
            { value: "inactive", label: "Non-Aktif" },
            { value: "rejected", label: "Ditolak" }
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => setStatusFilter(item.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${
                statusFilter === item.value
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-400/30 shadow-lg shadow-emerald-500/5"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {item.label}
              {item.count !== undefined && item.count > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-500 text-[8px] font-mono leading-none">
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden bg-slate-900 border-slate-800 relative">
        <div className="overflow-x-auto custom-scrollbar-horizontal pb-2">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="bg-slate-950/50 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Username</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Peran</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">UPT Tugas</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nama Akun</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Operator</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-500 text-xs">
                    Tidak ada akun pengguna yang ditemukan.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u: any) => {
                  const statusInfo = getStatusLabelAndStyles(u.status);
                  const isCurrentUser = auth.currentUser?.uid === u.userId;
                  return (
                    <tr key={u.userId} className="hover:bg-slate-800/30 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="text-xs font-mono text-blue-400 bg-blue-400/10 px-2 py-1 rounded border border-blue-400/20">{u.username || "-"}</span>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={u.role}>{u.role}</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-slate-300 whitespace-nowrap">
                          {u.role === 'admin' || u.role === 'co-admin' ? "Pusat / Semua" : (u.assigned_upt_name || u.uptName || "Belum ditugaskan")}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-emerald-500 uppercase whitespace-nowrap">{u.account_name || u.upt || "-"}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-white text-sm whitespace-nowrap">{u.operator_name || u.name || "-"}</p>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={statusInfo.badge}>{statusInfo.label}</Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-4">
                          {confirmDelete === u.userId ? (
                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                              <span className="text-[10px] font-bold text-rose-500 uppercase tracking-tight">Hapus?</span>
                              <button onClick={() => handleDelete(u.userId)} className="text-rose-500 hover:text-rose-400 text-xs font-bold underline">Ya</button>
                              <button onClick={() => setConfirmDelete(null)} className="text-slate-500 hover:text-slate-300 text-xs font-bold underline">Batal</button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-4 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                              {u.status === 'pending' ? (
                                <button 
                                  onClick={() => { setIsEditing(u); setShowModal(true); }} 
                                  className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white px-3 py-1 text-[11px] font-bold rounded border border-emerald-500/20 shadow-sm transition-all animate-bounce"
                                >
                                  Aktivasi Akun
                                </button>
                              ) : (
                                (profile?.role === 'admin' || (profile?.role === 'co-admin' && u.role !== 'admin' && u.role !== 'co-admin')) && (
                                  <button onClick={() => { setIsEditing(u); setShowModal(true); }} className="text-slate-500 hover:text-blue-400 text-xs font-bold underline transition-colors">
                                    Edit Akses
                                  </button>
                                )
                              )}
                              {profile?.role === 'admin' && (
                                <button 
                                  onClick={() => {
                                    if (window.confirm(`Reset password untuk ${u.username}? User akan dipaksa ganti password pada login berikutnya.`)) {
                                      handleResetPassword(u);
                                    }
                                  }} 
                                  className="text-slate-500 hover:text-amber-500 text-xs font-bold underline transition-colors"
                                >
                                  Reset Password
                                </button>
                              )}
                              {profile?.role === 'admin' && !isCurrentUser && (
                                <button onClick={() => setConfirmDelete(u.userId)} className="text-slate-500 hover:text-rose-500 text-xs font-bold underline transition-colors">
                                  Hapus User
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="bg-slate-900 rounded-2xl w-full max-w-md p-8 shadow-2xl border border-slate-800"
          >
            <h3 className="text-xl font-bold text-white tracking-tight mb-2">
              {isEditing?.status === 'pending' ? "Aktivasi Akun" : "Kelola Akun Personil"}
            </h3>
            {isEditing?.status === 'pending' && (
              <p className="text-slate-400 text-xs mb-6 leading-relaxed">
                Tentukan role dan penempatan akun sebelum pengguna dapat mengakses fitur aplikasi secara penuh.
              </p>
            )}
            <form onSubmit={handleSubmit} className="flex flex-col gap-6 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input 
                  label="Akun Username" 
                  name="username" 
                  required 
                  defaultValue={isEditing?.username} 
                  placeholder="Contoh: kdmndlh" 
                  disabled
                  className="bg-slate-800/50 opacity-60 cursor-not-allowed text-slate-400 font-mono" 
                />
                <Select 
                  label="Status Akun" 
                  name="status" 
                  required 
                  defaultValue={isEditing?.status || 'active'}
                  options={isEditing?.status === 'pending' ? STATUS_OPTIONS_PENDING : STATUS_OPTIONS_DEFAULT}
                  disabled={profile?.role === 'co-admin' && isEditing?.status !== 'pending'}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input 
                  label="Nama Akun / Entitas" 
                  name="account_name" 
                  required 
                  defaultValue={isEditing?.account_name || isEditing?.upt} 
                  placeholder="Contoh: UPT Kedaton" 
                  disabled={profile?.role === 'co-admin'}
                />
                <Input label="Nama Operator" name="operator_name" defaultValue={isEditing?.operator_name || isEditing?.name} placeholder="Contoh: Desi" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select 
                  label={isEditing?.status === 'pending' ? "Role Akun" : "Peran / Akses"} 
                  name="role" 
                  required 
                  defaultValue={isEditing?.role || 'viewer'}
                  options={profile?.role === 'co-admin' ? ROLE_OPTIONS_CO_ADMIN : ROLE_OPTIONS_ADMIN} 
                  disabled={profile?.role === 'co-admin' && isEditing?.status !== 'pending'}
                />
                <Select 
                  label={isEditing?.status === 'pending' ? "Penempatan UPT" : "Penugasan UPT"} 
                  name="assigned_upt_id" 
                  defaultValue={isEditing?.assigned_upt_id || isEditing?.uptId}
                  options={[
                    { 
                      label: (isEditing?.role === 'admin' || isEditing?.role === 'co-admin') 
                        ? "Admin Pusat (Tanpa Wilayah)" 
                        : "Belum ditugaskan", 
                      value: "" 
                    },
                    ...upts.map((u: any) => ({ label: u.nama_upt || u.name, value: u.id }))
                  ]} 
                  disabled={profile?.role === 'co-admin' && isEditing?.role !== 'user' && isEditing?.role !== 'viewer' && isEditing?.status !== 'pending'}
                />
              </div>

              <div className="flex gap-4 pt-6 border-t border-slate-800">
                <Button variant="secondary" className="flex-1" onClick={() => { setShowModal(false); setIsEditing(null); }}>
                  Batal
                </Button>
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    isEditing?.status === 'pending' ? "Aktifkan Akun" : "Simpan Perubahan"
                  )}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
