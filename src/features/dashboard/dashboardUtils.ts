import { format } from "date-fns";
import { TripRecord, UserProfile } from "../../types";

export function getFilteredTripsForUser(propTrips: TripRecord[], profile: UserProfile | null, settings: any): TripRecord[] {
  if (profile?.role === 'user' && !settings?.visualDataRitase) {
    const userUpt = profile?.assigned_upt_name || profile?.uptName || profile?.upt || "";
    return propTrips.filter((t: TripRecord) => t.upt === userUpt);
  }
  return propTrips;
}

export function calculateStatsToday(trips: TripRecord[]) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayTrips = trips.filter((t: TripRecord) => t.date === todayStr);

  const ritaseToday = todayTrips.reduce((acc: number, t: TripRecord) => acc + (t.tripCount || 1), 0);
  const tonnageToday = todayTrips.reduce((acc: number, t: TripRecord) => acc + (t.tonnage || 0), 0) / 1000;
  const volumeToday = todayTrips.reduce((acc: number, t: TripRecord) => acc + (t.volume || 0), 0);

  return {
    ritaseToday,
    tonnageToday,
    volumeToday
  };
}

export function get7DaysChartData(trips: TripRecord[]) {
  return Array.from({ length: 7 }).map((_, i) => {
    const d = format(new Date(Date.now() - i * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
    const dayTrips = trips.filter((t: TripRecord) => t.date === d);
    return {
      date: d,
      ritase: dayTrips.reduce((acc: number, t: TripRecord) => acc + (t.tripCount || 1), 0)
    };
  }).reverse();
}
