export type UserRole = 'admin' | 'co-admin' | 'user';

export interface UserProfile {
  userId: string;
  username: string;
  role: UserRole;
  assigned_upt_id?: string;
  assigned_upt_name?: string;
  account_name: string;
  operator_name: string;
  status: 'active' | 'inactive';
  email: string;
  force_password_change?: boolean;
  // Legacy fields for compatibility during transition
  name?: string;
  upt?: string;
  uptId?: string;
  uptName?: string;
  createdAt?: any;
}

export interface TripRecord {
  id: string;
  date: string;
  operationalTime?: string;
  vehiclePlate: string;
  vehicleType?: string;
  driverName: string;
  upt: string;
  tpa: string;
  volume: number;
  tonnage: number;
  tripCount: number;
  keterangan?: string;
  timestamp: any;
  createdBy: string;
  created_by_upt_id?: string;
  created_by_upt_name?: string;
  created_by_user_name?: string;
  created_by_username?: string;
  created_by_account_name?: string;
  updatedAt?: any;
}

export interface UPT {
  id: string;
  upt_id: string; // Format: UPT001
  nama_upt: string;
  kode_pendek: string;
  penanggung_jawab?: string;
  status_pimpinan: 'PLT' | 'Definitif';
  area_polygon?: string;
  name: string; // For compatibility
}

export interface Vehicle {
  id: string;
  plateNumber: string;
  type: string;
  brand?: string;
  status: 'Aktif' | 'Tidak Aktif';
  status_description?: string;
  upts: string[];
  defaultDriverName?: string;
  ritaseTonnage?: { [uptName: string]: { [ritaseNumber: number]: number } };
  bbm?: string;
  tahun_pengadaan?: number;
  nomor_rangka?: string;
  nomor_mesin?: string;
}

export interface ActivityLog {
  id?: string;
  timestamp: any;
  category: 'login' | 'operasional' | 'perubahan_data' | 'sistem';
  action: string;
  module: string;
  recordId?: string;
  recordLabel?: string;
  performedBy: {
    userId: string;
    username: string;
    operatorName: string;
    accountName: string;
    role: string;
    uptId: string;
    uptName: string;
  };
  description: string;
  beforeData?: any;
  afterData?: any;
  metadata?: any;
}

export interface Driver {
  id: string;
  name: string;
  upts: string[];
  vehiclePlate?: string;
  jabatan?: string;
  status_asn?: string;
  nip?: string;
  phone?: string;
}

export interface GlobalSettings {
  mainTpaId: string;
  isTpaLocked: boolean;
  enableWeight?: boolean;
  showWeightInForm?: boolean;
  showVolume?: boolean;
  visualDataRitase?: boolean;
}

export interface TPA {
  id: string;
  name: string;
  location?: string;
}

export interface TPS {
  id: string;
  name: string;
  type?: string;
  subDistrict?: string;
  address?: string;
  lat?: number;
  lng?: number;
  capacity?: string;
  generation?: string;
  location?: string; // For compatibility with existing UI
}

export const UPT_LIST: string[] = [
  "UPT Kedaton",
  "UPT Tanjung Karang Pusat",
  "UPT Tanjung Karang Barat",
  "UPT Tanjung Karang Timur",
  "UPT Teluk Betung Selatan",
  "UPT Teluk Betung Barat",
  "UPT Teluk Betung Utara",
  "UPT Panjang",
  "UPT Sukarame",
  "UPT Kemiling",
  "UPT Rajabasa",
  "UPT Way Halim"
];
