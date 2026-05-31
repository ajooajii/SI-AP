import React, { useMemo } from "react";
import { format } from "date-fns";
import { 
  ClipboardList, 
  MapPin, 
  BarChart3 
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Area, 
  CartesianGrid 
} from "recharts";
import { Button, Card } from "../master-data/components/SharedUI";
import { DashboardStatCard } from "./DashboardStatCard";
import { DashboardViewProps } from "./dashboardTypes";
import { 
  getFilteredTripsForUser, 
  calculateStatsToday, 
  get7DaysChartData 
} from "./dashboardUtils";
import { 
  LOG_RITASE_LIMIT, 
  TREND_RITASE_CHART_GRADIENT_ID, 
  DASHBOARD_TITLE, 
  DASHBOARD_SUBTITLE 
} from "./dashboardConstants";

export function MainDashboardView({ 
  trips: propTrips, 
  profile, 
  onAddClick, 
  upts, 
  tpas, 
  settings, 
  tripFilterRange, 
  setTripFilterRange 
}: DashboardViewProps) {
  const trips = useMemo(() => {
    return getFilteredTripsForUser(propTrips, profile, settings);
  }, [propTrips, profile, settings]);

  const showVolume = settings?.showVolume !== false;

  const mainTpa = tpas.find((t: any) => t.id === settings?.mainTpaId);
  const mainTpaName = mainTpa ? mainTpa.name : (tpas.length > 0 ? "Belum Diatur" : "-");

  // Ritase Logic (Hari Ini)
  const { ritaseToday, tonnageToday, volumeToday } = useMemo(() => {
    return calculateStatsToday(trips);
  }, [trips]);

  // Last 7 days chart data calculation (simple)
  const last7Days = useMemo(() => {
    return get7DaysChartData(trips);
  }, [trips]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">{DASHBOARD_TITLE}</h2>
          <p className="text-slate-500 text-sm">{DASHBOARD_SUBTITLE}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <DashboardStatCard 
          label="Tonase Hari Ini"
          value={`${tonnageToday.toFixed(2)} Ton`} 
          subValue={showVolume ? `${volumeToday.toFixed(1)} m³` : undefined}
          icon={<BarChart3 className="text-emerald-500" />} 
        />
        <DashboardStatCard 
          label="Ritase Hari Ini" 
          value={`${ritaseToday} Rit`} 
          icon={<ClipboardList className="text-blue-500" />} 
        />
        <div className="col-span-2 lg:col-span-1">
          <DashboardStatCard label="TPA Utama" value={mainTpaName} icon={<MapPin className="text-orange-500" />} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 p-6 bg-slate-900 border-slate-800">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-200">Input Terkini</h3>
            <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">LOG RITASE TERAKHIR</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {trips.sort((a: any, b: any) => {
              if (a.date !== b.date) return b.date.localeCompare(a.date);
              if (a.operationalTime && b.operationalTime) return b.operationalTime.localeCompare(a.operationalTime);
              return (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0);
            }).slice(0, LOG_RITASE_LIMIT).map((trip: any) => (
              <div key={trip.id} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl border border-slate-800 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all cursor-default group">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-800 rounded-lg flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                  <ClipboardList className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] sm:text-sm font-bold text-slate-200 truncate">{trip.driverName}</p>
                  <div className="flex items-center gap-1 sm:gap-2">
                    <p className="text-[8px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-tight whitespace-nowrap">{trip.upt}</p>
                    <span className="text-[8px] text-slate-700">•</span>
                    <p className="text-[8px] sm:text-[10px] text-emerald-600 font-mono font-bold tracking-tighter">{trip.vehiclePlate}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] sm:text-xs font-bold text-slate-300">{trip.tripCount} Rit</p>
                  <p className="text-[8px] sm:text-[9px] text-slate-600 font-mono">
                    {trip.date ? format(new Date(trip.date.replace(/-/g, '/')), 'dd MMM') : "-"}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <Button variant="ghost" onClick={onAddClick} className="w-full mt-6 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-emerald-500 font-sans">
            Lihat Semua Data Ritase
          </Button>
        </Card>

        <Card className="lg:col-span-1 p-6 bg-slate-900 border-slate-800 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-slate-200">Aktivitas 7 Hari</h3>
            <div className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">TREND RITASE</div>
          </div>
          
          <div className="flex-1 min-h-[250px] w-full min-w-0 flex items-center justify-center">
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={last7Days} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id={TREND_RITASE_CHART_GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(str) => {
                    try {
                      return format(new Date(str), 'EEE');
                    } catch (e) {
                      return "";
                    }
                  }}
                  stroke="#475569"
                  fontSize={10}
                  fontWeight="bold"
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  stroke="#475569"
                  fontSize={10}
                  fontWeight="bold"
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="ritase" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill={`url(#${TREND_RITASE_CHART_GRADIENT_ID})`} 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-800">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500">
              <span>Total 7 Hari Terakhir</span>
              <span className="text-emerald-500">{last7Days.reduce((acc, d) => acc + d.ritase, 0)} Rit</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
