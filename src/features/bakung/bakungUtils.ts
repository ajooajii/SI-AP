export const mapVehicleType = (typeStr: string): string => {
  if (!typeStr) return "other";
  const normalized = typeStr.toLowerCase();
  if (normalized.includes("roda 3") || normalized.includes("motor roda") || normalized.includes("tossa")) {
    return "tossa";
  }
  if (normalized.includes("arm roll") || normalized.includes("armroll")) {
    return "armroll_container";
  }
  if (normalized.includes("pick up") || normalized.includes("pickup")) {
    return "pickup";
  }
  if (normalized.includes("dump") || normalized.includes("truk") || normalized.includes("truck")) {
    if (normalized.includes("besar") || normalized.includes("large")) {
      return "dump_large";
    }
    return "dump_small";
  }
  return "other";
};

export function formatWeightKg(weight?: number | null): string {
  if (weight === undefined || weight === null) return "0";
  return weight.toLocaleString('id-ID');
}
