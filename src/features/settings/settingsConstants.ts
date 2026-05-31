import { SystemSettings } from "./settingsTypes";

export const DEFAULT_SETTINGS: SystemSettings = {
  mainTpaId: "",
  isTpaLocked: false,
  enableWeight: true,
  showWeightInForm: true,
  showVolume: true,
  visualDataRitase: false,
  visual_kendaraan_tidak_terhubung_upt: false,
  visual_kendaraan_multi_upt: false,
  visual_card_tonase_kendaraan: false,
  visual_supir_tidak_terhubung_upt: false,
  visual_supir_multi_upt: false,
  showReportsForCoAdmin: false,
};

export const QUALITY_CONTROL_ITEMS = [
  { 
    key: 'visual_kendaraan_tidak_terhubung_upt' as const, 
    label: 'Visual Kendaraan Tanpa UPT', 
    desc_on: 'Menampilkan kendaraan yang belum memiliki relasi UPT.', 
    desc_off: 'Daftar kendaraan tanpa UPT tidak ditampilkan.' 
  },
  { 
    key: 'visual_kendaraan_multi_upt' as const, 
    label: 'Visual Kendaraan Multi UPT', 
    desc_on: 'Menampilkan kendaraan yang terhubung ke >1 UPT.', 
    desc_off: 'Daftar kendaraan multi-UPT tidak ditampilkan.' 
  },
  { 
    key: 'visual_card_tonase_kendaraan' as const, 
    label: 'Visual Card Tonase Kendaraan', 
    desc_on: 'Menampilkan list tonase kendaraan dalam bentuk card.', 
    desc_off: 'List tonase card tidak ditampilkan.' 
  },
  { 
    key: 'visual_supir_tidak_terhubung_upt' as const, 
    label: 'Visual Personil Tanpa UPT', 
    desc_on: 'Menampilkan personil yang belum memiliki relasi UPT.', 
    desc_off: 'Daftar personil tanpa UPT tidak ditampilkan.' 
  },
  { 
    key: 'visual_supir_multi_upt' as const, 
    label: 'Visual Personil Multi UPT', 
    desc_on: 'Menampilkan personil yang terhubung ke >1 UPT.', 
    desc_off: 'Daftar personil multi-UPT tidak ditampilkan.' 
  },
];
