import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { format } from "date-fns";

// Helper to format timestamps
const formatTimestamp = (ts: any) => {
  if (!ts) return "-";
  if (ts.toDate && typeof ts.toDate === 'function') return format(ts.toDate(), "yyyy-MM-dd HH:mm:ss");
  if (ts.seconds !== undefined) return format(new Date(ts.seconds * 1000), "yyyy-MM-dd HH:mm:ss");
  if (ts instanceof Date) return format(ts, "yyyy-MM-dd HH:mm:ss");
  if (typeof ts === 'string') return ts;
  return "-";
};

// Helper for identity resolution (Created By / Diinput Oleh)
// Format: operator_name + ' - ' + account_name
const resolveIdentity = (record: any, users: any[] = []) => {
  // 1. Try fields already on the record (new records should have these)
  let operator = record.operator_name || record.created_by_user_name || record.username || record.created_by_username;
  
  // IMPORTANT: Avoid record.upt or record.uptName here if they are ambiguous (often operational UPT in trips)
  // Use explicit account identity fields
  let account = record.created_by_account_name || record.account_name || record.created_by_upt_name || record.assigned_upt_name;
  
  // 2. If missing, and we have users list for lookup, try to find by createdBy (Firebase UID)
  if ((!operator || !account) && record.createdBy && users.length > 0) {
    const userProfile = users.find(u => u.userId === record.createdBy || u.id === record.createdBy);
    if (userProfile) {
      if (!operator) operator = userProfile.operator_name || userProfile.name || userProfile.username;
      if (!account) account = userProfile.account_name || userProfile.upt || userProfile.assigned_upt_name || userProfile.uptName || userProfile.assigned_upt_name;
    }
  }

  if (operator && account) return `${operator} - ${account}`;
  if (operator) return operator;
  if (account) return account;
  return "-";
};

// Generic function to prepare worksheet data with preferred order and dynamic fields
function fillWorksheet(worksheet: ExcelJS.Worksheet, data: any[], preferredOrder: { [key: string]: string }, extraConfig: { 
  exclude?: string[], 
  transform?: { [key: string]: (val: any, record: any) => any },
  users?: any[]
} = {}) {
  if (!data || data.length === 0) return;

  const excluded = new Set(extraConfig.exclude || []);
  excluded.add("id"); // Usually handled as technical column if needed

  // 1. Identify all unique keys across all records
  const allKeys = new Set<string>();
  data.forEach(item => {
    Object.keys(item).forEach(key => allKeys.add(key));
  });

  // 2. Define columns based on preferred order
  const columns: any[] = [];
  const handledKeys = new Set<string>();

  // Use the preferred order first
  Object.entries(preferredOrder).forEach(([key, label]) => {
    columns.push({ header: label, key: key, width: 25 });
    handledKeys.add(key);
  });

  // Add any other keys found in data that weren't in preferred order or excluded
  allKeys.forEach(key => {
    if (!handledKeys.has(key) && !excluded.has(key)) {
      // Convert camelCase or snake_case to Title Case for header
      const label = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
      columns.push({ header: label, key: key, width: 20 });
    }
  });

  // Always add technical ID at the end if specifically requested or present and not excluded
  if (allKeys.has("userId") && !handledKeys.has("userId")) {
     columns.push({ header: "User ID Internal", key: "userId", width: 30 });
  } else if (allKeys.has("id") && !excluded.has("id")) {
     columns.push({ header: "Internal ID", key: "id", width: 30 });
  } else if (allKeys.has("createdBy") && !handledKeys.has("createdBy")) {
     columns.push({ header: "User ID Internal", key: "createdBy", width: 30 });
  }

  worksheet.columns = columns;

  // 3. Add rows
  data.forEach(item => {
    const rowData: any = {};
    
    // Process all keys
    allKeys.forEach(key => {
      let val = item[key];
      
      // Apply transforms
      if (extraConfig.transform && extraConfig.transform[key]) {
        val = extraConfig.transform[key](val, item);
      } else if (key.toLowerCase().includes("timestamp") || key.toLowerCase().includes("dateat") || key === "createdAt" || key === "updatedAt") {
        val = formatTimestamp(val);
      } else if (Array.isArray(val)) {
        val = val.join(", ");
      } else if (typeof val === 'object' && val !== null) {
        val = JSON.stringify(val);
      }

      rowData[key] = (val === null || val === undefined) ? "-" : val;
    });
    
    // Ensure we handle virtual fields for identity/Created By
    Object.keys(preferredOrder).forEach(pk => {
      if (pk === "diinput_oleh") {
        rowData[pk] = resolveIdentity(item, extraConfig.users);
      }
    });

    worksheet.addRow(rowData);
  });

  formatWorksheet(worksheet);
}

export async function exportTripsToExcel(trips: any[], title: string, users: any[] = []) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Ritase");

  const preferredOrder = {
    "date": "Tanggal",
    "timestamp": "Waktu Input",
    "diinput_oleh": "Diinput Oleh",
    "created_by_upt_name": "Akun / Instansi",
    "upt": "UPT Operasional",
    "driverName": "Supir",
    "vehicleType": "Kendaraan",
    "vehiclePlate": "Plat Nomor",
    "tpa": "TPA",
    "tripCount": "Ritase",
    "tonnage": "Tonase",
    "volume": "Volume",
    "keterangan": "Keterangan"
  };

  fillWorksheet(worksheet, trips, preferredOrder, {
    transform: {
      tonnage: (val) => (val || 0) / 1000,
      timestamp: (val) => formatTimestamp(val),
      updatedAt: (val) => formatTimestamp(val),
    },
    users,
    exclude: ["createdBy", "created_by_upt_id", "created_by_user_name", "created_by_username", "operationalTime"]
  });

  await saveWorkbook(workbook, title);
}

export async function exportAllDataToExcel(data: {
  trips: any[],
  drivers: any[],
  vehicles: any[],
  upts: any[],
  tpas: any[],
  tps: any[],
  users: any[]
}) {
  const workbook = new ExcelJS.Workbook();

  // 1. Trips
  fillWorksheet(workbook.addWorksheet("Data Ritase"), data.trips, {
    "date": "Tanggal",
    "timestamp": "Waktu Input",
    "diinput_oleh": "Diinput Oleh",
    "created_by_upt_name": "Akun / Instansi",
    "upt": "UPT Operasional",
    "driverName": "Supir",
    "vehicleType": "Kendaraan",
    "vehiclePlate": "Plat Nomor",
    "tpa": "TPA",
    "tripCount": "Ritase",
    "tonnage": "Tonase",
    "volume": "Volume",
    "keterangan": "Keterangan"
  }, {
    transform: { tonnage: (val) => (val || 0) / 1000 },
    users: data.users,
    exclude: ["createdBy", "created_by_upt_id", "created_by_user_name", "created_by_username"]
  });

  // 2. UPTs
  fillWorksheet(workbook.addWorksheet("Database UPT"), data.upts, {
    "upt_id": "ID UPT",
    "nama_upt": "Nama UPT",
    "kode_pendek": "Kode Pendek",
    "penanggung_jawab": "Penanggung Jawab",
    "status_pimpinan": "Status Pimpinan",
    "area_polygon": "Area Polygon",
    "jumlah_armada": "Jumlah Armada",
    "jumlah_personil": "Jumlah Personil"
  }, {
    exclude: ["name"]
  });

  // 3. Vehicles
  fillWorksheet(workbook.addWorksheet("Database Kendaraan"), data.vehicles, {
    "id": "ID Kendaraan",
    "plateNumber": "Plat Nomor",
    "type": "Jenis Kendaraan",
    "upts": "UPT",
    "defaultDriverName": "Supir",
    "rute": "Rute",
    "tps": "TPS",
    "defaultTonnage": "Tonase Default",
    "bbm": "BBM",
    "tahun_pengadaan": "Tahun Pengadaan",
    "nomor_rangka": "Nomor Rangka",
    "nomor_mesin": "Nomor Mesin",
    "status": "Status",
    "status_description": "Keterangan Status"
  }, {
    exclude: ["upt"]
  });

  // 4. Drivers
  fillWorksheet(workbook.addWorksheet("Database Personil"), data.drivers, {
    "id": "ID Personil",
    "name": "Nama",
    "upts": "UPT",
    "jabatan": "Jabatan",
    "status_asn": "Status Kepegawaian",
    "nip": "NIP",
    "phone": "Nomor HP",
    "address": "Alamat",
    "status": "Status"
  });

  // 5. Users
  fillWorksheet(workbook.addWorksheet("Manajemen User"), data.users, {
    "userId": "User ID",
    "username": "Username",
    "account_name": "Nama Akun",
    "operator_name": "Nama Pengguna",
    "role": "Role",
    "assigned_upt_name": "UPT Tugas",
    "status": "Status"
  });

  // 6. TPAs
  fillWorksheet(workbook.addWorksheet("Database TPA"), data.tpas, {
    "name": "Nama TPA",
    "location": "Lokasi"
  });

  // 7. TPSs
  fillWorksheet(workbook.addWorksheet("Database TPS"), data.tps, {
    "name": "Nama TPS",
    "type": "Tipe",
    "subDistrict": "Kecamatan",
    "address": "Alamat"
  });

  await saveWorkbook(workbook, "Full_Export_Database");
}

function formatWorksheet(worksheet: ExcelJS.Worksheet) {
  if (worksheet.columns) {
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
  }
  
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
  });
}

async function saveWorkbook(workbook: ExcelJS.Workbook, title: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  saveAs(blob, `${title}_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`);
}
