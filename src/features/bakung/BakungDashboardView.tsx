import React, { useState, useEffect, useRef } from "react";
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  where, 
  serverTimestamp 
} from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "../../lib/firebase";
import firebaseConfig from "../../../firebase-applet-config.json";
import { UserProfile } from "../../types";
import { 
  Calendar, 
  Filter, 
  Truck, 
  Weight, 
  Loader2, 
  ClipboardList, 
  ArrowLeft, 
  Check, 
  Plus, 
  ChevronDown 
} from "lucide-react";
import { format } from "date-fns";
import { 
  DEFAULT_EMPTY_WEIGHTS,
  VEHICLE_SOURCE_LABELS,
  VEHICLE_TYPE_LABELS,
  SOURCE_ORIGIN_LABELS 
} from "./bakungConstants";
import { mapVehicleType } from "./bakungUtils";
import { BakungDashboardViewProps } from "./bakungTypes";

export function BakungDashboardView({ 
  profile, 
  onNotify, 
  upts = [], 
  vehicles = [],
  logActivity 
}: BakungDashboardViewProps) {
  const [bakungSubView, setBakungSubView] = useState<"dashboard" | "input" | "data-hari-ini">("dashboard");
  const [bakungTrips, setBakungTrips] = useState<any[]>([]);
  const [bakungTripsMap, setBakungTripsMap] = useState<Record<string, any[]>>({});
  const [loadingData, setLoadingData] = useState(true);

  // Form State
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState(format(new Date(), 'HH:mm'));
  const [vehicleSourceType, setVehicleSourceType] = useState('dlh');
  const [vehicleType, setVehicleType] = useState('pickup');
  const [plateNumber, setPlateNumber] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [sourceOriginType, setSourceOriginType] = useState('upt');
  const [selectedUptId, setSelectedUptId] = useState('');
  const [selectedUptName, setSelectedUptName] = useState('');
  const [externalOriginName, setExternalOriginName] = useState('');
  const [grossWeightKg, setGrossWeightKg] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [vehicleSearchQuery, setVehicleSearchQuery] = useState('');
  const [isVehicleDropdownOpen, setIsVehicleDropdownOpen] = useState(false);
  const vehicleDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (vehicleDropdownRef.current && !vehicleDropdownRef.current.contains(event.target as Node)) {
        setIsVehicleDropdownOpen(false);
        // Restore query to selected plate number if any
        if (selectedVehicleId) {
          const matched = vehicles.find((v: any) => v.id === selectedVehicleId);
          if (matched) {
            setVehicleSearchQuery(matched.plateNumber);
          }
        } else {
          setVehicleSearchQuery('');
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [selectedVehicleId, vehicles]);

  // Filter State
  const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filterStatus, setFilterStatus] = useState<"all" | "valid" | "cancel_requested" | "cancelled">("valid");

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Load Bakung Data
  useEffect(() => {
    const currentUid = auth.currentUser?.uid;
    
    // Ensure query is not run before currentUid, profile, role, are fully available
    if (!profile) {
      console.log("[Bakung Query Skip] Profile is not initialized yet.");
      return;
    }
    if (!profile.role) {
      console.log("[Bakung Query Skip] Profile role is not defined yet.");
      return;
    }
    if (!currentUid) {
      console.log("[Bakung Query Skip] Auth currentUser UID is not ready yet.");
      return;
    }

    // Normalize profile userId field and protect against stale profile mismatch
    const resolvedProfileUid = profile.userId || (profile as any).uid || (profile as any).id;
    if (!resolvedProfileUid) {
      console.log("[Bakung Query Skip] Profile userId is missing. Waiting for profile to resolve.");
      return;
    }

    if (resolvedProfileUid !== currentUid) {
      console.log("[Bakung Query Skip] Profile-to-Auth mismatch. Stale profile detected.", {
        profileUid: resolvedProfileUid,
        currentUid
      });
      return;
    }

    const isOperator = profile.role === 'operator_bakung';
    const isAdmin = profile.role === 'admin' || profile.role === 'co-admin';

    // If role user/viewer: do not execute query at all
    if (!isOperator && !isAdmin) {
      console.log("[Bakung Query Skip] Role is not operator_bakung or admin/co-admin. Viewer/user cannot query database.", { role: profile.role });
      return;
    }

    const getBakungQuery = ({ queryPurpose, selectedDate }: { queryPurpose: string, selectedDate: string }) => {
      const authUid = auth.currentUser?.uid;
      const role = profile?.role;

      if (!authUid || !role) {
        console.warn(`[Bakung Query Skip][${queryPurpose}] auth/profile belum siap`, {
          authUid,
          role,
          profile,
        });
        return null;
      }

      const baseRef = collection(db, 'data_sampah_bakung');

      if (role === 'operator_bakung') {
        console.log(`[Bakung Query Debug][${queryPurpose}]`, {
          queryPurpose,
          role,
          profileUserId: resolvedProfileUid,
          authUid,
          selectedDate,
          todayStr,
          filters: {
            created_by_uid: authUid,
            date: selectedDate,
          },
          queryMode: 'operator-own-data',
        });

        return query(
          baseRef,
          where('created_by_uid', '==', authUid),
          where('date', '==', selectedDate)
        );
      }

      if (role === 'admin' || role === 'co-admin') {
        console.log(`[Bakung Query Debug][${queryPurpose}]`, {
          queryPurpose,
          role,
          profileUserId: resolvedProfileUid,
          authUid,
          selectedDate,
          todayStr,
          filters: {
            date: selectedDate,
          },
          queryMode: 'admin-global-data',
        });

        return query(
          baseRef,
          where('date', '==', selectedDate)
        );
      }

      console.warn(`[Bakung Query Blocked][${queryPurpose}] role tidak diizinkan`, {
        role,
        authUid,
      });

      return null;
    };

    setLoadingData(true);

    let unsubscribes: (() => void)[] = [];

    const handleSnapshot = (key: string, docs: any[]) => {
      setBakungTripsMap(prev => {
        const next = { ...prev, [key]: docs };
        // Combine all arrays in the map
        const allDocs = Object.values(next).flat();
        // De-duplicate by document ID
        const uniqueDocsMap = new Map();
        allDocs.forEach((d: any) => uniqueDocsMap.set(d.id, d));
        const uniqueDocs = Array.from(uniqueDocsMap.values());
        setBakungTrips(uniqueDocs);
        return next;
      });
      setLoadingData(false);
    };

    // Ubah semua error handler agar menggunakan format yang diminta
    const createSnapshotErrorHandler = (queryPurpose: string) => {
      return (error: any) => {
        const authUid = auth.currentUser?.uid;
        console.error(`[Bakung Query Error][${queryPurpose}] Error reading data_sampah_bakung:`, error.message || error);
        
        console.group(`=== [Bakung Diagnostic] PERMISSION FAILURE DETECTED ON ${queryPurpose} ===`);
        console.warn("Detail Diagnostic for Missing or insufficient permissions:");
        console.log("1. auth.currentUser.uid:", authUid);
        console.log("2. currentUserProfile (state value):", profile);
        console.log("3. currentUserProfile.role (state value):", profile?.role);
        console.log("4. Extracted Profile UserID:", resolvedProfileUid);
        console.log("5. Target Firestore user profile path expected by rules:", `users/${authUid}`);
        console.log("6. Expected 'role' value inside 'users/" + authUid + "' document:", profile?.role);
        console.log("7. Query final filters run on 'data_sampah_bakung':", 
          profile?.role === 'operator_bakung' 
            ? { created_by_uid: authUid, date: queryPurpose === 'dashboard-today' ? todayStr : filterDate }
            : { date: queryPurpose === 'admin-monitoring' ? todayStr : filterDate }
        );
        console.log("8. Firebase config project ID (projectId):", firebaseConfig?.projectId);
        console.log("9. Target Firebase DB ID:", firebaseConfig?.firestoreDatabaseId);
        console.log("10. Firebase CLI Deploy Target/Active Project:", "gen-lang-client-0776119319");
        console.warn("RECOMMENDED ACTION: Ensure a document at 'users/" + authUid + "' exists in Firestore with `{ role: \"" + profile?.role + "\" }` field and status='active'. Only then will Firestore authorize the matching query!");
        console.groupEnd();

        onNotify('error', `Gagal memuat data Bakung (${queryPurpose}).`);
        setLoadingData(false);
      };
    };

    // We store separate segments of data in a map: "today" and "filtered"
    setBakungTripsMap({});
    setBakungTrips([]);

    if (isOperator) {
      // Query 1: Today's Metrics and Recents (dashboard-today)
      const qToday = getBakungQuery({
        queryPurpose: 'dashboard-today',
        selectedDate: todayStr,
      });

      if (qToday) {
        const unsubToday = onSnapshot(
          qToday,
          (snapshot) => {
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            handleSnapshot("today", docs);
          },
          createSnapshotErrorHandler("dashboard-today")
        );
        unsubscribes.push(unsubToday);
      }

      // Query 2: Selected Date Table (data-hari-ini)
      if (filterDate !== todayStr) {
        const qFilter = getBakungQuery({
          queryPurpose: 'data-hari-ini',
          selectedDate: filterDate,
        });

        if (qFilter) {
          const unsubFilter = onSnapshot(
            qFilter,
            (snapshot) => {
              const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
              handleSnapshot("filtered", docs);
            },
            createSnapshotErrorHandler("data-hari-ini")
          );
          unsubscribes.push(unsubFilter);
        }
      }
    } else if (isAdmin) {
      // Query 3: Today's Metrics for Admin (admin-monitoring)
      const qToday = getBakungQuery({
        queryPurpose: 'admin-monitoring',
        selectedDate: todayStr,
      });

      if (qToday) {
        const unsubToday = onSnapshot(
          qToday,
          (snapshot) => {
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            handleSnapshot("today", docs);
          },
          createSnapshotErrorHandler("admin-monitoring")
        );
        unsubscribes.push(unsubToday);
      }

      // Query 4: Selected Date Logs for Admin (dashboard-log)
      if (filterDate !== todayStr) {
        const qFilter = getBakungQuery({
          queryPurpose: 'dashboard-log',
          selectedDate: filterDate,
        });

        if (qFilter) {
          const unsubFilter = onSnapshot(
            qFilter,
            (snapshot) => {
              const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
              handleSnapshot("filtered", docs);
            },
            createSnapshotErrorHandler("dashboard-log")
          );
          unsubscribes.push(unsubFilter);
        }
      }
    }

    return () => {
      console.log("[Bakung Query Unsubscribe] Cleaning up active query listeners.");
      unsubscribes.forEach(unsub => unsub());
    };
  }, [profile, filterDate, todayStr]);

  // Derived dashboard stats
  const todayTrips = bakungTrips.filter(t => t.date === todayStr);
  const todayValidTrips = todayTrips.filter(t => (t.status || "valid") === "valid");
  const todayTonnage = todayValidTrips.reduce((sum, t) => sum + (t.net_operational_weight_kg || 0), 0);
  const todayRits = todayValidTrips.length;

  const sortedTodayTrips = [...todayTrips].sort((a, b) => {
    const dateTimeA = `${a.date}T${a.time}`;
    const dateTimeB = `${b.date}T${b.time}`;
    return dateTimeB.localeCompare(dateTimeA);
  }).slice(0, 5);

  // Derived filter stats
  const filteredTripsByDate = bakungTrips.filter(t => t.date === filterDate);

  const filteredTrips =
    filterStatus === "all"
      ? filteredTripsByDate
      : filteredTripsByDate.filter(t => (t.status || "valid") === filterStatus);

  const filteredValidTrips = filteredTripsByDate.filter(t => (t.status || "valid") === "valid");

  const totalRit = filteredValidTrips.length;
  const totalNet = filteredValidTrips.reduce((sum, t) => sum + (t.net_operational_weight_kg || 0), 0);

  const sortedFilteredTrips = [...filteredTrips].sort((a, b) => b.time.localeCompare(a.time));

  // Computed fields
  const defaultEmptyWeight = DEFAULT_EMPTY_WEIGHTS[vehicleType] || 0;
  const netOperationalWeight = Math.max(0, (Number(grossWeightKg) || 0) - defaultEmptyWeight);
  const activeVehicles = vehicles.filter((v: any) => v.status !== 'Tidak Aktif');

  const filteredVehicles = activeVehicles.filter((v: any) => {
    const mappedType = mapVehicleType(v.type);

    // Armada DLH wajib mengikuti jenis kendaraan yang dipilih.
    // Kalau operator pilih Dump Truck Besar, dropdown tidak boleh menampilkan Pickup/Tossa/dll.
    const matchesSelectedVehicleType = mappedType === vehicleType;
    if (!matchesSelectedVehicleType) return false;

    const query = vehicleSearchQuery.toLowerCase().trim();
    if (!query) return true;

    // Plate number match
    const matchesPlate = (v.plateNumber || "").toLowerCase().includes(query);

    // Type match
    const matchesType =
      (v.type || "").toLowerCase().includes(query) ||
      (VEHICLE_TYPE_LABELS[mappedType] || "").toLowerCase().includes(query);

    // UPT match
    let matchesUpt = false;
    if (v.upts && v.upts.length > 0) {
      matchesUpt = v.upts.some((uId: string) => {
        const found = upts.find((u: any) => u.id === uId || u.name === uId);
        const name = found ? found.name : uId;
        return name.toLowerCase().includes(query);
      });
    }

    // Driver name match, pakai beberapa fallback nama field.
    const driverName =
      v.defaultDriverName ||
      v.default_driver_name ||
      v.driverName ||
      v.driver_name ||
      "";

    const matchesDriver = driverName.toLowerCase().includes(query);

    return matchesPlate || matchesType || matchesUpt || matchesDriver;
  });

  const handleVehicleSelect = (vehicle: any) => {
    setSelectedVehicleId(vehicle.id);
    setPlateNumber(vehicle.plateNumber);
    setVehicleSearchQuery(vehicle.plateNumber);
    setIsVehicleDropdownOpen(false);

    // Vehicle type sudah dipilih duluan dan dropdown kendaraan difilter berdasarkan vehicleType.
    // Jadi tidak perlu auto-mengubah vehicleType di sini.

    // Auto-fill UPT / Source Origin
    if (vehicle.upts && vehicle.upts.length > 0) {
      const vehicleUptIdentifier = vehicle.upts[0];
      const foundUpt = upts.find((u: any) => u.id === vehicleUptIdentifier || u.name === vehicleUptIdentifier);
      if (foundUpt) {
        setSourceOriginType('upt');
        setSelectedUptId(foundUpt.id);
        setSelectedUptName(foundUpt.name);
      }
    }
  };

  const handleUptChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) {
      setSelectedUptId('');
      setSelectedUptName('');
      return;
    }
    const found = upts.find((u: any) => u.id === val || u.name === val);
    if (found) {
      setSelectedUptId(found.id);
      setSelectedUptName(found.name);
    } else {
      setSelectedUptId(val);
      setSelectedUptName(val);
    }
  };

  const handleOpenForm = () => {
    if (profile?.role !== "operator_bakung") {
      onNotify('error', 'Akses Ditolak: Hanya Operator Bakung yang diperbolehkan menginput data pencatatan sampah.');
      return;
    }
    // Pre-initialize defaults
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setTime(format(new Date(), 'HH:mm'));
    setVehicleSourceType('dlh');
    setVehicleType('pickup');
    setPlateNumber('');
    setSelectedVehicleId('');
    setVehicleSearchQuery('');
    setIsVehicleDropdownOpen(false);
    setSourceOriginType('upt');
    setSelectedUptId('');
    setSelectedUptName('');
    setExternalOriginName('');
    setGrossWeightKg('');
    setNotes('');
    setBakungSubView("input");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    if (profile.role !== "operator_bakung") {
      onNotify('error', 'Hanya Operator Bakung yang diperbolehkan menginput data.');
      return;
    }

    const activeVehicles = vehicles.filter((v: any) => v.status !== 'Tidak Aktif');
    if (vehicleSourceType === 'dlh') {
      if (!selectedVehicleId) {
        onNotify('error', 'Silakan pilih kendaraan DLH dari daftar.');
        return;
      }
      if (activeVehicles.length === 0) {
        onNotify('error', 'Data kendaraan DLH belum tersedia.');
        return;
      }
    }

    const parsedGross = Number(grossWeightKg);
    if (!date) {
      onNotify('error', 'Tanggal wajib diisi.');
      return;
    }
    if (!time) {
      onNotify('error', 'Jam wajib diisi.');
      return;
    }
    if (!plateNumber.trim()) {
      onNotify('error', 'Nomor polisi wajib diisi.');
      return;
    }
    if (parsedGross <= 0) {
      onNotify('error', 'Berat bruto harus lebih besar dari 0 kg.');
      return;
    }
    if (netOperationalWeight <= 0) {
      onNotify('error', `Berat bruto harus lebih besar dari berat kosong default (${defaultEmptyWeight} kg) agar netto lebih dari 0 kg.`);
      return;
    }
    if (sourceOriginType === 'upt' && !selectedUptId) {
      onNotify('error', 'UPT Asal wajib dipilih.');
      return;
    }
    if (sourceOriginType === 'non_upt' && !externalOriginName.trim()) {
      onNotify('error', 'Nama Sumber Non-UPT wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      const currentAuthUid = auth.currentUser?.uid;
      const docData = {
        date,
        time,
        datetime: new Date(`${date}T${time}`),

        vehicle_id: vehicleSourceType === 'dlh' ? selectedVehicleId : "",
        vehicle_source_type: vehicleSourceType,
        vehicle_source_label: VEHICLE_SOURCE_LABELS[vehicleSourceType] || vehicleSourceType,

        vehicle_type: vehicleType,
        vehicle_type_label: VEHICLE_TYPE_LABELS[vehicleType] || vehicleType,

        plate_number: plateNumber.trim().toUpperCase(),

        source_origin_type: sourceOriginType,
        source_origin_label: SOURCE_ORIGIN_LABELS[sourceOriginType] || sourceOriginType,

        upt_id: sourceOriginType === 'upt' ? selectedUptId : "",
        upt_name: sourceOriginType === 'upt' ? selectedUptName : "",
        external_origin_name: sourceOriginType === 'non_upt' ? externalOriginName.trim() : "",

        gross_weight_kg: Number(parsedGross),
        default_empty_weight_kg: Number(defaultEmptyWeight),
        net_operational_weight_kg: Number(netOperationalWeight),

        weighing_method: "single_weighing_default_empty_weight",

        notes: notes.trim(),

        status: "valid",

        created_by_uid: currentAuthUid || profile.userId,
        created_by_name: profile.account_name,
        created_by_role: "operator_bakung",
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      };

      // Diagnostic logging before submit as requested by the user
      console.log("=== DIAGNOSTIC LOG FOR DATA_SAMPAH_BAKUNG CREATE ===");
      console.log("auth.currentUser.uid:", currentAuthUid);
      console.log("currentUserProfile.userId:", profile.userId);
      console.log("currentUserProfile.role:", profile.role);
      console.log("currentUserProfile.username:", profile.username);
      console.log("path target collection:", "data_sampah_bakung");
      console.log("typeof gross_weight_kg:", typeof docData.gross_weight_kg, docData.gross_weight_kg);
      console.log("typeof default_empty_weight_kg:", typeof docData.default_empty_weight_kg, docData.default_empty_weight_kg);
      console.log("typeof net_operational_weight_kg:", typeof docData.net_operational_weight_kg, docData.net_operational_weight_kg);
      console.log("plate_number:", docData.plate_number, "length:", docData.plate_number.length);
      console.log("date:", docData.date, "length:", docData.date.length);
      console.log("time:", docData.time, "length:", docData.time.length);
      console.log("created_by_role:", docData.created_by_role);
      console.log("status:", docData.status);
      console.log("Full Submission Payload:", JSON.stringify(docData, (key, value) => {
        if (value instanceof Date) return value.toISOString();
        return value;
      }, 2));
      console.log("====================================================");

      await addDoc(collection(db, "data_sampah_bakung"), docData);

      if (logActivity) {
        await logActivity('operasional', 'input_sampah_bakung', 'Bakung', `Operator menginput data kendaraan ${docData.plate_number} seberat netto ${docData.net_operational_weight_kg} kg`, { profile });
      }

      onNotify('success', 'Data sampah Bakung berhasil disimpan.');
      setPlateNumber('');
      setSelectedVehicleId('');
      setVehicleSearchQuery('');
      setExternalOriginName('');
      setGrossWeightKg('');
      setNotes('');
      setBakungSubView("dashboard");
    } catch (err: any) {
      console.error(err);
      handleFirestoreError(err, OperationType.CREATE, "data_sampah_bakung");
      onNotify('error', 'Gagal menyimpan data ke jembatan timbang TPA Bakung.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (bakungSubView === "input") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 bg-slate-900/40 p-5 rounded-2xl border border-slate-800">
          <button 
            type="button"
            onClick={() => setBakungSubView("dashboard")} 
            className="p-2 bg-slate-950 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all border border-slate-800"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">Input Data Sampah TPA Bakung</h3>
            <p className="text-xs text-slate-400">Pencatatan volume timbangan jembatan dan data tonase armada.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-xl">
          {/* Tanggal & Jam */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2.5">Tanggal Operasional</label>
              <input 
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-all font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2.5">Waktu Pencatatan (WIB)</label>
              <input 
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-all font-mono"
                required
              />
            </div>
          </div>

          {/* Kategori & Jenis Kendaraan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2.5">Kategori Sumber Kendaraan</label>
              <select 
                value={vehicleSourceType}
                onChange={(e) => {
                  const val = e.target.value;
                  setVehicleSourceType(val);
                  setSelectedVehicleId('');
                  setVehicleSearchQuery('');
                  setPlateNumber('');
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-all custom-select"
                required
              >
                <option value="dlh">Armada DLH</option>
                <option value="government">Dinas/Instansi Lain</option>
                <option value="private">Swasta</option>
                <option value="community">Masyarakat</option>
                <option value="other">Lainnya</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2.5">Jenis Armada</label>
              <select 
                value={vehicleType}
                onChange={(e) => {
                  const nextVehicleType = e.target.value;
                  setVehicleType(nextVehicleType);

                  // Kalau jenis kendaraan berubah, pilihan kendaraan DLH lama harus direset.
                  // Biar tidak ada kasus jenis = pickup tapi kendaraan terpilih dump truck.
                  if (vehicleSourceType === 'dlh') {
                    setSelectedVehicleId('');
                    setPlateNumber('');
                    setVehicleSearchQuery('');
                    setIsVehicleDropdownOpen(false);
                  }
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-all custom-select"
                required
              >
                <option value="pickup">Pickup</option>
                <option value="tossa">Tossa / Motor Roda Tiga</option>
                <option value="dump_small">Dump Truck Kecil</option>
                <option value="dump_large">Dump Truck Besar</option>
                <option value="armroll_container">Armroll + Container</option>
                <option value="other">Lainnya</option>
              </select>
            </div>
          </div>

          {/* Nomor Polisi */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2.5">
              {vehicleSourceType === 'dlh' ? 'Pilih Kendaraan DLH' : 'Nomor Polisi (Nopol)'}
            </label>
            {vehicleSourceType === 'dlh' ? (
              activeVehicles.length === 0 ? (
                <div id="dlh-empty-state" className="text-amber-500 text-xs bg-amber-500/10 p-3.5 rounded-xl border border-amber-500/20 font-medium">
                  Data kendaraan DLH belum tersedia. Silakan hubungi admin untuk menambahkan database kendaraan terlebih dahulu.
                </div>
              ) : (
                <div ref={vehicleDropdownRef} className="relative w-full">
                  <div className="relative">
                    <input
                      id="dlh-vehicle-search"
                      type="text"
                      placeholder="Cari berdasarkan nopol / jenis / UPT / supir..."
                      value={vehicleSearchQuery}
                      onChange={(e) => {
                        setVehicleSearchQuery(e.target.value);
                        setIsVehicleDropdownOpen(true);
                      }}
                      onFocus={() => setIsVehicleDropdownOpen(true)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-4 pr-10 py-3 text-sm text-slate-200 placeholder:text-slate-650 focus:outline-none focus:border-indigo-500 transition-all font-medium font-mono"
                      required={!selectedVehicleId}
                      autoComplete="off"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      {selectedVehicleId ? (
                        <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20 uppercase font-mono font-bold">Terpilih</span>
                      ) : (
                        <span className="text-[9px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded border border-red-500/20 uppercase font-bold">Wajib</span>
                      )}
                      <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isVehicleDropdownOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  {isVehicleDropdownOpen && (
                    <div className="absolute z-50 w-full mt-2 max-h-72 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-2 space-y-1 divide-y divide-slate-900/50">
                      {filteredVehicles.length === 0 ? (
                        <div className="text-slate-500 text-xs text-center py-4 font-medium">
                          Tidak ada kendaraan yang cocok dengan pencarian.
                        </div>
                      ) : (
                        filteredVehicles.map((v: any) => {
                          const isSelected = selectedVehicleId === v.id;
                          
                          // Resolve UPT labels
                          let uptLabel = "Belum ada penempatan UPT";
                          if (v.upts && v.upts.length > 0) {
                            const names = v.upts.map((uId: string) => {
                              const found = upts.find((u: any) => u.id === uId || u.name === uId);
                              return found ? found.name : uId;
                            });
                            uptLabel = `UPT: ${names.join(", ")}`;
                          }
                          
                          // Driver label
                          const driverLabel = v.defaultDriverName ? `Supir: ${v.defaultDriverName}` : "Supir: Belum tercatat";

                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => {
                                handleVehicleSelect(v);
                              }}
                              className={`w-full text-left p-2.5 rounded-lg text-xs leading-relaxed transition-all flex flex-col gap-0.5 ${
                                isSelected 
                                  ? 'bg-indigo-600 text-white' 
                                  : 'hover:bg-slate-900 text-slate-300'
                              }`}
                            >
                              <div className="flex justify-between items-center w-full">
                                <span className="font-mono font-bold text-sm tracking-wide">
                                  {v.plateNumber}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium uppercase font-sans ${
                                  isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-800 text-slate-400'
                                }`}>
                                  {VEHICLE_TYPE_LABELS[mapVehicleType(v.type)] || v.type || "Lainnya"}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-x-2 gap-y-0.5 items-center font-sans text-[11px]">
                                <span className={isSelected ? 'text-indigo-200' : 'text-slate-400'}>
                                  {uptLabel}
                                </span>
                                <span className="h-2 w-px bg-slate-850"></span>
                                <span className={isSelected ? 'text-indigo-150 font-medium' : 'text-slate-500'}>
                                  {driverLabel}
                                </span>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                  {selectedVehicleId && !isVehicleDropdownOpen && (() => {
                    const matched = vehicles.find((v: any) => v.id === selectedVehicleId);
                    if (!matched) return null;
                    let uptLabel = "Belum ada penempatan UPT";
                    if (matched.upts && matched.upts.length > 0) {
                      const names = matched.upts.map((uId: string) => {
                        const found = upts.find((u: any) => u.id === uId || u.name === uId);
                        return found ? found.name : uId;
                      });
                      uptLabel = `UPT: ${names.join(", ")}`;
                    }
                    const driverLabel = matched.defaultDriverName ? `Supir: ${matched.defaultDriverName}` : "Supir: Belum tercatat";
                    return (
                      <div className="mt-2 text-[11px] bg-indigo-500/5 border border-indigo-500/10 rounded-lg p-2.5 flex flex-wrap gap-x-3 gap-y-1 items-center text-slate-400 font-sans">
                        <span className="text-xs text-white font-mono font-bold">{matched.plateNumber}</span>
                        <span className="hidden sm:inline text-slate-750">|</span>
                        <span>{VEHICLE_TYPE_LABELS[mapVehicleType(matched.type)] || matched.type || "Lainnya"}</span>
                        <span className="text-slate-750">|</span>
                        <span>{uptLabel}</span>
                        <span className="text-slate-750">|</span>
                        <span className="italic">{driverLabel}</span>
                      </div>
                    );
                  })()}
                </div>
              )
            ) : (
              <input 
                id="manual-plate-input"
                type="text"
                placeholder="CONTOH: BE 1234 A"
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-700 focus:outline-none focus:border-indigo-500 transition-all font-mono font-bold tracking-wider"
                required
              />
            )}
          </div>

          {/* Sumber Asal DLH vs Non-DLH/Non-UPT */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2.5">Sumber Sampah Asal</label>
              <select 
                value={sourceOriginType}
                onChange={(e) => {
                  setSourceOriginType(e.target.value);
                  setSelectedUptId('');
                  setSelectedUptName('');
                  setExternalOriginName('');
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-all custom-select"
                required
              >
                <option value="upt">UPT DLH (Kegiatan Resmi)</option>
                <option value="non_upt">Non-UPT (Swasta / Mandiri / Luar)</option>
              </select>
            </div>
            
            <div>
              {sourceOriginType === 'upt' ? (
                <>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2.5">UPT Asal Pengirim</label>
                  <select 
                    value={selectedUptId || selectedUptName}
                    onChange={handleUptChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-all custom-select"
                    required
                  >
                    <option value="">-- Pilih UPT DLH --</option>
                    {upts && upts.map((u: any) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </>
              ) : (
                <>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2.5">Nama Instansi / Sumber Non-UPT</label>
                  <input 
                    type="text"
                    placeholder="Contoh: PT Swasta Agung, Kec Sukarame, Mandiri"
                    value={externalOriginName}
                    onChange={(e) => setExternalOriginName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-700 focus:outline-none focus:border-indigo-500 transition-all"
                    required
                  />
                </>
              )}
            </div>
          </div>

          {/* Timbangan Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-950/50 p-5 rounded-2xl border border-slate-800/80">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-widest mb-2.5">Berat Bruto (kg)</label>
              <input 
                type="number"
                min="1"
                placeholder="0"
                value={grossWeightKg}
                onChange={(e) => setGrossWeightKg(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-base text-white focus:outline-none focus:border-indigo-500 transition-all font-mono font-bold"
                required
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Timbangan total kendaraan isi.</span>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2.5">Berat Kosong Default (kg)</label>
              <input 
                type="number"
                value={defaultEmptyWeight}
                readOnly
                className="w-full bg-slate-900 border border-slate-800/80 rounded-xl px-4 py-3 text-base text-slate-500 font-mono font-bold cursor-not-allowed"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Standar acuan berat kendaraan kosong.</span>
            </div>
            <div>
              <label className="block text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2.5">Netto Operasional (kg)</label>
              <input 
                type="number"
                value={netOperationalWeight}
                readOnly
                className="w-full bg-indigo-950/20 border border-indigo-500/20 rounded-xl px-4 py-3 text-base text-indigo-400 font-mono font-black cursor-not-allowed"
              />
              <span className="text-[10px] text-indigo-500/80 mt-1 block">Netto = Bruto - Tara Kendaraan.</span>
            </div>
          </div>

          {/* Catatan */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2.5">Catatan Tambahan (Opsional)</label>
            <textarea 
              placeholder="Tuliskan catatan khusus (kondisi sampah basah/kering, kendala, atau keterangan khusus pelat)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-700 focus:outline-none focus:border-indigo-500 transition-all min-h-[100px]"
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3.5 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setBakungSubView("dashboard")}
              className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-widest rounded-xl transition-all border border-slate-700"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-950/25 border border-indigo-500/25"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                  Mendata...
                </>
              ) : (
                <>
                  <Plus className="w-4.5 h-4.5" />
                  Simpan Pencatatan Sampah
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (bakungSubView === "data-hari-ini") {
    return (
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/40 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-3">
            <button 
              type="button"
              onClick={() => setBakungSubView("dashboard")} 
              className="p-2 bg-slate-950 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all border border-slate-800"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h3 className="text-xl font-bold text-white tracking-tight">Rincian Data Sampah TPA Bakung</h3>
              <p className="text-xs text-slate-400">Pencarian log penimbangan sampah masuk terintegrasi.</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 self-start sm:self-center">
            <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800 max-w-xs">
              <Calendar className="w-4 h-4 text-slate-500 ml-1.5" />
              <input 
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="bg-transparent border-none text-slate-200 text-xs focus:outline-none focus:ring-0 cursor-pointer pr-3 font-mono"
              />
            </div>

            <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <Filter className="w-4 h-4 text-slate-500 ml-1.5" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as "all" | "valid" | "cancel_requested" | "cancelled")}
                className="bg-transparent border-none text-slate-200 text-xs focus:outline-none focus:ring-0 cursor-pointer pr-3 custom-select"
              >
                <option value="valid">Valid</option>
                <option value="cancel_requested">Menunggu Pembatalan</option>
                <option value="cancelled">Dibatalkan</option>
                <option value="all">Semua Status</option>
              </select>
            </div>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-lg">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Total Ritase Tanggal Ditunjuk</p>
              <h4 className="text-2xl md:text-3xl font-black text-white mt-2.5">{totalRit} <span className="text-xs md:text-sm font-medium text-slate-500 font-sans">Rit</span></h4>
            </div>
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/25">
              <Truck className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-lg">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Total Tonase Bersih</p>
              <h4 className="text-2xl md:text-3xl font-black text-indigo-400 mt-2.5">{totalNet.toLocaleString('id-ID')} <span className="text-xs md:text-sm font-medium text-slate-500 font-sans">Kg</span></h4>
            </div>
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/25">
              <Weight className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* List of Trips */}
        {loadingData ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-slate-400 text-xs font-mono font-bold tracking-wider uppercase">Sinkronisasi Database TPA Bakung...</p>
          </div>
        ) : sortedFilteredTrips.length === 0 ? (
          <div className="bg-slate-950/40 rounded-xl border border-slate-800/80 p-12 text-center flex flex-col items-center justify-center space-y-3.5 min-h-[220px]">
            <div className="p-3.5 bg-slate-905 rounded-full text-slate-600 border border-slate-850">
              <ClipboardList className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-300">Belum ada aktivitas input data</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {profile?.role === 'operator_bakung' 
                  ? 'Belum ada data timbangan sampah masuk yang Anda daftarkan di TPA Bakung pada tanggal ini.' 
                  : 'Belum ada log penimbangan sampah masuk TPA Bakung di tanggal ini.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800/60 font-bold text-slate-400 uppercase tracking-widest text-[9px]">
                    <th className="px-5 py-4">Waktu</th>
                    <th className="px-5 py-4">Nama Operator</th>
                    <th className="px-5 py-4">Nopol</th>
                    <th className="px-5 py-4">Kategori</th>
                    <th className="px-5 py-4">Jenis Armada</th>
                    <th className="px-5 py-4">Sumber Asal</th>
                    <th className="px-5 py-4 text-right">Bruto (kg)</th>
                    <th className="px-0.5 py-4 text-center">Tara</th>
                    <th className="px-5 py-4 text-right">Netto (kg)</th>
                    <th className="px-5 py-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/30">
                  {sortedFilteredTrips.map((item, index) => (
                    <tr key={item.id || index} className="hover:bg-slate-850/20 transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-slate-400">{item.time}</td>
                      <td className="px-5 py-4 font-medium text-slate-300">{item.created_by_name || "-"}</td>
                      <td className="px-5 py-4 font-mono font-bold text-white tracking-wide uppercase">{item.plate_number}</td>
                      <td className="px-5 py-4 text-slate-350">{item.vehicle_source_label}</td>
                      <td className="px-5 py-4">{item.vehicle_type_label}</td>
                      <td className="px-5 py-4">
                        <div>
                          <span className="font-semibold text-slate-200">{item.source_origin_label}</span>
                          {item.source_origin_type === 'upt' ? (
                            <span className="text-[10px] text-indigo-400 block font-mono mt-0.5">{item.upt_name}</span>
                          ) : (
                            <span className="text-[10px] text-slate-500 block font-mono mt-0.5">{item.external_origin_name}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right font-mono text-slate-400">{item.gross_weight_kg ? item.gross_weight_kg.toLocaleString('id-ID') : 0}</td>
                      <td className="px-0.5 py-4 text-center font-mono text-slate-500">-{item.default_empty_weight_kg || 0}</td>
                      <td className="px-5 py-4 text-right font-mono text-emerald-400 font-extrabold">{item.net_operational_weight_kg ? item.net_operational_weight_kg.toLocaleString('id-ID') : 0}</td>
                      <td className="px-5 py-4 text-center">
                        {(() => {
                          const s = item.status || "valid";
                          let label = "Valid";
                          let cls = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
                          if (s === "cancel_requested") {
                            label = "Menunggu Pembatalan";
                            cls = "bg-amber-500/10 text-amber-400 border border-amber-500/20";
                          } else if (s === "cancelled") {
                            label = "Dibatalkan";
                            cls = "bg-red-500/10 text-red-400 border border-red-500/20";
                          }
                          return (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${cls}`}>
                              <Check className="w-3 h-3" />
                              {label}
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 p-6 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-mono font-bold rounded-md uppercase tracking-wider">
              TPA Bakung - Tahap 1B
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Dashboard Bakung</h2>
          <p className="text-slate-400 text-xs sm:text-sm">Monitoring log internal & tonase timbangan jembatan.</p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleOpenForm}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-indigo-950/25 border border-indigo-500/25"
          >
            <Plus className="w-4 h-4" />
            Input Data Sampah
          </button>
          <button
            onClick={() => setBakungSubView("data-hari-ini")}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider border border-slate-700 rounded-xl transition-all"
          >
            <ClipboardList className="w-4 h-4" />
            Data Hari Ini
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
        <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-6 overflow-hidden group hover:border-indigo-500/20 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl transition-all group-hover:bg-indigo-500/10" />
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Tonase Hari Ini</p>
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <Weight className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-none">
            {todayTonnage.toLocaleString('id-ID')}{" "}
            <span className="text-xs md:text-sm font-medium text-slate-500 font-sans">Kg</span>
          </h3>
          <p className="text-[10px] text-slate-500 mt-2">Menampilkan total akumulasi timbangan hari ini.</p>
        </div>

        <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-6 overflow-hidden group hover:border-indigo-500/20 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl transition-all group-hover:bg-emerald-500/10" />
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Rit Hari Ini</p>
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-none">
            {todayRits}{" "}
            <span className="text-xs md:text-sm font-medium text-slate-500 font-sans">Rit</span>
          </h3>
          <p className="text-[10px] text-slate-500 mt-2">Menampilkan total armada/kendaraan masuk hari ini.</p>
        </div>
      </div>

      {/* Log Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
        <h4 className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-widest">Log Input Terkini Hari Ini (Maksimal 5)</h4>
        {sortedTodayTrips.length === 0 ? (
          <div className="bg-slate-950/60 rounded-xl border border-slate-800/80 p-8 text-center flex flex-col items-center justify-center space-y-3 min-h-[220px]">
            <div className="p-3.5 bg-slate-900 rounded-full text-slate-600 border border-slate-850">
              <ClipboardList className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-300">Belum ada aktivitas input data hari ini</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {profile?.role === 'operator_bakung' 
                  ? 'Gunakan tombol "Input Data Sampah" untuk mulai mendaftarkan armada timbangan.' 
                  : 'Seluruh log timbangan sampah mandiri di TPA Bakung akan muncul di sini setelah didata.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedTodayTrips.map((log, index) => (
              <div key={log.id || index} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-950 border border-slate-850 rounded-xl hover:border-slate-800 transition-all shadow-inner">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-400">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white uppercase tracking-wide">{log.plate_number}</span>
                      <span className="text-[10px] px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded font-mono uppercase font-bold">{log.vehicle_type_label}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Asal: <span className="font-semibold text-slate-350">{log.source_origin_type === 'upt' ? log.upt_name : log.external_origin_name}</span>
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center sm:text-right sm:flex-col justify-between sm:justify-center border-t sm:border-t-0 border-slate-800/80 pt-2 sm:pt-0 gap-1 font-mono">
                  <span className="text-[9px] text-slate-500 font-bold uppercase sm:order-first">Netto</span>
                  <span className="text-sm font-black text-emerald-400">{log.net_operational_weight_kg?.toLocaleString('id-ID')} kg</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">{log.time} WIB</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
