export const DEFAULT_EMPTY_WEIGHTS: Record<string, number> = {
  pickup: 1500,
  tossa: 500,
  dump_small: 4000,
  dump_large: 7000,
  armroll_container: 7500,
  other: 0,
};

export const VEHICLE_SOURCE_LABELS: Record<string, string> = {
  dlh: "Armada DLH",
  government: "Dinas/Instansi Lain",
  private: "Swasta",
  community: "Masyarakat",
  other: "Lainnya"
};

export const VEHICLE_TYPE_LABELS: Record<string, string> = {
  pickup: "Pickup",
  tossa: "Tossa / Motor Roda Tiga",
  dump_small: "Dump Truck Kecil",
  dump_large: "Dump Truck Besar",
  armroll_container: "Armroll + Container",
  other: "Lainnya"
};

export const SOURCE_ORIGIN_LABELS: Record<string, string> = {
  upt: "UPT DLH",
  non_upt: "Non-UPT"
};
