export interface SystemSettings {
  mainTpaId: string;
  isTpaLocked: boolean;
  enableWeight: boolean;
  showWeightInForm: boolean;
  showVolume: boolean;
  visualDataRitase: boolean;
  visual_kendaraan_tidak_terhubung_upt: boolean;
  visual_kendaraan_multi_upt: boolean;
  visual_card_tonase_kendaraan: boolean;
  visual_supir_tidak_terhubung_upt: boolean;
  visual_supir_multi_upt: boolean;
  showReportsForCoAdmin: boolean;
}

export interface SettingsViewProps {
  settings: SystemSettings | null;
  tpas: any[];
  profile: any;
  onNotify: (type: "success" | "error" | "info" | "warning", message: string) => void;
  logActivity: any;
}
