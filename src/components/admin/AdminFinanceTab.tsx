import React, { useState } from 'react';
import {
  FileDown,
  Calendar,
  Layers,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Download,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { formatRp, formatRpShort } from './adminUtils.ts';
import { SalesTrendChart } from './AdminCharts.tsx';

interface FinanceTabProps {
  dashboardData: any;
  token: string;
  onRefresh: (startDate?: string, endDate?: string) => void;
  onShowMessage: (msg: string) => void;
}

export const AdminFinanceTab: React.FC<FinanceTabProps> = ({
  dashboardData,
  token,
  onRefresh,
  onShowMessage
}) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exporting, setExporting] = useState(false);

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    onRefresh(startDate || undefined, endDate || undefined);
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const response = await fetch(`/api/admin/financial-export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Ekspor ditolak server.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'laporan-defra.csv';
      anchor.click();
      URL.revokeObjectURL(url);
      onShowMessage('File CSV laporan keuangan siap diunduh.');
    } catch {
      alert('Gagal mengekspor laporan.');
    } finally {
      setExporting(false);
    }
  };

  const m = dashboardData?.metrics || {};
  const chartSeries = dashboardData?.chartSeries || [];
  const expenses = dashboardData?.expenses || [];

  const netProfit = m.netProfit || 0;
  const isNegative = netProfit < 0;

  return (
    <div className="space-y-6 text-[#24221F]">
      {/* HEADER & CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E9E5DF]">
        <div>
          <h1 className="text-[26px] font-medium tracking-tight text-[#24221F]">Laporan Keuangan &amp; Keuntungan Rugi</h1>
          <p className="text-xs text-[#716B64] mt-0.5">
            Lihat penjualan, modal barang terjual, biaya usaha, dan keuntungan bersih selama periode yang dipilih.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <form onSubmit={handleApplyFilter} className="flex items-center gap-1.5 bg-white border border-[#E9E5DF] px-3 py-1.5 rounded-[10px] text-xs shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-[#716B64]" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-xs text-[#24221F] outline-none font-sans"
            />
            <span className="text-[#716B64]">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-xs text-[#24221F] outline-none font-sans"
            />
            <button
              type="submit"
              className="ml-1 px-3 py-1 bg-[#24221F] text-white rounded-[8px] font-medium"
            >
              Filter
            </button>
          </form>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exporting}
            className="h-9 px-4 bg-[#26786C] hover:bg-[#1E6056] text-white rounded-[10px] text-xs font-semibold flex items-center gap-2 transition-colors shadow-xs disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{exporting ? 'Mengunduh...' : 'Ekspor Laporan (CSV/Excel)'}</span>
          </button>
        </div>
      </div>

      {/* 5 KEY FINANCIAL KPIS (Single unified strip with vertical dividers) */}
      <div className="bg-white border border-[#E9E5DF] rounded-[18px] shadow-xs grid grid-cols-2 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-[#E9E5DF]/70 overflow-hidden">
        {/* Net Sales */}
        <div className="p-5 space-y-1">
          <span className="text-[10px] uppercase font-semibold text-[#87533F] tracking-wider block">
            Net Penjualan (Omzet)
          </span>
          <p className="text-xl font-bold font-sans text-[#24221F] tabular-nums">
            {formatRp(m.totalOmzet || 0)}
          </p>
          <span className="text-[10px] text-[#716B64]">
            {m.verifiedOrdersCount || 0} transaksi lunas
          </span>
        </div>

        {/* Total HPP FIFO */}
        <div className="p-5 space-y-1">
          <span className="text-[10px] uppercase font-semibold text-[#87533F]/80 tracking-wider block">
            Total HPP FIFO
          </span>
          <p className="text-xl font-bold font-sans text-[#87533F] tabular-nums">
            {formatRp(m.totalHPP || 0)}
          </p>
          <span className="text-[10px] text-[#716B64]">
            {m.totalUnitsSold || 0} unit keluar gudang
          </span>
        </div>

        {/* Keuntungan Kotor */}
        <div className="p-5 space-y-1">
          <span className="text-[10px] uppercase font-semibold text-[#26786C] tracking-wider block">
            Keuntungan Kotor
          </span>
          <p className="text-xl font-bold font-sans text-[#26786C] tabular-nums">
            {formatRp(m.grossProfit || 0)}
          </p>
          <span className="text-[10px] text-[#716B64]">
            Omzet dikurangi HPP
          </span>
        </div>

        {/* Biaya Langsung & Operasional */}
        <div className="p-5 space-y-1">
          <span className="text-[10px] uppercase font-semibold text-[#716B64] tracking-wider block">
            Total Beban &amp; Biaya
          </span>
          <p className="text-xl font-bold font-sans text-[#24221F] tabular-nums">
            {formatRp((m.directCosts || 0) + (m.totalOperationalExpenses || 0))}
          </p>
          <span className="text-[10px] text-[#716B64]">
            Kemasan + Operasional
          </span>
        </div>

        {/* Keuntungan Bersih Akhir */}
        <div className={`p-5 space-y-1 ${isNegative ? 'bg-[#FAECEA]/40' : 'bg-[#E8F3EF]/40'}`}>
          <span className={`text-[10px] uppercase font-semibold tracking-wider block ${isNegative ? 'text-[#B33D39]' : 'text-[#26786C]'}`}>
            Keuntungan Bersih Akhir
          </span>
          <p className={`text-xl font-bold font-sans tabular-nums ${isNegative ? 'text-[#B33D39]' : 'text-[#26786C]'}`}>
            {formatRp(netProfit)}
          </p>
          <span className={`text-[10px] ${isNegative ? 'text-[#B33D39]/80' : 'text-[#26786C]/80'}`}>
            {isNegative ? 'Margin defisit' : 'Keuntungan Bersih positif'}
          </span>
        </div>
      </div>

      {/* TREND CHART */}
      <div className="bg-white border border-[#E9E5DF] rounded-[20px] p-6 shadow-[0_6px_24px_rgba(36,34,31,.04)] space-y-3">
        <div className="pb-3 border-b border-[#E9E5DF] flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-medium text-[#24221F]">Kurva Penjualan &amp; Keuntungan Bersih</h2>
            <p className="text-xs text-[#716B64]">Grafik Penjualan & Keuntungan Bersih selama periode yang dipilih</p>
          </div>
        </div>

        <SalesTrendChart data={chartSeries} />
      </div>

      {/* TABEL RINCI LAPORAN KEUANGAN */}
      <div className="bg-white border border-[#E9E5DF] rounded-[20px] overflow-hidden shadow-[0_6px_24px_rgba(36,34,31,.04)]">
        <div className="p-4 bg-[#FAF9F7] border-b border-[#E9E5DF] flex items-center justify-between">
          <h2 className="text-[15px] font-medium text-[#24221F]">Rincian Buku Besar Keuntungan Rugi</h2>
          <span className="text-xs text-[#716B64] font-sans"></span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#FAF9F7] text-[#716B64] font-medium border-b border-[#E9E5DF]">
              <tr>
                <th className="p-4 pl-5">Rincian laporan</th>
                <th className="p-4">Keterangan Sumber Data</th>
                <th className="p-4 text-right pr-5">Nilai Nominal (Rp)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E9E5DF] font-sans text-xs">
              <tr className="hover:bg-[#FAF9F7]/50">
                <td className="p-4 pl-5 font-sans font-semibold text-[#24221F]">
                  (+) Pendapatan Kotor (Subtotal Produk)
                </td>
                <td className="p-4 font-sans text-[#716B64]">
                  Total nilai produk dari transaksi terverifikasi
                </td>
                <td className="p-4 pr-5 text-right font-bold text-[#24221F] tabular-nums">
                  {formatRp(m.totalOmzet || 0)}
                </td>
              </tr>

              <tr className="hover:bg-[#FAF9F7]/50">
                <td className="p-4 pl-5 font-sans text-[#716B64]">
                  (−) Potongan Diskon Voucher
                </td>
                <td className="p-4 font-sans text-[#716B64]">
                  Voucher promo resmi yang digunakan pembeli
                </td>
                <td className="p-4 pr-5 text-right text-[#26786C] tabular-nums">
                  −{formatRp(m.totalDiscountGiven || 0)}
                </td>
              </tr>

              <tr className="hover:bg-[#FAF9F7]/50">
                <td className="p-4 pl-5 font-sans text-[#716B64]">
                  (−) Harga Pokok Penjualan (HPP FIFO)
                </td>
                <td className="p-4 font-sans text-[#716B64]">
                  Biaya modal konveksi &amp; kain dari batch tertua
                </td>
                <td className="p-4 pr-5 text-right text-[#87533F] tabular-nums">
                  −{formatRp(m.totalHPP || 0)}
                </td>
              </tr>

              <tr className="bg-[#FAF9F7] font-semibold">
                <td className="p-4 pl-5 font-sans text-[#24221F]">
                  (=) Keuntungan Kotor Usaha
                </td>
                <td className="p-4 font-sans text-[#716B64]">
                  Selisih pendapatan terhadap modal pokok busana
                </td>
                <td className="p-4 pr-5 text-right text-[#26786C] font-bold tabular-nums">
                  {formatRp(m.grossProfit || 0)}
                </td>
              </tr>

              <tr className="hover:bg-[#FAF9F7]/50">
                <td className="p-4 pl-5 font-sans text-[#716B64]">
                  (−) Biaya Kemasan &amp; Langsung
                </td>
                <td className="p-4 font-sans text-[#716B64]">
                  Kotak kardus, pita, polymailer, bubble wrap
                </td>
                <td className="p-4 pr-5 text-right text-[#716B64] tabular-nums">
                  −{formatRp(m.directCosts || 0)}
                </td>
              </tr>

              <tr className="hover:bg-[#FAF9F7]/50">
                <td className="p-4 pl-5 font-sans text-[#716B64]">
                  (−) Beban Operasional Toko
                </td>
                <td className="p-4 font-sans text-[#716B64]">
                  Listrik, studio, gaji, iklan marketing
                </td>
                <td className="p-4 pr-5 text-right text-[#716B64] tabular-nums">
                  −{formatRp(m.totalOperationalExpenses || 0)}
                </td>
              </tr>

              {Boolean(m.totalRefunds && m.totalRefunds > 0) && (
                <tr className="hover:bg-[#FAF9F7]/50">
                  <td className="p-4 pl-5 font-sans text-[#716B64]">
                    (−) Pengembalian Dana (Refund)
                  </td>
                  <td className="p-4 font-sans text-[#716B64]">
                    Klaim retur uang pembeli yang telah disetujui
                  </td>
                  <td className="p-4 pr-5 text-right text-[#426BC6] tabular-nums">
                    −{formatRp(m.totalRefunds)}
                  </td>
                </tr>
              )}

              {/* Total Bersih */}
              <tr className={isNegative ? 'bg-[#FAECEA] text-[#B33D39]' : 'bg-[#E8F3EF] text-[#26786C]'}>
                <td className="p-4 pl-5 font-sans font-bold text-sm">
                  (=) Keuntungan Bersih Akhir (Net Profit)
                </td>
                <td className="p-4 font-sans text-xs">
                  Hasil akhir setelah seluruh biaya dipotong
                </td>
                <td className="p-4 pr-5 text-right font-bold text-base tabular-nums">
                  {formatRp(netProfit)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
