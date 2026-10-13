import React, { useState } from 'react';
import {
  RotateCcw,
  Check,
  X,
  AlertTriangle,
  Clock,
  Eye,
  MessageCircle,
  PackageCheck,
  Search,
  Filter
} from 'lucide-react';
import type { ReturnRequest, Order } from '../../types/index.ts';
import { formatRp } from './adminUtils.ts';

interface ReturnsTabProps {
  returns: ReturnRequest[];
  token: string;
  onRefresh: () => void;
  onShowMessage: (msg: string) => void;
}

export const AdminReturnsTab: React.FC<ReturnsTabProps> = ({
  returns,
  token,
  onRefresh,
  onShowMessage
}) => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [selectedReturn, setSelectedReturn] = useState<ReturnRequest | null>(null);

  // Rejection modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Complete return modal (inspection & restock decision)
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [inspectionResult, setInspectionResult] = useState<'RESTOCKED_GOOD' | 'DAMAGED_SCRAP'>('RESTOCKED_GOOD');
  const [adminNotes, setAdminNotes] = useState('');

  const filteredReturns = returns.filter((ret) => {
    if (filterStatus !== 'ALL' && ret.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchNum = ret.returnNumber.toLowerCase().includes(q);
      const matchOrd = ret.orderNumber.toLowerCase().includes(q);
      if (!matchNum && !matchOrd) return false;
    }
    return true;
  });

  // Update return status API
  const handleUpdateStatus = async (
    returnNumber: string,
    status: string,
    inspection?: string,
    notes?: string
  ) => {
    try {
      const res = await fetch(`/api/admin/returns/${returnNumber}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          status,
          inspectionResult: inspection,
          adminNotes: notes || 'Diproses oleh Owner Defra Hijab'
        })
      });

      if (res.ok) {
        onShowMessage(`Status retur ${returnNumber} berhasil diperbarui.`);
        setShowRejectModal(false);
        setShowCompleteModal(false);
        setSelectedReturn(null);
        onRefresh();
      } else {
        const err = await res.json();
        alert(err.error || 'Gagal memperbarui status retur.');
      }
    } catch {
      alert('Gagal menghubungi server.');
    }
  };

  return (
    <div className="space-y-6 text-[#24221F]">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E9E5DF]">
        <div>
          <h1 className="text-[26px] font-medium tracking-tight text-[#24221F]">Retur &amp; Komplain Barang</h1>
          <p className="text-xs text-[#716B64] mt-0.5">
            Tinjau pengajuan retur dalam 3 hari (Jabodetabek) setelah barang diterima, periksa kondisi barang, dan proses penggantian atau pengembalian uang.
          </p>
        </div>

        <span className="text-xs text-[#716B64] font-sans tabular-nums">
          {returns.length} total pengajuan
        </span>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="p-4 bg-white border border-[#E9E5DF] rounded-[16px] shadow-[0_6px_24px_rgba(36,34,31,.03)] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="w-4 h-4 text-[#716B64] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari nomor retur atau nomor pesanan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 border border-[#E9E5DF] rounded-[10px] bg-[#FAF9F7] text-xs text-[#24221F] outline-none focus:border-[#87533F] focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-10 px-3 border border-[#E9E5DF] rounded-[10px] bg-[#FAF9F7] text-xs text-[#24221F] outline-none"
          >
            <option value="ALL">Semua Status</option>
            <option value="PENDING">Menunggu Persetujuan</option>
            <option value="APPROVED">Disetujui (Kirim Balik)</option>
            <option value="REJECTED">Ditolak</option>
            <option value="COMPLETED">Selesai Diinspeksi</option>
          </select>
        </div>
      </div>

      {/* RETURNS TABLE */}
      <div className="bg-white border border-[#E9E5DF] rounded-[20px] overflow-hidden shadow-[0_6px_24px_rgba(36,34,31,.04)]">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#FAF9F7] text-[#716B64] font-medium border-b border-[#E9E5DF]">
              <tr>
                <th className="p-4 pl-5">No. Retur</th>
                <th className="p-4">Pesanan Asal</th>
                <th className="p-4">Alasan &amp; Kategori</th>
                <th className="p-4">Solusi Diminta</th>
                <th className="p-4">Tanggal Pengajuan</th>
                <th className="p-4">Status Pengajuan</th>
                <th className="p-4 pr-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E9E5DF]">
              {filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-[#716B64]">
                    Belum ada pengajuan komplain atau retur barang.
                  </td>
                </tr>
              ) : (
                filteredReturns.map((ret) => (
                  <tr key={ret.id || ret.returnNumber} className="hover:bg-[#FAF9F7]/70 transition-colors">
                    <td className="p-4 pl-5 font-sans font-semibold text-[#24221F]">
                      {ret.returnNumber}
                    </td>
                    <td className="p-4 font-sans font-medium text-[#87533F]">
                      {ret.orderNumber}
                    </td>
                    <td className="p-4">
                      <p className="font-semibold text-[#24221F]">{ret.reasonCategory}</p>
                      <p className="text-[11px] text-[#716B64] truncate max-w-[200px]">
                        {ret.customerNotes || 'Tidak ada catatan tambahan'}
                      </p>
                    </td>
                    <td className="p-4 text-xs font-medium text-[#24221F]">
                      {ret.requestedResolution === 'REFUND' ? 'Pengembalian Dana' : 'Tukar Barang Baru'}
                    </td>
                    <td className="p-4 text-[#716B64] font-sans whitespace-nowrap">
                      {ret.createdAt.slice(0, 10)}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-[999px] text-[11px] font-semibold ${ret.status === 'PENDING'
                          ? 'bg-[#FEF7EA] text-[#94691E]'
                          : ret.status === 'APPROVED'
                            ? 'bg-blue-50 text-[#426BC6]'
                            : ret.status === 'COMPLETED'
                              ? 'bg-[#E8F3EF] text-[#26786C]'
                              : 'bg-[#FAECEA] text-[#B33D39]'
                          }`}
                      >
                        {ret.status === 'PENDING'
                          ? 'Menunggu Review'
                          : ret.status === 'APPROVED'
                            ? 'Disetujui'
                            : ret.status === 'COMPLETED'
                              ? 'Selesai'
                              : 'Ditolak'}
                      </span>
                    </td>
                    <td className="p-4 pr-5 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedReturn(ret)}
                        className="px-3 py-1.5 bg-[#24221F] hover:bg-[#40322B] text-white rounded-[8px] font-medium transition-colors text-[11px] inline-flex items-center gap-1.5 shadow-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Tinjau</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DRAWER / MODAL TINJAU RETUR */}
      {selectedReturn && (
        <div className="fixed inset-0 bg-[#24221F]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[20px] max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 text-xs text-left shadow-2xl border border-[#E9E5DF] space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#E9E5DF]">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#87533F]">
                  Pemeriksaan Klaim Retur
                </span>
                <h3 className="text-base font-bold text-[#24221F] mt-0.5">
                  {selectedReturn.returnNumber}
                </h3>
                <p className="text-[11px] text-[#716B64]">Untuk Pesanan: {selectedReturn.orderNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReturn(null)}
                className="w-8 h-8 rounded-[8px] bg-[#FAF9F7] flex items-center justify-center text-[#716B64]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-[#FAF9F7] rounded-[12px] border border-[#E9E5DF] space-y-1.5">
                <p className="font-semibold text-[#24221F]">Alasan Komplain: {selectedReturn.reasonCategory}</p>
                <p className="text-[#716B64]">{selectedReturn.customerNotes}</p>
                <p className="text-[11px] text-[#87533F] font-semibold pt-1">
                  Solusi Diinginkan: {selectedReturn.requestedResolution === 'REFUND' ? 'Pengembalian Dana' : 'Penggantian Produk'}
                </p>
              </div>

              {/* Photo Proof */}
              {selectedReturn.proofImageUrls && selectedReturn.proofImageUrls.length > 0 ? (
                <div>
                  <span className="font-semibold text-[#24221F] block mb-1">Foto Bukti Barang:</span>
                  <div className="w-full h-48 bg-[#FAF9F7] border border-[#E9E5DF] rounded-[12px] overflow-hidden">
                    <img
                      src={selectedReturn.proofImageUrls[0]}
                      alt="Bukti Komplain"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-[#FAF9F7] border border-dashed border-[#E9E5DF] rounded-[10px] text-center text-[#716B64]">
                  Tidak ada foto lampiran komplain.
                </div>
              )}
            </div>

            {/* Decisions Actions */}
            <div className="pt-3 border-t border-[#E9E5DF] flex flex-wrap items-center justify-end gap-2">
              {selectedReturn.status === 'PENDING' && (
                <>
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(selectedReturn.returnNumber, 'APPROVED')}
                    className="px-4 py-2 bg-[#26786C] text-white rounded-[10px] font-semibold text-xs"
                  >
                    Setujui (Kirim Alamat Retur)
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRejectModal(true)}
                    className="px-4 py-2 border border-[#B33D39] text-[#B33D39] rounded-[10px] font-medium text-xs hover:bg-[#FAECEA]"
                  >
                    Tolak Pengajuan
                  </button>
                </>
              )}

              {selectedReturn.status === 'APPROVED' && (
                <button
                  type="button"
                  onClick={() => setShowCompleteModal(true)}
                  className="px-4 py-2 bg-[#24221F] text-white rounded-[10px] font-semibold text-xs"
                >
                  Catat Barang Tiba &amp; Inspeksi Fisik
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelectedReturn(null)}
                className="px-4 py-2 border border-[#E9E5DF] rounded-[10px] text-[#716B64]"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TOLAK RETUR DENGAN ALASAN */}
      {showRejectModal && selectedReturn && (
        <div className="fixed inset-0 bg-[#24221F]/60 backdrop-blur-xs z-60 flex items-center justify-center p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleUpdateStatus(selectedReturn.returnNumber, 'REJECTED', undefined, rejectReason);
            }}
            className="bg-white rounded-[20px] max-w-md w-full p-6 text-xs text-left shadow-2xl border border-[#E9E5DF] space-y-4"
          >
            <h3 className="font-semibold text-sm text-[#B33D39]">Alasan Penolakan Retur</h3>
            <textarea
              required
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Contoh: Melewati masa garansi 3 hari atau bukan cacat produksi..."
              className="w-full p-2.5 border border-[#E9E5DF] rounded-[10px] text-xs outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 border border-[#E9E5DF] rounded-[10px] text-[#716B64]"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#B33D39] text-white rounded-[10px] font-semibold"
              >
                Kirim Penolakan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: INSPEKSI FISIK BARANG TIBA */}
      {showCompleteModal && selectedReturn && (
        <div className="fixed inset-0 bg-[#24221F]/60 backdrop-blur-xs z-60 flex items-center justify-center p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleUpdateStatus(selectedReturn.returnNumber, 'COMPLETED', inspectionResult, adminNotes);
            }}
            className="bg-white rounded-[20px] max-w-md w-full p-6 text-xs text-left shadow-2xl border border-[#E9E5DF] space-y-4"
          >
            <h3 className="font-semibold text-sm text-[#24221F]">Hasil Inspeksi Barang Retur Tiba</h3>

            <div className="space-y-2">
              <label className="flex items-center gap-2 p-3 bg-[#FAF9F7] rounded-[10px] cursor-pointer">
                <input
                  type="radio"
                  name="inspection"
                  checked={inspectionResult === 'RESTOCKED_GOOD'}
                  onChange={() => setInspectionResult('RESTOCKED_GOOD')}
                />
                <div>
                  <p className="font-semibold text-[#24221F]">Layak Jual Kembali (Restock)</p>
                  <p className="text-[11px] text-[#716B64]">Barang masih utuh, dikembalikan ke stok fisik gudang.</p>
                </div>
              </label>

              <label className="flex items-center gap-2 p-3 bg-[#FAECEA]/50 rounded-[10px] cursor-pointer">
                <input
                  type="radio"
                  name="inspection"
                  checked={inspectionResult === 'DAMAGED_SCRAP'}
                  onChange={() => setInspectionResult('DAMAGED_SCRAP')}
                />
                <div>
                  <p className="font-semibold text-[#B33D39]">Rusak Cacat / Tidak Layak Jual</p>
                  <p className="text-[11px] text-[#716B64]">Dihapus dari stok gudang dan dicatat sebagai rugi barang.</p>
                </div>
              </label>
            </div>

            <div>
              <label className="block text-[#716B64] mb-1 font-medium">Catatan Pemeriksaan:</label>
              <input
                type="text"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Contoh: Tag masih lengkap, kondisi kain bersih..."
                className="w-full h-10 px-3 border border-[#E9E5DF] rounded-[10px] text-xs outline-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCompleteModal(false)}
                className="px-4 py-2 border border-[#E9E5DF] rounded-[10px] text-[#716B64]"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#24221F] text-white rounded-[10px] font-semibold"
              >
                Selesaikan Retur
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
