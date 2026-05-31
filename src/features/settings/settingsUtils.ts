import { SystemSettings } from "./settingsTypes";
import { DEFAULT_SETTINGS } from "./settingsConstants";

/**
 * Normalizes settings to always contain defined boolean/string values, fallback to defaults if omitted.
 */
export function initializeDraftSettings(settings: any): SystemSettings {
  if (!settings) {
    return { ...DEFAULT_SETTINGS };
  }
  return {
    mainTpaId: settings.mainTpaId || DEFAULT_SETTINGS.mainTpaId,
    isTpaLocked: settings.isTpaLocked || DEFAULT_SETTINGS.isTpaLocked,
    enableWeight: settings.enableWeight !== false,
    showWeightInForm: settings.showWeightInForm !== false,
    showVolume: settings.showVolume !== false,
    visualDataRitase: settings.visualDataRitase || DEFAULT_SETTINGS.visualDataRitase,
    visual_kendaraan_tidak_terhubung_upt: settings.visual_kendaraan_tidak_terhubung_upt || DEFAULT_SETTINGS.visual_kendaraan_tidak_terhubung_upt,
    visual_kendaraan_multi_upt: settings.visual_kendaraan_multi_upt || DEFAULT_SETTINGS.visual_kendaraan_multi_upt,
    visual_card_tonase_kendaraan: settings.visual_card_tonase_kendaraan || DEFAULT_SETTINGS.visual_card_tonase_kendaraan,
    visual_supir_tidak_terhubung_upt: settings.visual_supir_tidak_terhubung_upt || DEFAULT_SETTINGS.visual_supir_tidak_terhubung_upt,
    visual_supir_multi_upt: settings.visual_supir_multi_upt || DEFAULT_SETTINGS.visual_supir_multi_upt,
    showReportsForCoAdmin: settings.showReportsForCoAdmin || DEFAULT_SETTINGS.showReportsForCoAdmin,
  };
}

/**
 * Checks if there is any difference between the current settings and draft settings
 */
export function countChanges(original: any, draft: SystemSettings): string[] {
  if (!original || !draft) return [];
  const keys: (keyof SystemSettings)[] = [
    "mainTpaId",
    "isTpaLocked",
    "enableWeight",
    "showWeightInForm",
    "showVolume",
    "visualDataRitase",
    "visual_kendaraan_tidak_terhubung_upt",
    "visual_kendaraan_multi_upt",
    "visual_card_tonase_kendaraan",
    "visual_supir_tidak_terhubung_upt",
    "visual_supir_multi_upt",
    "showReportsForCoAdmin"
  ];
  const changed: string[] = [];
  for (const k of keys) {
    const origVal = k === "enableWeight" || k === "showWeightInForm" || k === "showVolume"
      ? (original[k] !== false)
      : (original[k] || false);
    
    if (draft[k] !== origVal) {
      changed.push(k);
    }
  }
  return changed;
}
