import React, { useState } from "react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { query, collection, where, getAggregateFromServer, count, sum } from "firebase/firestore";
import { 
  FileSpreadsheet, 
  ClipboardList, 
  Loader2, 
  RefreshCw 
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { db } from "../../lib/firebase";
import { exportTripsToExcel } from "../../lib/excelExport";
import { Button, Input, Select, Card, Badge } from "../master-data/components/SharedUI";
import { ReportsViewProps } from "./ritaseTypes";

export function ReportsView({ 
  trips, 
  onNotify, 
  settings, 
  upts = [], 
  users = [], 
  profile, 
  tripFilterRange, 
  setTripFilterRange, 
  reportsCache, 
  setReportsCache,
  logActivity
}: ReportsViewProps) {
  const isWeightEnabled = settings?.enableWeight !== false;
  const showVolume = settings?.showVolume !== false;

  const [reportType, setReportType] = useState<"daily" | "monthly" | "yearly">("daily");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedYear, setSelectedYear] = useState(format(new Date(), 'yyyy'));

  const [loadingAggregates, setLoadingAggregates] = useState(false);

  const currentKey = `${reportType}-${
    reportType === 'daily' ? selectedDate : (reportType === 'monthly' ? selectedMonth : selectedYear)
  }-${profile?.role || ''}`;

  const isCached = reportsCache && reportsCache.key === currentKey;
  const displayAggregatedRitase = isCached ? reportsCache.ritase : null;
  const displayAggregatedTonnage = isCached ? reportsCache.tonnage : null;
  const displayAggregatedVolume = isCached ? reportsCache.volume : null;
  const displayMonthlyBreakdown = isCached ? (reportsCache.monthlyBreakdown || []) : [];

  // Reusable aggregation helper function
  const getTripAggregatesByDateRange = async (startDate: string, endDate: string, userProfile: any) => {
    let q = query(
      collection(db, "trips"),
      where("date", ">=", startDate),
      where("date", "<=", endDate)
    );
    
    if (userProfile?.role === 'user') {
      const assignedUptName = userProfile?.assigned_upt_name || userProfile?.uptName || userProfile?.upt || "";
      if (assignedUptName) {
        q = query(q, where("upt", "==", assignedUptName));
      }
    }
    
    try {
      const snapshot = await getAggregateFromServer(q, {
        totalTrips: count(),
        totalTonnage: sum("tonnage"),
        totalVolume: sum("volume"),
        totalTripCount: sum("tripCount")
      });
      
      const data = snapshot.data();
      return {
        ritase: Number(data.totalTripCount || data.totalTrips || 0),
        tonnage: Number(data.totalTonnage || 0),
        volume: Number(data.totalVolume || 0),
        docCount: Number(data.totalTrips || 0)
      };
    } catch (error) {
      console.error("Aggregation error for range:", startDate, "to", endDate, error);
      if (error instanceof Error && (error.message.includes("quota") || error.message.includes("Quota"))) {
        onNotify('error', "Batas kuota database tercapai saat mengambil data laporan.");
      }
      return {
        ritase: 0,
        tonnage: 0,
        volume: 0,
        docCount: 0
      };
    }
  };

  const handleCalculateReport = async () => {
    setLoadingAggregates(true);
    try {
      let dataToCache: any = null;
      if (reportType === "daily") {
        const res = await getTripAggregatesByDateRange(selectedDate, selectedDate, profile);
        dataToCache = {
          key: currentKey,
          ritase: res.ritase,
          tonnage: res.tonnage,
          volume: res.volume,
          monthlyBreakdown: []
        };
        if (tripFilterRange.start !== selectedDate || tripFilterRange.end !== selectedDate) {
          setTripFilterRange({ start: selectedDate, end: selectedDate });
        }
      } else if (reportType === "monthly") {
        const date = new Date(selectedMonth + "-01");
        const start = format(startOfMonth(date), 'yyyy-MM-dd');
        const end = format(endOfMonth(date), 'yyyy-MM-dd');
        const res = await getTripAggregatesByDateRange(start, end, profile);
        dataToCache = {
          key: currentKey,
          ritase: res.ritase,
          tonnage: res.tonnage,
          volume: res.volume,
          monthlyBreakdown: []
        };
        if (tripFilterRange.start !== start || tripFilterRange.end !== end) {
          setTripFilterRange({ start, end });
        }
      } else if (reportType === "yearly") {
        const yearVal = parseInt(selectedYear);
        const promises = [];
        const indonesianMonths = [
          "Januari", "Februari", "Maret", "April", "Mei", "Juni",
          "Juli", "Agustus", "September", "Oktober", "November", "Desember"
        ];
        for (let m = 0; m < 12; m++) {
          const start = format(new Date(yearVal, m, 1), 'yyyy-MM-dd');
          const end = format(endOfMonth(new Date(yearVal, m, 1)), 'yyyy-MM-dd');
          promises.push(
            getTripAggregatesByDateRange(start, end, profile).then(res => ({
              monthIndex: m,
              monthName: indonesianMonths[m],
              ...res
            }))
          );
        }
        const results = await Promise.all(promises);
        
        const sumRitase = results.reduce((sum, item) => sum + item.ritase, 0);
        const sumTonnage = results.reduce((sum, item) => sum + item.tonnage, 0);
        const sumVolume = results.reduce((sum, item) => sum + item.volume, 0);
        
        dataToCache = {
          key: currentKey,
          ritase: sumRitase,
          tonnage: sumTonnage,
          volume: sumVolume,
          monthlyBreakdown: results
        };

        const yearStart = format(startOfYear(new Date(yearVal, 0, 1)), 'yyyy-MM-dd');
        const yearEnd = format(endOfYear(new Date(yearVal, 0, 1)), 'yyyy-MM-dd');
        if (tripFilterRange.start !== yearStart || tripFilterRange.end !== yearEnd) {
          setTripFilterRange({ start: yearStart, end: yearEnd });
        }
      }
      
      setReportsCache(dataToCache);
      onNotify('success', 'Laporan berhasil diperbarui.');
    } catch (error) {
      console.error("Gagal mematikan/memuat agregasi laporan:", error);
      onNotify('error', 'Gagal memproses agregasi laporan.');
    } finally {
      setLoadingAggregates(false);
    }
  };

  const getFilteredTrips = () => {
    if (reportType === "daily") {
      return trips.filter((t: any) => t.date === selectedDate);
    } else if (reportType === "monthly") {
      return trips.filter((t: any) => t.date.startsWith(selectedMonth));
    } else {
      return trips.filter((t: any) => t.date.startsWith(selectedYear));
    }
  };

  const filtered = getFilteredTrips();
  const title = reportType === "daily" ? `Laporan Harian ${selectedDate}` : reportType === "monthly" ? `Laporan Bulanan ${selectedMonth}` : `Laporan Tahunan ${selectedYear}`;

  const summaryByUpt = filtered.reduce((acc: any, t: any) => {
    acc[t.upt] = (acc[t.upt] || 0) + (t.tripCount || 1);
    return acc;
  }, {});

  // UPT Coverage Logic
  const submittedUptNames = Object.keys(summaryByUpt);
  const totalUptCount = upts.length;
  const submittedCount = submittedUptNames.length;
  const missingUpts = upts.filter((u: any) => !submittedUptNames.includes(u.name));

  const summaryByVehicleType = filtered.reduce((acc: any, t: any) => {
    acc[t.vehicleType || "Lainnya"] = (acc[t.vehicleType || "Lainnya"] || 0) + (t.tripCount || 1);
    return acc;
  }, {});

  // Assign screen-displayed values strictly from aggregated values (if cached and calculated) or 0
  const displayRitase = isCached ? (displayAggregatedRitase ?? 0) : 0;
  const displayTonnage = isCached ? (displayAggregatedTonnage ?? 0) : 0;
  const displayVolume = isCached ? (displayAggregatedVolume ?? 0) : 0;

  const handleExportExcel = async () => {
    if (!isCached) {
      onNotify('error', 'Silakan tampilkan laporan terlebih dahulu sebelum mengekspor data');
      return;
    }
    if (filtered.length === 0) {
      onNotify('error', 'Tidak ada data detail untuk periode terpilih');
      return;
    }
    try {
      const fileName = title.replace(/\s/g, '_');
      await exportTripsToExcel(filtered, fileName, users);

      // Log Activity: Export Excel
      logActivity(
        'sistem', 
        'ekspor_excel', 
        'Laporan', 
        `Ekspor laporan Excel: ${title}`,
        {
          metadata: { recordCount: filtered.length, reportType, title },
          profile
        }
      );

      onNotify('success', 'Laporan Excel berhasil diunduh. Data tetap tersimpan di dalam sistem.');
    } catch (e) {
      onNotify('error', 'Gagal mengunduh laporan Excel');
    }
  };

  const handleExportPdf = () => {
    if (!isCached) {
      onNotify('error', 'Silakan tampilkan laporan terlebih dahulu sebelum mengekspor data');
      return;
    }
    if (filtered.length === 0) {
      onNotify('error', 'Tidak ada data detail untuk periode terpilih');
      return;
    }
    
    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(18);
      doc.text("Laporan Ritase Pengangkutan Sampah", 14, 22);
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Periode: ${title}`, 14, 30);
      doc.text(`Dicetak pada: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 35);
      
      // Summary
      doc.setTextColor(0);
      doc.setFontSize(14);
      doc.text("Ringkasan Data", 14, 50);
      
      const summaryData = [
        ["Total Ritase", `${displayRitase} Rit`],
        ...(isWeightEnabled ? [["Total Tonase", `${(displayTonnage / 1000).toFixed(2)} Ton`]] : []),
        ...(showVolume ? [["Total Volume", `${displayVolume.toFixed(2)} m3`]] : [])
      ];
      
      autoTable(doc, {
        startY: 55,
        head: [['Indikator', 'Nilai']],
        body: summaryData,
        theme: 'grid',
        headStyles: { fillColor: '#10b981', textColor: 255 }
      });
      
      // Breakdown by UPT
      doc.text("Ringkasan per UPT", 14, (doc as any).lastAutoTable.finalY + 15);
      const uptData = Object.entries(summaryByUpt).map(([upt, rit]) => [upt, rit + " Rit"]);
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [['UPT', 'Ritase']],
        body: uptData,
        theme: 'striped',
        headStyles: { fillColor: '#10b981', textColor: 255 }
      });

      // Data Table
      doc.addPage();
      doc.text("Detail Log Ritase", 14, 22);
      
      const tableBody = filtered.map(t => [
        t.date,
        t.operationalTime || "-",
        t.upt,
        t.driverName,
        t.vehiclePlate,
        t.tripCount + " Rit"
      ]);
      
      autoTable(doc, {
        startY: 30,
        head: [['Tanggal', 'Jam', 'UPT', 'Sopir', 'Plat', 'Ritase']],
        body: tableBody,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: '#10b981', textColor: 255 }
      });

      doc.save(`${title.replace(/\s/g, '_')}.pdf`);

      // Log Activity: Export PDF
      logActivity(
        'sistem', 
        'ekspor_pdf', 
        'Laporan', 
        `Ekspor laporan PDF: ${title}`,
        {
          metadata: { recordCount: filtered.length, reportType, title },
          profile
        }
      );

      onNotify('success', 'Laporan PDF berhasil diunduh');
    } catch (error) {
      console.error(error);
      onNotify('error', 'Gagal mengunduh laporan PDF');
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Laporan & Rekapitulasi</h2>
          <p className="text-slate-500 text-sm">Analisa dan unduh rekapitulasi data pengangkutan.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="p-6 flex flex-col gap-6 bg-slate-900 border-slate-800 lg:col-span-1 h-fit">
          <div className="flex flex-col gap-4">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Jenis Laporan</label>
            <div className="flex flex-col gap-2">
              <button 
                type="button"
                onClick={() => setReportType("daily")}
                className={`px-4 py-3 rounded-xl border text-sm font-bold transition-all text-left flex items-center justify-between ${reportType === "daily" ? "bg-emerald-600/10 text-emerald-400 border-emerald-500/30" : "bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-700"}`}
              >
                Harian
                {reportType === "daily" && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
              </button>
              <button 
                type="button"
                onClick={() => setReportType("monthly")}
                className={`px-4 py-3 rounded-xl border text-sm font-bold transition-all text-left flex items-center justify-between ${reportType === "monthly" ? "bg-emerald-600/10 text-emerald-400 border-emerald-500/30" : "bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-700"}`}
              >
                Bulanan
                {reportType === "monthly" && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
              </button>
              <button 
                type="button"
                onClick={() => setReportType("yearly")}
                className={`px-4 py-3 rounded-xl border text-sm font-bold transition-all text-left flex items-center justify-between ${reportType === "yearly" ? "bg-emerald-600/10 text-emerald-400 border-emerald-500/30" : "bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-700"}`}
              >
                Tahunan
                {reportType === "yearly" && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Pilih Periode</label>
            {reportType === "daily" && <Input type="date" value={selectedDate} onChange={(e: any) => setSelectedDate(e.target.value)} />}
            {reportType === "monthly" && <Input type="month" value={selectedMonth} onChange={(e: any) => setSelectedMonth(e.target.value)} />}
            {reportType === "yearly" && (
              <Select 
                value={selectedYear} 
                onChange={(e: any) => setSelectedYear(e.target.value)} 
                options={Array.from({ length: 5 }).map((_, i) => ({ value: (new Date().getFullYear() - i).toString(), label: (new Date().getFullYear() - i).toString() }))}
              />
            )}
            <Button 
              onClick={handleCalculateReport} 
              disabled={loadingAggregates}
              className="w-full mt-2 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-950/20 text-xs uppercase tracking-wider flex items-center justify-center gap-2"
            >
              {loadingAggregates ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  {reportType === "yearly" ? "Tampilkan Rekap Tahunan" : "Tampilkan Laporan"}
                </>
              )}
            </Button>
          </div>

          <div className="pt-6 border-t border-slate-800 flex flex-col gap-3">
             {profile?.role === 'admin' && (
                <>
                  <Button onClick={handleExportExcel} className="w-full py-4 text-xs font-bold uppercase tracking-widest gap-3">
                    <FileSpreadsheet className="w-5 h-5" /> Export Excel
                  </Button>
                  <Button onClick={handleExportPdf} variant="secondary" className="w-full py-4 text-xs font-bold uppercase tracking-widest gap-3">
                    <ClipboardList className="w-5 h-5" /> Export PDF
                  </Button>
                </>
             )}
          </div>
        </Card>

        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-slate-900/50 border-slate-800">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Ritase</p>
              <h4 className="text-2xl font-bold text-white">
                {loadingAggregates ? (
                  <Loader2 className="w-5 h-5 animate-spin inline-block text-slate-400" />
                ) : (
                  <>
                    {displayRitase} <span className="text-sm font-medium text-slate-500">Rit</span>
                  </>
                )}
              </h4>
            </Card>
            {isWeightEnabled && (
              <Card className="p-4 bg-slate-900/50 border-slate-800">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Tonase</p>
                <h4 className="text-2xl font-bold text-emerald-500">
                  {loadingAggregates ? (
                    <Loader2 className="w-5 h-5 animate-spin inline-block text-slate-400" />
                  ) : (
                    <>
                      {(displayTonnage / 1000).toFixed(1)} <span className="text-sm font-medium text-slate-500">Ton</span>
                    </>
                  )}
                </h4>
              </Card>
            )}
            {showVolume && (
              <Card className="p-4 bg-slate-900/50 border-slate-800">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Volume</p>
                <h4 className="text-2xl font-bold text-blue-500">
                  {loadingAggregates ? (
                    <Loader2 className="w-5 h-5 animate-spin inline-block text-slate-400" />
                  ) : (
                    <>
                      {displayVolume.toFixed(1)} <span className="text-sm font-medium text-slate-500">m³</span>
                    </>
                  )}
                </h4>
              </Card>
            )}
            <Card className="p-4 bg-slate-900/50 border-slate-800 relative group overflow-hidden">
               <div className="flex items-center justify-between mb-1">
                 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Input UPT</p>
                 <Badge variant={submittedCount === totalUptCount ? "success" : submittedCount > 0 ? "user" : "status"}>
                    {submittedCount} / {totalUptCount}
                 </Badge>
               </div>
               <h4 className="text-2xl font-bold text-white mb-2">{submittedCount === totalUptCount ? "Selesai" : `${submittedCount} Input`}</h4>
               <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${(submittedCount / (totalUptCount || 1)) * 100}%` }} />
               </div>
               
               {missingUpts.length > 0 && (
                 <div className="mt-4 pt-3 border-t border-slate-800 flex flex-col gap-2">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Wilayah Belum Input:</p>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto scrollbar-hide">
                       {missingUpts.map((u: any) => (
                         <span key={u.id} className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-slate-800 text-slate-400 group-hover:text-slate-300 transition-colors uppercase truncate">
                           {u.name}
                         </span>
                       ))}
                    </div>
                 </div>
               )}
            </Card>
          </div>

          <Card className="bg-slate-900 border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-950/20 flex items-center justify-between">
               <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ringkasan per Wilayah UPT</h3>
               <Badge variant="user">{filtered.length} {filtered.length === 2000 ? "Records (Capped)" : "Records"}</Badge>
            </div>
            <div className="p-4 overflow-x-auto">
               <table className="w-full text-left">
                 <thead className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    <tr>
                      <th className="pb-3 px-2">UPT</th>
                      <th className="pb-3 px-2 text-right">Ritase</th>
                      <th className="pb-3 px-2 text-right">Progress</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-800/50">
                   {isCached ? (
                     Object.entries(summaryByUpt).length > 0 ? Object.entries(summaryByUpt).sort((a: any, b: any) => b[1] - a[1]).map(([upt, rit]: any) => {
                       const percentage = displayRitase > 0 ? (rit / displayRitase) * 100 : 0;
                       return (
                         <tr key={upt} className="group">
                           <td className="py-3 px-2 text-sm font-bold text-slate-300">{upt}</td>
                           <td className="py-3 px-2 text-sm font-mono text-emerald-500 text-right">{rit} Rit</td>
                           <td className="py-3 px-2 text-right min-w-[120px]">
                             <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                               <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${percentage}%` }} />
                             </div>
                           </td>
                         </tr>
                       );
                     }) : (
                       <tr>
                         <td colSpan={3} className="py-8 text-center text-xs text-slate-600 italic">Tidak ada data detail untuk periode ini</td>
                       </tr>
                     )
                   ) : (
                     <tr>
                       <td colSpan={3} className="py-8 text-center text-xs text-slate-500 italic font-medium">
                         Silakan klik tombol "Tampilkan Laporan" untuk memproses data UPT
                       </td>
                     </tr>
                   )}
                 </tbody>
               </table>
            </div>
          </Card>

          <Card className="bg-slate-900 border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-950/20">
               <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ringkasan per Jenis Kendaraan</h3>
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
               {isCached ? (
                 <>
                   {Object.entries(summaryByVehicleType).map(([type, rit]: any) => (
                     <div key={type} className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter mb-1 truncate">{type}</p>
                        <p className="text-xl font-bold text-white">{rit} <span className="text-[10px] text-slate-500">Rit</span></p>
                     </div>
                   ))}
                   {Object.entries(summaryByVehicleType).length === 0 && (
                     <div className="col-span-full py-4 text-center text-xs text-slate-600 italic">Data kosong</div>
                   )}
                 </>
               ) : (
                 <div className="col-span-full py-4 text-center text-xs text-slate-500 italic font-medium">
                    Silakan klik tombol "Tampilkan Laporan" untuk memproses data jenis kendaraan
                 </div>
               )}
            </div>
          </Card>

          {/* Yearly Month-by-Month breakdown with accurate aggregates */}
          {reportType === "yearly" && (
            <Card className="bg-slate-900 border-slate-800 overflow-hidden">
              <div className="p-4 border-b border-slate-800 bg-slate-950/20 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Detail Ritase & Tonase per Bulan</h3>
                {loadingAggregates && <Loader2 className="w-4 h-4 animate-spin text-slate-500" />}
              </div>
              <div className="p-4 overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    <tr>
                      <th className="pb-3 px-2">Bulan</th>
                      <th className="pb-3 px-2 text-right">Ritase</th>
                      {isWeightEnabled && <th className="pb-3 px-2 text-right">Tonase</th>}
                      {showVolume && <th className="pb-3 px-2 text-right">Volume</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {isCached && displayMonthlyBreakdown.length > 0 ? displayMonthlyBreakdown.map((item) => (
                      <tr key={item.monthIndex} className="group hover:bg-slate-850/35 transition-colors">
                        <td className="py-3 px-2 text-sm font-bold text-slate-300">{item.monthName}</td>
                        <td className="py-3 px-2 text-sm font-mono text-emerald-500 text-right">{item.ritase} Rit</td>
                        {isWeightEnabled && (
                          <td className="py-3 px-2 text-sm font-mono text-emerald-400 text-right">
                            {(item.tonnage / 1000).toFixed(1)} Ton
                          </td>
                        )}
                        {showVolume && (
                          <td className="py-3 px-2 text-sm font-mono text-blue-500 text-right">
                            {item.volume.toFixed(1)} m³
                          </td>
                        )}
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={isWeightEnabled ? (showVolume ? 4 : 3) : (showVolume ? 3 : 2)} className="py-8 text-center text-xs text-slate-500 italic font-medium">
                          {loadingAggregates ? "Sedang memposting data..." : "Silakan klik tombol \"Tampilkan Rekap Tahunan\" untuk memproses"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}
