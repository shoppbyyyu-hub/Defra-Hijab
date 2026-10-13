import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  Package,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { formatRp, formatRpShort } from './adminUtils.ts';
import { SalesTrendChart, OrderCompositionDonut } from './AdminCharts.tsx';
import categoryFallback from '../../assets/images/cat_voal_luxury_1791700549401.jpg';

interface MetricsTabProps {
  dashboardData: any;
  onRefresh: (startDate?: string, endDate?: string) => void;
  onNavigateTab?: (tab: string, filter?: string) => void;
}

export const AdminMetricsTab: React.FC<MetricsTabProps> = ({
  dashboardData,
  onRefresh,
  onNavigateTab
}) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activePreset, setActivePreset] = useState<'ALL' | 'THIS_MONTH' | 'LAST_7_DAYS' | 'CUSTOM'>('ALL');

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setActivePreset('CUSTOM');
    onRefresh(startDate || undefined, endDate || undefined);
  };

  const handleQuickFilter = (type: 'ALL' | 'THIS_MONTH' | 'LAST_7_DAYS') => {
    setActivePreset(type);
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    if (type === 'ALL') {
      setStartDate('');
      setEndDate('');
      onRefresh();
    } else if (type === 'THIS_MONTH') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
      setStartDate(start);
      setEndDate(todayStr);
      onRefresh(start, todayStr);
    } else if (type === 'LAST_7_DAYS') {
      const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      setStartDate(past);
      setEndDate(todayStr);
      onRefresh(past, todayStr);
    }
  };

  const m = dashboardData?.metrics || {};
  const chartSeries = dashboardData?.chartSeries || [];
  const bestSellers = dashboardData?.bestSellers || [];
  const highestProfitProducts = dashboardData?.highestProfitProducts || [];
  const lowStockWarnings = dashboardData?.lowStockWarnings || [];
  const recentOrders = dashboardData?.recentOrders || [];

  // Profit calculation and status
  const netProfit = m.netProfit || 0;
  const isNegativeProfit = netProfit < 0;

  // Real counts for action panel
  const pendingProofCount = m.pendingVerificationCount || 0;
  const lowStockCount = lowStockWarnings.length;
  const returnCount = dashboardData?.pendingReturnsCount || 0;
  const allClear = pendingProofCount === 0 && lowStockCount === 0 && returnCount === 0;

  // Donut chart status segments
  const orderSegments = [
    {
      key: 'VERIFIED',
      label: 'Selesai / Terverifikasi',
      count: m.verifiedOrdersCount || 0,
      color: '#26786C' // Teal
    },
    {
      key: 'WAITING_VERIFICATION',
      label: 'Menunggu Review Bukti',
      count: pendingProofCount,
      color: '#94691E' // Amber
    },
    {
      key: 'PROCESSING',
      label: 'Siap Dikemas / Dikirim',
      count: dashboardData?.inTransitCount || 0,
      color: '#426BC6' // Blue
    },
    {
      key: 'RETURNS',
      label: 'Retur / Komplain',
      count: returnCount,
      color: '#B33D39' // Red
    }
  ];

  // Max for relative progress bars in best sellers
  const maxSoldUnits = Math.max(1, ...bestSellers.map((b: any) => b.unitsSold || b.soldUnits || 0));
  const maxProfitVal = Math.max(1, ...highestProfitProducts.map((p: any) => p.totalProfit || p.grossProfit || 0));

  // Cost breakdown horizontal segments
  const totalCostsSum = (m.totalHPP || 0) + (m.directCosts || 0) + (m.totalOperationalExpenses || 0);

  return (
    <div className="admin-metrics space-y-4 md:space-y-6 text-[#24221F]">
      {/* HEADER & DATE RANGE CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E9E5DF]">
        <div>
          <h1 className="text-[26px] font-medium tracking-tight text-[#24221F]">Ringkasan Penjualan</h1>
          <p className="text-xs text-[#716B64] mt-0.5">
            Lihat penjualan, keuntungan, dan hal yang perlu ditangani.
          </p>
        </div>

        {/* Date Filter & Preset Controls (Liquid Glass Toolbar) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Buttons */}
          <div className="inline-flex items-center bg-white/80 backdrop-blur-[12px] p-0.5 rounded-[12px] border border-[#E9E5DF]/80 text-xs shadow-[0_2px_8px_rgba(36,34,31,.02)]">
            <button
              type="button"
              onClick={() => handleQuickFilter('ALL')}
              className={`px-3 py-1.5 rounded-[9px] font-medium transition-colors ${activePreset === 'ALL'
                ? 'bg-[#24221F] text-white shadow-xs'
                : 'text-[#716B64] hover:text-[#24221F] hover:bg-[#F6F5F2]'
                }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => handleQuickFilter('THIS_MONTH')}
              className={`px-3 py-1.5 rounded-[9px] font-medium transition-colors ${activePreset === 'THIS_MONTH'
                ? 'bg-[#24221F] text-white shadow-xs'
                : 'text-[#716B64] hover:text-[#24221F] hover:bg-[#F6F5F2]'
                }`}
            >
              Bulan Ini
            </button>
            <button
              type="button"
              onClick={() => handleQuickFilter('LAST_7_DAYS')}
              className={`px-3 py-1.5 rounded-[9px] font-medium transition-colors ${activePreset === 'LAST_7_DAYS'
                ? 'bg-[#24221F] text-white shadow-xs'
                : 'text-[#716B64] hover:text-[#24221F] hover:bg-[#F6F5F2]'
                }`}
            >
              7 Hari
            </button>
          </div>

          {/* Custom Date Form */}
          <form
            onSubmit={handleApplyFilter}
            className="flex items-center gap-1.5 bg-white/80 backdrop-blur-[12px] border border-[#E9E5DF]/80 px-3 py-1.5 rounded-[12px] shadow-[0_2px_8px_rgba(36,34,31,.02)] text-xs"
          >
            <Calendar className="w-3.5 h-3.5 text-[#716B64] shrink-0" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-xs text-[#24221F] outline-none font-sans"
              title="Tanggal Mulai"
            />
            <span className="text-[#716B64]">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-xs text-[#24221F] outline-none font-sans"
              title="Tanggal Akhir"
            />
            <button
              type="submit"
              className="ml-1 px-3 py-1 bg-[#24221F] hover:bg-[#40322B] text-white rounded-[8px] font-medium transition-colors"
            >
              Terapkan
            </button>
          </form>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BARIS PERTAMA: OVERVIEW GELAP (8 COLS) + PANEL TINDAKAN (4 COLS)          */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">

        {/* OVERVIEW 8 KOLOM: RINGKASAN PENJUALAN (Panel Gelap Charcoal -> Hitam dengan Liquid Glass & Bottom Glow) */}
        <div className="admin-sales-summary lg:col-span-8 bg-gradient-to-b from-[#181716] via-[#121110] to-[#0A0908] text-white rounded-[20px] p-6 sm:p-7 shadow-[0_12px_32px_rgba(0,0,0,0.25)] flex flex-col justify-between relative overflow-hidden border border-white/[0.08]">
          {/* Latar berwarna di belakang glass: cahaya gradient rose gold & champagne yang terlihat jelas di bagian bawah */}
          <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 w-[92%] h-48 bg-gradient-to-t from-[#E0A899]/40 via-[#E8C88B]/25 to-transparent blur-3xl pointer-events-none rounded-full" />
          <div className="absolute -bottom-10 left-[12%] w-64 h-36 bg-[#F3D8A2]/35 blur-2xl pointer-events-none rounded-full" />
          <div className="absolute -bottom-10 right-[12%] w-64 h-36 bg-[#C87A5B]/35 blur-2xl pointer-events-none rounded-full" />
          <div className="absolute bottom-0 inset-x-0 h-28 bg-gradient-to-t from-[#9C5338]/20 via-transparent to-transparent pointer-events-none" />

          {/* Top Header Row */}
          <div className="admin-sales-summary-header relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[17px] font-semibold tracking-tight text-white">
                  Ringkasan Penjualan
                </h2>
              </div>
              <p className="text-xs text-white/60 mt-0.5">
                Penjualan dan keuntungan dari pesanan yang pembayarannya sudah dikonfirmasi.
              </p>
            </div>

            <span className="font-medium text-[#F3D8A2] shadow-xs shrink-0">
              {startDate || endDate ? `${startDate || 'Awal'} s/d ${endDate || 'Kini'}` : 'Semua Periode'}
            </span>
          </div>

          {/* 3 KPI Glass Panels: fill putih 6-10%, backdrop blur 16px, border putih 15%, highlight atas, shadow halus, radius 14px */}
          <div className="admin-metric-grid relative z-10 grid grid-cols-2 sm:grid-cols-3 gap-3 my-4 md:my-5">
            {/* KPI 1: Total Omzet */}
            <div className="rounded-[14px] bg-white/[0.08] backdrop-blur-[16px] border border-white/[0.15] p-4.5 sm:p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25),0_8px_20px_-4px_rgba(0,0,0,0.4)] flex flex-col justify-between transition-all duration-200 hover:bg-white/[0.11]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-medium tracking-wide text-white/75 uppercase">
                  Total Omzet
                </span>
                <div className="w-7 h-7 rounded-[9px] bg-white/[0.10] border border-white/[0.15] flex items-center justify-center text-[#F3D8A2]">
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
              </div>
              <div>
                <p className="text-[22px] sm:text-[24px] lg:text-[26px] font-bold text-white tracking-tight font-sans tabular-nums leading-tight">
                  {formatRp(m.totalOmzet || 0)}
                </p>
                <p className="text-[11px] text-[#E0A899] font-medium mt-1">
                  {m.verifiedOrdersCount || 0} pesanan terverifikasi
                </p>
              </div>
            </div>

            {/* KPI 2: Unit Terjual */}
            <div className="rounded-[14px] bg-white/[0.08] backdrop-blur-[16px] border border-white/[0.15] p-4.5 sm:p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25),0_8px_20px_-4px_rgba(0,0,0,0.4)] flex flex-col justify-between transition-all duration-200 hover:bg-white/[0.11]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-medium tracking-wide text-white/75 uppercase">
                  Unit Terjual
                </span>
                <div className="w-7 h-7 rounded-[9px] bg-white/[0.10] border border-white/[0.15] flex items-center justify-center text-[#F3D8A2]">
                  <Package className="w-3.5 h-3.5" />
                </div>
              </div>
              <div>
                <p className="text-[22px] sm:text-[24px] lg:text-[26px] font-bold text-white tracking-tight font-sans tabular-nums leading-tight">
                  {m.totalUnitsSold || 0}
                  <span className="text-[13px] font-normal text-white/60 ml-1.5 font-sans">pcs</span>
                </p>
                <p className="text-[11px] text-[#F3D8A2] font-medium mt-1">
                  Busana keluar gudang
                </p>
              </div>
            </div>

            {/* KPI 3: Keuntungan Kotor */}
            <div className="rounded-[14px] bg-white/[0.08] backdrop-blur-[16px] border border-white/[0.15] p-4.5 sm:p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25),0_8px_20px_-4px_rgba(0,0,0,0.4)] flex flex-col justify-between transition-all duration-200 hover:bg-white/[0.11]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-medium tracking-wide text-white/75 uppercase">
                  Keuntungan Kotor
                </span>
                <div className="w-7 h-7 rounded-[9px] bg-white/[0.10] border border-white/[0.15] flex items-center justify-center text-[#2DD4BF]">
                  <Layers className="w-3.5 h-3.5" />
                </div>
              </div>
              <div>
                <p className="text-[22px] sm:text-[24px] lg:text-[26px] font-bold text-white tracking-tight font-sans tabular-nums leading-tight">
                  {formatRp(m.grossProfit || 0)}
                </p>
                <p className="text-[11px] text-[#2DD4BF] font-medium mt-1">
                  Margin FIFO riil
                </p>
              </div>
            </div>
          </div>

          {/* Liquid Glass Footer Bar for Net Profit */}
          <div className="admin-net-profit relative z-10 rounded-[12px] bg-white/[0.06] backdrop-blur-[16px] border border-white/[0.12] px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)] text-xs">
            <span className="text-white/80 font-medium">
              Keuntungan Bersih Setelah Biaya Operasional:
            </span>
            <span
              className={`admin-net-profit-value font-sans font-bold tabular-nums px-3 py-1 rounded-[8px] text-xs self-start sm:self-auto ${isNegativeProfit
                ? 'text-rose-300'
                : 'text-[#2DD4BF]'
                }`}
            >
              {formatRp(netProfit)}
            </span>
          </div>
        </div>

        {/* PANEL TINDAKAN 4 KOLOM ("Perlu perhatian", bersih tanpa kotak berlebihan) */}
        <div className="lg:col-span-4 bg-white border border-[#E9E5DF] rounded-[20px] p-6 shadow-[0_6px_24px_rgba(36,34,31,.04)] flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E9E5DF]">
              <div>
                <h2 className="text-[15px] font-medium text-[#24221F]">Perlu Perhatian</h2>
                <p className="text-xs text-[#716B64] mt-0.5">Tindakan operasional prioritas</p>
              </div>
              <span className="text-xs text-[#716B64] font-sans tabular-nums">
                {pendingProofCount + lowStockCount + returnCount} item aktif
              </span>
            </div>

            {allClear ? (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-[#E8F3EF] text-[#26786C] flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-[#24221F]">Semua tertangani</p>
                <p className="text-xs text-[#716B64] max-w-xs">
                  Tidak ada bukti menunggu review, komplain retur aktif, atau stok variasi yang habis.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#E9E5DF]/60">
                {/* 1. Pending payment proofs */}
                <button
                  type="button"
                  onClick={() => onNavigateTab && onNavigateTab('ORDERS', 'WAITING_VERIFICATION')}
                  className="w-full flex items-center justify-between py-3 px-2 rounded-[10px] hover:bg-[#FAF9F7] transition-colors text-left group"
                >
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-[#94691E] shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-[#24221F] group-hover:text-[#87533F] transition-colors">
                        Verifikasi Pembayaran
                      </p>
                      <p className="text-[11px] text-[#716B64]">Perlu verifikasi mutasi rekening</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {pendingProofCount > 0 ? (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-[6px] tabular-nums font-sans bg-[#FEF7EA] text-[#94691E]">
                        {pendingProofCount}
                      </span>
                    ) : (
                      <span className="text-xs text-[#716B64] font-sans tabular-nums">0</span>
                    )}
                    <ChevronRight className="w-4 h-4 text-[#716B64] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>

                {/* 2. Low stock warnings */}
                <button
                  type="button"
                  onClick={() => onNavigateTab && onNavigateTab('STOCK')}
                  className="w-full flex items-center justify-between py-3 px-2 rounded-[10px] hover:bg-[#FAF9F7] transition-colors text-left group"
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-[#B33D39] shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-[#24221F] group-hover:text-[#B33D39] transition-colors">
                        Stok Menipis / Habis
                      </p>
                      <p className="text-[11px] text-[#716B64]">Barang yang stoknya hampir habis</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {lowStockCount > 0 ? (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-[6px] tabular-nums font-sans bg-[#FAECEA] text-[#B33D39]">
                        {lowStockCount}
                      </span>
                    ) : (
                      <span className="text-xs text-[#716B64] font-sans tabular-nums">0</span>
                    )}
                    <ChevronRight className="w-4 h-4 text-[#716B64] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>

                {/* 3. Return requests */}
                <button
                  type="button"
                  onClick={() => onNavigateTab && onNavigateTab('RETURNS')}
                  className="w-full flex items-center justify-between py-3 px-2 rounded-[10px] hover:bg-[#FAF9F7] transition-colors text-left group"
                >
                  <div className="flex items-center gap-3">
                    <RotateCcw className="w-4 h-4 text-[#426BC6] shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-[#24221F] group-hover:text-[#426BC6] transition-colors">
                        Pengajuan Retur Baru
                      </p>
                      <p className="text-[11px] text-[#716B64]">Butuh pemeriksaan bukti komplain</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {returnCount > 0 ? (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-[6px] tabular-nums font-sans bg-blue-50 text-[#426BC6]">
                        {returnCount}
                      </span>
                    ) : (
                      <span className="text-xs text-[#716B64] font-sans tabular-nums">0</span>
                    )}
                    <ChevronRight className="w-4 h-4 text-[#716B64] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-[#E9E5DF] text-right">
            <span className="text-[11px] text-[#716B64]">Data diperbarui secara real-time</span>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* BARIS KEDUA: TREN PENJUALAN (8 COLS) + KOMPOSISI PESANAN / DONUT (4 COLS)  */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">

        {/* Tren Penjualan 8 kolom (Area chart bergradient) */}
        <div className="lg:col-span-8 bg-white border border-[#E9E5DF] rounded-[20px] p-6 shadow-[0_6px_24px_rgba(36,34,31,.04)] flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[#E9E5DF]">
            <div>
              <h2 className="text-[15px] font-medium text-[#24221F]">Tren Penjualan &amp; Keuntungan Kotor</h2>
              <p className="text-xs text-[#716B64] mt-0.5">
                Penjualan dan keuntungan kotor setiap hari.
              </p>
            </div>
            <span className="text-xs text-[#716B64] font-medium font-sans tabular-nums">
              {chartSeries.length} titik transaksi
            </span>
          </div>

          <div className="py-2">
            <SalesTrendChart data={chartSeries} />
          </div>

          <div className="pt-3 border-t border-[#E9E5DF] flex items-center justify-between text-xs text-[#716B64]">
            <span></span>
            <span className="text-[#87533F] font-medium">Keuntungan kotor dihitung dari penjualan setelah diskon dikurangi modal barang terjual.</span>
          </div>
        </div>

        {/* Distribusi 4 kolom (Donut Chart Komposisi Pesanan) */}
        <div className="lg:col-span-4 bg-white border border-[#E9E5DF] rounded-[20px] p-6 shadow-[0_6px_24px_rgba(36,34,31,.04)] flex flex-col justify-between">
          <div className="pb-3 border-b border-[#E9E5DF]">
            <h2 className="text-[15px] font-medium text-[#24221F]">Komposisi Pesanan</h2>
            <p className="text-xs text-[#716B64] mt-0.5">Distribusi status pemenuhan pesanan</p>
          </div>

          <div className="py-2">
            <OrderCompositionDonut
              ordersCount={m.totalOrders || 0}
              segments={orderSegments}
            />
          </div>

          <div className="pt-3 border-t border-[#E9E5DF] text-center">
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* BARIS KETIGA: RINCIAN HASIL (4 COLS) + PRODUK TERLARIS (4 COLS) + Keuntungan (4) */}
      {/* ========================================================================= */}
      <div className="admin-performance-panels admin-metric-grid grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5 items-stretch">

        {/* Panel Rincian Hasil 4 kolom (Baris Bersih & Divider Tipis Tanpa Kotak) */}
        <div className="admin-performance-card bg-white border border-[#E9E5DF] rounded-[20px] p-6 shadow-[0_6px_24px_rgba(36,34,31,.04)] flex flex-col justify-between">
          <div className="space-y-4">
            <div className="pb-3 border-b border-[#E9E5DF]">
              <h2 className="text-[15px] font-medium text-[#24221F]">Rincian Hasil</h2>
              <p className="text-xs text-[#716B64] mt-0.5">Ringkasan beban dan keuntungan bersih</p>
            </div>

            <div className="divide-y divide-[#E9E5DF]/60 text-xs">
              <div className="flex items-center justify-between py-2.5">
                <span className="text-[#716B64]">HPP FIFO</span>
                <span className="font-sans font-medium text-[#24221F] tabular-nums">{formatRp(m.totalHPP || 0)}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-[#716B64]">Biaya Langsung</span>
                <span className="font-sans font-medium text-[#24221F] tabular-nums">{formatRp(m.directCosts || 0)}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-[#716B64]">Biaya Operasional</span>
                <span className="font-sans font-medium text-[#24221F] tabular-nums">{formatRp(m.totalOperationalExpenses || 0)}</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="font-semibold text-[#24221F]">Keuntungan Bersih</span>
                <span className={`font-sans font-bold text-sm tabular-nums ${isNegativeProfit ? 'text-[#B33D39]' : 'text-[#26786C]'}`}>
                  {formatRp(netProfit)}
                </span>
              </div>
            </div>

            {/* Horizontal cost progress bar */}
            {totalCostsSum > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="h-1.5 w-full bg-[#F6F5F2] rounded-full overflow-hidden flex">
                  <div
                    style={{ width: `${((m.totalHPP || 0) / totalCostsSum) * 100}%` }}
                    className="bg-[#DCC39B]"
                    title="HPP"
                  />
                  <div
                    style={{ width: `${((m.directCosts || 0) / totalCostsSum) * 100}%` }}
                    className="bg-[#87533F]"
                    title="Biaya Langsung"
                  />
                  <div
                    style={{ width: `${((m.totalOperationalExpenses || 0) / totalCostsSum) * 100}%` }}
                    className="bg-[#716B64]"
                    title="Operasional"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-[#E9E5DF]">
            <button
              type="button"
              onClick={() => onNavigateTab && onNavigateTab('EXPENSES')}
              className="text-xs text-[#87533F] hover:underline font-medium flex items-center gap-1"
            >
              <span>Kelola biaya operasional</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Produk Terlaris 4 kolom */}
        <div className="admin-performance-card bg-white border border-[#E9E5DF] rounded-[20px] p-6 shadow-[0_6px_24px_rgba(36,34,31,.04)] flex flex-col justify-between">
          <div className="space-y-4">
            <div className="admin-performance-header flex items-center justify-between gap-3 pb-3 border-b border-[#E9E5DF]">
              <div>
                <h2 className="text-[15px] font-medium text-[#24221F]">Produk Terlaris</h2>
                <p className="text-xs text-[#716B64] mt-0.5">Berdasarkan jumlah barang terjual</p>
              </div>
              <span className="text-xs text-[#716B64] font-sans whitespace-nowrap">5 teratas</span>
            </div>

            <div className="space-y-3">
              {bestSellers.length === 0 ? (
                <p className="text-xs text-[#716B64] py-8 text-center">Belum ada unit produk terjual.</p>
              ) : (
                bestSellers.slice(0, 5).map((p: any, idx: number) => {
                  const sold = p.soldUnits || p.unitsSold || 0;
                  const ratio = Math.min(100, Math.round((sold / maxSoldUnits) * 100));

                  return (
                    <div key={idx} className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 truncate">
                          <div className="w-9 h-9 bg-[#F6F5F2] border border-[#E9E5DF] rounded-[8px] overflow-hidden shrink-0">
                            <img
                              src={p.imageUrl || categoryFallback}
                              alt={p.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = categoryFallback;
                              }}
                            />
                          </div>
                          <span className="font-medium text-[#24221F] truncate">{p.name}</span>
                        </div>
                        <span className="font-semibold text-[#24221F] font-sans tabular-nums shrink-0">
                          {sold} pcs
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-[#FAF9F7] rounded-full overflow-hidden">
                        <div
                          style={{ width: `${ratio}%` }}
                          className="h-full bg-gradient-to-r from-[#D4A18A] to-[#87533F] rounded-full"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-[#E9E5DF]">
            <button
              type="button"
              onClick={() => onNavigateTab && onNavigateTab('PRODUCTS')}
              className="text-xs text-[#87533F] hover:underline font-medium flex items-center gap-1"
            >
              <span>Lihat semua katalog produk</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Keuntungan Produk Tertinggi 4 kolom */}
        <div className="admin-performance-card bg-white border border-[#E9E5DF] rounded-[20px] p-6 shadow-[0_6px_24px_rgba(36,34,31,.04)] flex flex-col justify-between">
          <div className="space-y-4">
            <div className="admin-performance-header flex items-center justify-between gap-3 pb-3 border-b border-[#E9E5DF]">
              <div>
                <h2 className="text-[15px] font-medium text-[#24221F]">Keuntungan Produk Tertinggi</h2>
                <p className="text-xs text-[#716B64] mt-0.5">Kontribusi margin Keuntungan kotor</p>
              </div>
              <span className="text-xs text-[#716B64] font-sans whitespace-nowrap">5 teratas</span>
            </div>

            <div className="space-y-3">
              {highestProfitProducts.length === 0 ? (
                <p className="text-xs text-[#716B64] py-8 text-center">Belum ada data Keuntungan produk.</p>
              ) : (
                highestProfitProducts.slice(0, 5).map((p: any, idx: number) => {
                  const profit = p.totalProfit || p.grossProfit || 0;
                  const ratio = Math.min(100, Math.round((Math.max(0, profit) / maxProfitVal) * 100));

                  return (
                    <div key={idx} className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 truncate">
                          <div className="w-9 h-9 bg-[#F6F5F2] border border-[#E9E5DF] rounded-[8px] overflow-hidden shrink-0">
                            <img
                              src={p.imageUrl || categoryFallback}
                              alt={p.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = categoryFallback;
                              }}
                            />
                          </div>
                          <span className="font-medium text-[#24221F] truncate">{p.name}</span>
                        </div>
                        <span className="font-semibold text-[#26786C] font-sans tabular-nums shrink-0">
                          {formatRp(profit)}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-[#FAF9F7] rounded-full overflow-hidden">
                        <div
                          style={{ width: `${ratio}%` }}
                          className="h-full bg-gradient-to-r from-[#71B5A7] to-[#26786C] rounded-full"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-[#E9E5DF]">
            <button
              type="button"
              onClick={() => onNavigateTab && onNavigateTab('FINANCE')}
              className="text-xs text-[#26786C] hover:underline font-medium flex items-center gap-1"
            >
              <span>Buka laporan keuangan lengkap</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* BARIS KEEMPAT: PESANAN TERBARU (8 COLS) + STOK RENDAH (4 COLS)            */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">

        {/* Pesanan Terbaru 8 kolom */}
        <div className="lg:col-span-8 bg-white border border-[#E9E5DF] rounded-[20px] p-6 shadow-[0_6px_24px_rgba(36,34,31,.04)] flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E9E5DF]">
              <div>
                <h2 className="text-[15px] font-medium text-[#24221F]">Pesanan Terbaru</h2>
                <p className="text-xs text-[#716B64] mt-0.5"></p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab && onNavigateTab('ORDERS')}
                className="text-xs text-[#87533F] hover:underline font-medium flex items-center gap-1"
              >
                <span>Lihat semua pesanan</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#FAF9F7] text-[#716B64] font-medium border-b border-[#E9E5DF]">
                  <tr>
                    <th className="p-3 pl-4">No. Pesanan</th>
                    <th className="p-3">Pelanggan</th>
                    <th className="p-3 text-right">Total Transaksi</th>
                    <th className="p-3">Status Bayar</th>
                    <th className="p-3 pr-4">Pengiriman</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E9E5DF]">
                  {recentOrders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-[#716B64]">
                        Belum ada pesanan terbaru tercatat.
                      </td>
                    </tr>
                  ) : (
                    recentOrders.slice(0, 5).map((o: any) => (
                      <tr key={o.id || o.orderNumber} className="hover:bg-[#FAF9F7]/60 transition-colors">
                        <td className="p-3 pl-4 font-sans font-semibold text-[#24221F]">
                          {o.orderNumber || `#${o.id?.slice(-6).toUpperCase()}`}
                        </td>
                        <td className="p-3 text-[#716B64]">
                          {o.customerName || o.shippingName || 'Pelanggan'}
                        </td>
                        <td className="p-3 font-sans font-semibold text-[#24221F] text-right tabular-nums">
                          {formatRp(o.totalAmount || o.subtotal)}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-[6px] text-[11px] font-semibold ${o.paymentStatus === 'VERIFIED'
                              ? 'bg-[#E8F3EF] text-[#26786C]'
                              : o.paymentStatus === 'WAITING_VERIFICATION'
                                ? 'bg-[#FEF7EA] text-[#94691E]'
                                : 'bg-[#FAECEA] text-[#B33D39]'
                              }`}
                          >
                            {o.paymentStatus === 'VERIFIED'
                              ? 'Terverifikasi'
                              : o.paymentStatus === 'WAITING_VERIFICATION'
                                ? 'Menunggu Review'
                                : o.paymentStatus}
                          </span>
                        </td>
                        <td className="p-3 pr-4 text-[#716B64] font-medium text-[11px]">
                          {o.fulfillmentStatus || 'PACKED'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-3 border-t border-[#E9E5DF] text-xs text-[#716B64]">
            Menampilkan data pesanan langsung dari sistem store Defra Hijab
          </div>
        </div>

        {/* Peringatan Stok Rendah 4 kolom (Baris Bersih & Divider Tipis Tanpa Kotak) */}
        <div className="lg:col-span-4 bg-white border border-[#E9E5DF] rounded-[20px] p-6 shadow-[0_6px_24px_rgba(36,34,31,.04)] flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E9E5DF]">
              <div>
                <h2 className="text-[15px] font-medium text-[#24221F]">Stok Menipis</h2>
                <p className="text-xs text-[#716B64] mt-0.5">Produk yang stoknya menipis</p>
              </div>
              <span className="text-xs font-sans text-[#B33D39]">
                {lowStockWarnings.length} variasi
              </span>
            </div>

            <div className="divide-y divide-[#E9E5DF]/60 max-h-[230px] overflow-y-auto">
              {lowStockWarnings.length === 0 ? (
                <div className="py-8 text-[#26786C] text-xs font-medium text-center space-y-1">
                  <CheckCircle2 className="w-5 h-5 mx-auto" />
                  <p>Semua stok produk aman</p>
                </div>
              ) : (
                lowStockWarnings.slice(0, 5).map((w: any, idx: number) => (
                  <div
                    key={idx}
                    className="py-2.5 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-semibold text-[#24221F] truncate max-w-[170px]">
                        {w.productName}
                      </p>
                      <p className="text-[11px] text-[#716B64]">
                        Warna: <span className="font-medium text-[#24221F]">{w.color}</span>
                        {w.size && ` · ${w.size}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="px-2 py-0.5 bg-[#FAECEA] text-[#B33D39] font-bold rounded-[6px] font-sans tabular-nums">
                        {w.availableStock ?? w.available ?? w.physicalStock} pcs
                      </span>
                      <p className="text-[10px] text-[#716B64] mt-0.5">Tersedia</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-[#E9E5DF]">
            <button
              type="button"
              onClick={() => onNavigateTab && onNavigateTab('STOCK')}
              className="text-xs text-[#87533F] hover:underline font-medium flex items-center gap-1"
            >
              <span>Restock produk sekarang</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
