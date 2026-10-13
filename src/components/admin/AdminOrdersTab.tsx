import React, { useState } from 'react';
import {
  Search,
  Filter,
  Eye,
  Check,
  X,
  Truck,
  RotateCcw,
  Ban,
  DollarSign,
  AlertCircle,
  ExternalLink,
  MessageCircle,
  Clock,
  ChevronRight,
  PackageCheck,
  ZoomIn,
  AlertTriangle,
  Trash2
} from 'lucide-react';
import type { Order } from '../../types/index.ts';
import {
  formatRp,
  getPaymentStatusInfo,
  getFulfillmentStatusInfo
} from './adminUtils.ts';
import { AdminMobileListCard } from './AdminMobileListCard.tsx';

interface OrdersTabProps {
  orders: Order[];
  token: string;
  onRefresh: () => void;
  onShowMessage: (msg: string) => void;
  initialFilter?: string;
}

export const AdminOrdersTab: React.FC<OrdersTabProps> = ({
  orders,
  token,
  onRefresh,
  onShowMessage,
  initialFilter
}) => {
  const [search, setSearch] = useState('');
  const [filterPayment, setFilterPayment] = useState<string>(initialFilter || 'ALL');
  const [filterFulfillment, setFilterFulfillment] = useState<string>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [zoomProofUrl, setZoomProofUrl] = useState<string | null>(null);

  // Rejection / Revision Modal State
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('Nominal transfer tidak sesuai dengan total tagihan.');
  const [rejectDeadlineHours, setRejectDeadlineHours] = useState(24);

  // Cancellation Modal State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Refund Modal State
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundReason, setRefundReason] = useState('');
  const [isFullRefund, setIsFullRefund] = useState(true);

  // Filtering
  const filteredOrders = orders.filter((o) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchNumber = o.orderNumber.toLowerCase().includes(q);
      const matchName = o.customerName.toLowerCase().includes(q);
      const matchWa = o.customerWhatsapp.includes(q);
      if (!matchNumber && !matchName && !matchWa) return false;
    }
    if (filterPayment !== 'ALL' && o.paymentStatus !== filterPayment) return false;
    if (filterFulfillment !== 'ALL' && o.fulfillmentStatus !== filterFulfillment) return false;
    return true;
  });

  // Verify payment action
  const handleVerify = async (orderNumber: string) => {
    if (!window.confirm(`Konfirmasi verifikasi dana masuk untuk pesanan ${orderNumber}? Pastikan nominal telah masuk mutasi rekening.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/orders/${orderNumber}/verify-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'VERIFY' })
      });
      if (res.ok) {
        onShowMessage(`Pembayaran pesanan ${orderNumber} berhasil diverifikasi. Status pesanan beralih ke Siap Dikemas.`);
        onRefresh();
        if (selectedOrder?.orderNumber === orderNumber) {
          const updated = await res.json();
          setSelectedOrder(updated.order);
        }
      }
    } catch {
      alert('Gagal memverifikasi pembayaran.');
    }
  };

  // Delete order action
  const handleDeleteOrder = async (orderNumber: string) => {
    if (!window.confirm(`PERINGATAN: Apakah Anda yakin ingin menghapus pesanan ${orderNumber} dari database secara permanen? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/orders/${orderNumber}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        onShowMessage(`Pesanan ${orderNumber} berhasil dihapus dari database.`);
        if (selectedOrder?.orderNumber === orderNumber) {
          setSelectedOrder(null);
        }
        onRefresh();
      } else {
        const data = await res.json();
        alert(data.error || 'Gagal menghapus pesanan.');
      }
    } catch {
      alert('Terjadi kesalahan jaringan saat menghapus pesanan.');
    }
  };

  // Submit reject / revision payment
  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    try {
      const deadline = new Date(Date.now() + rejectDeadlineHours * 60 * 60 * 1000).toISOString();
      const res = await fetch(`/api/admin/orders/${selectedOrder.orderNumber}/verify-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'REJECT',
          rejectionReason: rejectReason,
          rejectionDeadline: deadline
        })
      });
      if (res.ok) {
        onShowMessage(`Permintaan revisi bukti bayar untuk ${selectedOrder.orderNumber} telah dicatat.`);
        setShowRejectModal(false);
        onRefresh();
        const updated = await res.json();
        setSelectedOrder(updated.order);
      }
    } catch {
      alert('Gagal mengirim revisi pembayaran.');
    }
  };

  // Update fulfillment status
  const handleUpdateFulfillment = async (orderNumber: string, status: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderNumber}/update-fulfillment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fulfillmentStatus: status })
      });
      if (res.ok) {
        onShowMessage(`Status pengiriman ${orderNumber} diperbarui menjadi ${status}.`);
        onRefresh();
        if (selectedOrder?.orderNumber === orderNumber) {
          const updated = await res.json();
          setSelectedOrder(updated.order);
        }
      }
    } catch {
      alert('Gagal memperbarui status pengiriman.');
    }
  };

  // Cancel order & restore FIFO stock
  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    try {
      const res = await fetch(`/api/admin/orders/${selectedOrder.orderNumber}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: cancelReason || 'Dibatalkan oleh pengelola toko.' })
      });
      const data = await res.json();
      if (res.ok) {
        onShowMessage(`Pesanan ${selectedOrder.orderNumber} dibatalkan. Stok fisik telah dikembalikan ke batch FIFO.`);
        setShowCancelModal(false);
        onRefresh();
        setSelectedOrder(data.order);
      } else {
        alert(data.error || 'Gagal membatalkan pesanan.');
      }
    } catch {
      alert('Gagal memproses pembatalan.');
    }
  };

  // Refund order
  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    try {
      const amount = isFullRefund ? selectedOrder.totalAmount : refundAmount;
      const res = await fetch(`/api/admin/orders/${selectedOrder.orderNumber}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          refundAmount: amount,
          refundReason: refundReason || 'Pengembalian dana pelanggan',
          isFullRefund
        })
      });
      const data = await res.json();
      if (res.ok) {
        onShowMessage(`Refund ${formatRp(amount)} untuk pesanan ${selectedOrder.orderNumber} berhasil dicatat.`);
        setShowRefundModal(false);
        onRefresh();
        setSelectedOrder(data.order);
      } else {
        alert(data.error || 'Gagal memproses refund.');
      }
    } catch {
      alert('Gagal memproses refund.');
    }
  };

  return (
    <div className="space-y-6 text-[#24221F]">
      {/* HEADER & FILTER TOOLBAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E9E5DF]">
        <div>
          <h1 className="text-[26px] font-medium tracking-tight text-[#24221F]">Daftar Pesanan</h1>
          <p className="text-xs text-[#716B64] mt-0.5">
            Verifikasi transfer bank/QRIS, cetak resi pengiriman, dan lacak status pesanan.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#716B64] font-sans tabular-nums">
            {filteredOrders.length} dari {orders.length} pesanan
          </span>
        </div>
      </div>

      {/* SEARCH & FILTERS BAR */}
      <div className="p-4 bg-white border border-[#E9E5DF] rounded-[16px] shadow-[0_6px_24px_rgba(36,34,31,.03)] flex flex-col md:flex-row md:flex-wrap items-stretch md:items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative w-full min-w-0 md:flex-1 md:min-w-[260px]">
          <Search className="w-4 h-4 text-[#716B64] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari nomor pesanan, nama pembeli, atau WhatsApp..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 border border-[#E9E5DF] rounded-[10px] bg-[#FAF9F7] text-xs text-[#24221F] placeholder:text-[#716B64] focus:outline-2 focus:outline-[#87533F] focus:bg-white transition-all"
          />
        </div>

        {/* Filters */}
        <div className="grid w-full min-w-0 grid-cols-2 items-center gap-2.5 md:flex md:w-auto md:flex-wrap">
          <div className="flex w-full min-w-0 items-center gap-1.5 bg-[#FAF9F7] border border-[#E9E5DF] rounded-[10px] px-2.5 py-1 md:w-auto">
            <span className="shrink-0 whitespace-nowrap text-[#716B64]">Status Bayar:</span>
            <select
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value)}
              className="h-8 min-w-0 flex-1 bg-transparent text-xs text-[#24221F] font-medium outline-none cursor-pointer"
            >
              <option value="ALL">Semua Pembayaran</option>
              <option value="WAITING_VERIFICATION">Menunggu Review</option>
              <option value="VERIFIED">Terverifikasi</option>
              <option value="REVISION_REQUESTED">Perlu Revisi</option>
              <option value="REFUNDED_PARTIAL">Refund Sebagian</option>
              <option value="REFUNDED_FULL">Refund Penuh</option>
            </select>
          </div>

          <div className="flex w-full min-w-0 items-center gap-1.5 bg-[#FAF9F7] border border-[#E9E5DF] rounded-[10px] px-2.5 py-1 md:w-auto">
            <span className="shrink-0 whitespace-nowrap text-[#716B64]">Pengiriman:</span>
            <select
              value={filterFulfillment}
              onChange={(e) => setFilterFulfillment(e.target.value)}
              className="h-8 min-w-0 flex-1 bg-transparent text-xs text-[#24221F] font-medium outline-none cursor-pointer"
            >
              <option value="ALL">Semua Status</option>
              <option value="WAITING_PAYMENT_VERIFIED">Menunggu Bayar</option>
              <option value="PACKED">Siap Dikemas</option>
              <option value="SHIPPED">Dalam Pengiriman</option>
              <option value="DELIVERED">Diterima</option>
              <option value="CANCELLED">Dibatalkan</option>
            </select>
          </div>

          {(search || filterPayment !== 'ALL' || filterFulfillment !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setFilterPayment('ALL');
                setFilterFulfillment('ALL');
              }}
              className="col-span-2 justify-self-start px-2.5 py-1 text-[#87533F] hover:bg-[#F6F5F2] rounded-[8px] transition-colors font-medium md:col-auto"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {filteredOrders.map((o) => {
          const payInfo = getPaymentStatusInfo(o.paymentStatus);
          const fulInfo = getFulfillmentStatusInfo(o.fulfillmentStatus);
          const totalUnits = o.items.reduce((sum, item) => sum + item.quantity, 0);
          return <AdminMobileListCard key={o.orderNumber} eyebrow={o.orderNumber} date={o.createdAt.slice(0, 10)} title={o.customerName} subtitle={o.customerWhatsapp}
            fields={[{label:'Total',value:formatRp(o.totalAmount)},{label:'Item',value:`${totalUnits} pcs`},{label:'Pembayaran',value:payInfo.label},{label:'Pengiriman',value:fulInfo.label}]}
            status={<span className={payInfo.text}>{payInfo.label}</span>}
            primaryAction={<button type="button" onClick={() => setSelectedOrder(o)} className="min-h-11 px-3 rounded-[8px] bg-[#282420] text-white inline-flex items-center gap-1"><Eye className="w-3.5 h-3.5"/>Detail</button>}
            details={<><p><strong>Produk:</strong> {o.items.map((item) => `${item.productName} (${item.quantity})`).join(', ')}</p><p><strong>Email:</strong> {o.customerEmail}</p></>}
            actions={<><a href={`https://wa.me/${o.customerWhatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="min-h-11 px-3 rounded-[8px] bg-[#F3EBDF] text-[#282420] inline-flex items-center gap-1.5" title="Hubungi pembeli"><MessageCircle className="w-4 h-4"/>WhatsApp</a><button type="button" onClick={() => handleDeleteOrder(o.orderNumber)} className="min-h-11 px-3 rounded-[8px] text-[#B33D39] inline-flex items-center gap-1.5" title="Hapus pesanan"><Trash2 className="w-4 h-4"/>Hapus</button></>}/>
        })}
        {filteredOrders.length === 0 && <p className="py-6 text-center text-xs text-[#716B64]">Tidak ada pesanan yang sesuai.</p>}
      </div>

      {/* ORDERS TABLE */}
      <div className="hidden md:block bg-white border border-[#E9E5DF] rounded-[20px] overflow-hidden shadow-[0_6px_24px_rgba(36,34,31,.04)]">
        <div className="admin-responsive-table admin-orders-table overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#FAF9F7] text-[#716B64] font-medium border-b border-[#E9E5DF]">
              <tr>
                <th className="p-4 pl-5">No. Pesanan</th>
                <th className="p-4">Pembeli</th>
                <th className="p-4">Waktu</th>
                <th className="p-4">Item</th>
                <th className="p-4 text-right">Total Transaksi</th>
                <th className="p-4">Status Pembayaran</th>
                <th className="p-4">Status Pemenuhan</th>
                <th className="p-4 pr-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E9E5DF]">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-[#716B64]">
                    Tidak ada pesanan yang sesuai dengan filter pencarian saat ini.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => {
                  const payInfo = getPaymentStatusInfo(o.paymentStatus);
                  const fulInfo = getFulfillmentStatusInfo(o.fulfillmentStatus);
                  const totalUnits = o.items.reduce((sum, it) => sum + it.quantity, 0);

                  return (
                    <tr
                      key={o.orderNumber}
                      className="hover:bg-[#FAF9F7]/70 transition-colors cursor-pointer group"
                      onClick={() => setSelectedOrder(o)}
                    >
                      <td className="p-4 pl-5 font-sans font-semibold text-[#24221F]">
                        {o.orderNumber}
                      </td>
                      <td className="p-4">
                        <p className="font-semibold text-[#24221F]">{o.customerName}</p>
                        <a
                          href={`https://wa.me/${o.customerWhatsapp.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[11px] text-[#716B64] hover:text-[#26786C] flex items-center gap-1 mt-0.5"
                        >
                          <MessageCircle className="w-3 h-3 text-[#26786C]" />
                          <span>{o.customerWhatsapp}</span>
                        </a>
                      </td>
                      <td className="p-4 text-[#716B64] font-sans whitespace-nowrap">
                        {o.createdAt.slice(0, 10)}
                        <span className="block text-[10px] text-[#716B64]/70">
                          {o.createdAt.slice(11, 16)} WIB
                        </span>
                      </td>
                      <td className="p-4 text-[#716B64]">
                        <span className="font-medium text-[#24221F] font-sans tabular-nums">{totalUnits} pcs</span>
                        <span className="block text-[11px] text-[#716B64] truncate max-w-[140px]">
                          {o.items[0]?.productName}
                        </span>
                      </td>
                      <td className="p-4 text-right font-sans font-bold text-[#24221F] tabular-nums">
                        {formatRp(o.totalAmount)}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-[999px] text-[11px] font-semibold border ${payInfo.bg} ${payInfo.text} ${payInfo.border}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${payInfo.dot}`} />
                          <span>{payInfo.label}</span>
                        </span>
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-[999px] text-[11px] font-medium border ${fulInfo.bg} ${fulInfo.text} ${fulInfo.border}`}
                        >
                          {fulInfo.label}
                        </span>
                      </td>
                      <td className="p-4 pr-5 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrder(o);
                            }}
                            className="px-2.5 py-1.5 bg-[#24221F] hover:bg-[#40322B] text-white rounded-[8px] font-medium transition-colors text-[11px] inline-flex items-center gap-1 shadow-xs"
                            title="Lihat Detail Pesanan"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Detail</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteOrder(o.orderNumber);
                            }}
                            className="p-1.5 text-[#716B64] hover:text-[#B33D39] hover:bg-[#FAECEA] rounded-[8px] transition-colors"
                            title="Hapus Pesanan dari Database"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DRAWER DETAIL PESANAN (DESKTOP 8 COLS + 4 COLS, MOBILE FULLSCREEN)        */}
      {/* ========================================================================= */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-[#24221F]/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-[20px] max-w-5xl w-full max-h-[92vh] overflow-y-auto p-6 sm:p-8 text-xs text-left shadow-2xl border border-[#E9E5DF] space-y-6">

            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#E9E5DF]">
              <div>
                <span className="text-[11px] uppercase tracking-wider font-semibold text-[#87533F]">
                  Rincian Pesanan &amp; Verifikasi
                </span>
                <h2 className="text-xl font-bold text-[#24221F] font-sans mt-0.5">
                  {selectedOrder.orderNumber}
                </h2>
                <span className="text-[11px] text-[#716B64]">
                  Dibuat pada {new Date(selectedOrder.createdAt).toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDeleteOrder(selectedOrder.orderNumber)}
                  className="px-3 py-1.5 bg-[#FAECEA] hover:bg-[#F5D5D1] text-[#B33D39] rounded-[8px] font-medium transition-colors text-[11px] flex items-center gap-1"
                  title="Hapus Pesanan dari Database"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Pesanan</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="w-9 h-9 rounded-[10px] bg-[#FAF9F7] hover:bg-[#F6F5F2] flex items-center justify-center text-[#716B64] hover:text-[#24221F] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Grid 8 Kolom (Data Item + Alamat + Timeline) & 4 Kolom (Bukti & Aksi) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

              {/* SISI KIRI: 8 KOLOM */}
              <div className="lg:col-span-8 space-y-5">

                {/* 1. Alamat & Data Pelanggan */}
                <div className="p-4 bg-[#FAF9F7] border border-[#E9E5DF] rounded-[16px] grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#716B64] block mb-1">
                      Penerima Pesanan
                    </span>
                    <p className="font-semibold text-sm text-[#24221F]">{selectedOrder.customerName}</p>
                    <p className="text-[#716B64] text-xs">{selectedOrder.customerEmail}</p>
                    <a
                      href={`https://wa.me/${selectedOrder.customerWhatsapp.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#26786C] hover:underline flex items-center gap-1 mt-1 font-semibold text-xs"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>{selectedOrder.customerWhatsapp} (Buka WhatsApp)</span>
                    </a>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#716B64] block mb-1">
                      Tujuan Kirim &amp; Ekspedisi
                    </span>
                    <p className="text-[#24221F] font-medium">{selectedOrder.addressLine}</p>
                    <p className="text-[#716B64]">
                      {selectedOrder.subdistrict}, {selectedOrder.city}, {selectedOrder.province} {selectedOrder.postalCode}
                    </p>
                    <span className="inline-block mt-1 px-2.5 py-0.5 bg-blue-50 text-[#426BC6] rounded-[6px] font-semibold text-[11px]">
                      Kurir: {selectedOrder.shippingService}
                    </span>
                  </div>
                </div>

                {/* 2. Daftar Item Pesanan & Alokasi Modal FIFO */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-[#24221F]">Item Busana &amp; Alokasi Modal FIFO</h3>
                    <span className="text-[#716B64] text-[11px]">
                      {selectedOrder.items.length} jenis item
                    </span>
                  </div>

                  <div className="border border-[#E9E5DF] rounded-[16px] overflow-hidden divide-y divide-[#E9E5DF]">
                    {selectedOrder.items.map((it, idx) => (
                      <div key={idx} className="p-4 space-y-2.5 bg-white">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold text-sm text-[#24221F]">{it.productName}</p>
                            <p className="text-xs text-[#716B64] mt-0.5">
                              Warna: <span className="font-medium text-[#24221F]">{it.color}</span> · Ukuran: {it.size}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-sans text-xs text-[#716B64]">
                              {it.quantity} &times; {formatRp(it.unitPrice)}
                            </span>
                            <p className="font-sans font-bold text-sm text-[#24221F] mt-0.5">
                              {formatRp(it.subtotal)}
                            </p>
                          </div>
                        </div>

                        {/* Allocated FIFO batches */}
                        <div className="p-2.5 bg-[#FAF9F7] rounded-[10px] border border-[#E9E5DF] text-[11px] space-y-1">
                          <p className="text-[#716B64] font-medium">Asal Stok:</p>
                          {it.allocatedBatches && it.allocatedBatches.length > 0 ? (
                            it.allocatedBatches.map((b, bIdx) => (
                              <div key={bIdx} className="flex justify-between font-sans text-[10px] text-[#24221F]">
                                <span>Batch: {b.batchCode} ({b.quantity} unit)</span>
                                <span className="text-[#87533F]">HPP: {formatRp(b.costPerUnit)}/unit</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-[10px] text-[#716B64]">Alokasi standar restock awal</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Timeline Riwayat Status */}
                <div className="p-4 bg-[#FAF9F7] border border-[#E9E5DF] rounded-[16px] space-y-3">
                  <h3 className="font-semibold text-xs text-[#24221F]">Timeline Riwayat Pesanan</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-start gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-[#26786C] mt-1.5 shrink-0" />
                      <div>
                        <p className="font-medium text-[#24221F]">Pesanan Dibuat Pelanggan</p>
                        <p className="text-[11px] text-[#716B64] font-sans">{selectedOrder.createdAt}</p>
                      </div>
                    </div>
                    {selectedOrder.paymentStatus === 'VERIFIED' && (
                      <div className="flex items-start gap-2.5">
                        <div className="w-2 h-2 rounded-full bg-[#26786C] mt-1.5 shrink-0" />
                        <div>
                          <p className="font-medium text-[#24221F]">Pembayaran Terverifikasi</p>
                          <p className="text-[11px] text-[#716B64] font-sans">{selectedOrder.updatedAt || 'Diperiksa'}</p>
                        </div>
                      </div>
                    )}
                    {selectedOrder.fulfillmentStatus === 'SHIPPED' && (
                      <div className="flex items-start gap-2.5">
                        <div className="w-2 h-2 rounded-full bg-[#426BC6] mt-1.5 shrink-0" />
                        <div>
                          <p className="font-medium text-[#24221F]">Paket Diserahkan ke Ekspedisi</p>
                          <p className="text-[11px] text-[#716B64] font-sans">{selectedOrder.updatedAt}</p>
                        </div>
                      </div>
                    )}
                    {selectedOrder.fulfillmentStatus === 'DELIVERED' && (
                      <div className="flex items-start gap-2.5">
                        <div className="w-2 h-2 rounded-full bg-[#26786C] mt-1.5 shrink-0" />
                        <div>
                          <p className="font-medium text-[#24221F]">Paket Diterima Pembeli</p>
                          <p className="text-[11px] text-[#716B64] font-sans">{selectedOrder.actualDeliveryDate || selectedOrder.updatedAt}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* SISI KANAN: 4 KOLOM (Bukti Transfer & Aksi Keputusan) */}
              <div className="lg:col-span-4 space-y-4">

                {/* Bukti Pembayaran */}
                <div className="p-4 bg-white border border-[#E9E5DF] rounded-[16px] shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-[#24221F]">Bukti Transfer</span>
                    <span className="text-[11px] font-medium text-[#716B64] font-sans">
                      {selectedOrder.paymentMethod}
                    </span>
                  </div>

                  {selectedOrder.paymentProofUrl ? (
                    <div className="space-y-2">
                      <div
                        onClick={() => setZoomProofUrl(selectedOrder.paymentProofUrl)}
                        className="relative w-full h-44 bg-[#FAF9F7] border border-[#E9E5DF] rounded-[12px] overflow-hidden cursor-pointer group"
                      >
                        <img
                          src={selectedOrder.paymentProofUrl}
                          alt="Bukti Transfer"
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-[#24221F]/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium gap-1">
                          <ZoomIn className="w-4 h-4" />
                          <span>Klik Perbesar</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-[#716B64] text-center">
                        Terproteksi hak akses Owner
                      </p>
                    </div>
                  ) : (
                    <div className="p-6 bg-[#FAF9F7] border border-dashed border-[#E9E5DF] rounded-[12px] text-center text-[#716B64]">
                      Belum ada bukti pembayaran diunggah.
                    </div>
                  )}

                  {/* Verification Decision Buttons */}
                  {selectedOrder.paymentStatus === 'WAITING_VERIFICATION' && (
                    <div className="pt-2 space-y-2">
                      <button
                        type="button"
                        onClick={() => handleVerify(selectedOrder.orderNumber)}
                        className="w-full h-10 bg-[#26786C] hover:bg-[#1E6056] text-white rounded-[10px] font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs"
                      >
                        <Check className="w-4 h-4" />
                        <span>Verifikasi Pembayaran Lunas</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowRejectModal(true)}
                        className="w-full h-9 bg-white border border-[#B33D39] text-[#B33D39] hover:bg-[#FAECEA] rounded-[10px] font-medium text-xs transition-colors flex items-center justify-center gap-1.5"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Minta Perbaikan Bukti Bayar</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Ringkasan Finansial Tagihan */}
                <div className="p-4 bg-white border border-[#E9E5DF] rounded-[16px] shadow-xs space-y-2.5 font-sans text-xs">
                  <span className="font-sans font-semibold text-xs text-[#24221F] block mb-1">
                    Ringkasan Tagihan
                  </span>
                  <div className="flex justify-between text-[#716B64]">
                    <span className="font-sans">Subtotal Item</span>
                    <span>{formatRp(selectedOrder.subtotal)}</span>
                  </div>
                  {selectedOrder.discount > 0 && (
                    <div className="flex justify-between text-[#26786C]">
                      <span className="font-sans">Diskon Voucher</span>
                      <span>−{formatRp(selectedOrder.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[#716B64]">
                    <span className="font-sans">Ongkir</span>
                    <span>{formatRp(selectedOrder.shippingFee)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm text-[#24221F] pt-2 border-t border-[#E9E5DF]">
                    <span className="font-sans">Total Tagihan</span>
                    <span>{formatRp(selectedOrder.totalAmount)}</span>
                  </div>

                  {selectedOrder.refundAmount && selectedOrder.refundAmount > 0 && (
                    <div className="flex justify-between font-semibold text-[#426BC6] pt-1">
                      <span className="font-sans">Dana Refund:</span>
                      <span>−{formatRp(selectedOrder.refundAmount)}</span>
                    </div>
                  )}
                </div>

                {/* Fulfillment Status Controls */}
                <div className="p-4 bg-white border border-[#E9E5DF] rounded-[16px] shadow-xs space-y-3">
                  <span className="font-semibold text-xs text-[#24221F] block">
                    Ubah Status Pemenuhan
                  </span>
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => handleUpdateFulfillment(selectedOrder.orderNumber, 'PACKED')}
                      className={`w-full py-2 px-3 rounded-[8px] text-xs font-medium text-left transition-colors flex items-center justify-between ${selectedOrder.fulfillmentStatus === 'PACKED'
                        ? 'bg-[#24221F] text-white'
                        : 'bg-[#FAF9F7] hover:bg-[#F6F5F2] text-[#24221F]'
                        }`}
                    >
                      <span>1. Mulai Kemas (Siap Dikemas)</span>
                      {selectedOrder.fulfillmentStatus === 'PACKED' && <Check className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUpdateFulfillment(selectedOrder.orderNumber, 'SHIPPED')}
                      className={`w-full py-2 px-3 rounded-[8px] text-xs font-medium text-left transition-colors flex items-center justify-between ${selectedOrder.fulfillmentStatus === 'SHIPPED'
                        ? 'bg-[#24221F] text-white'
                        : 'bg-[#FAF9F7] hover:bg-[#F6F5F2] text-[#24221F]'
                        }`}
                    >
                      <span>2. Tandai Dikirim (Diserahkan JNE)</span>
                      {selectedOrder.fulfillmentStatus === 'SHIPPED' && <Check className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUpdateFulfillment(selectedOrder.orderNumber, 'DELIVERED')}
                      className={`w-full py-2 px-3 rounded-[8px] text-xs font-medium text-left transition-colors flex items-center justify-between ${selectedOrder.fulfillmentStatus === 'DELIVERED'
                        ? 'bg-[#24221F] text-white'
                        : 'bg-[#FAF9F7] hover:bg-[#F6F5F2] text-[#24221F]'
                        }`}
                    >
                      <span>3. Catat Diterima Pembeli</span>
                      {selectedOrder.fulfillmentStatus === 'DELIVERED' && <Check className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Danger Zone: Pembatalan & Refund */}
                <div className="p-4 bg-[#FAECEA]/40 border border-[#B33D39]/20 rounded-[16px] space-y-2">
                  <span className="font-semibold text-xs text-[#B33D39] block">
                    Tindakan Khusus
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCancelReason('');
                        setShowCancelModal(true);
                      }}
                      className="flex-1 py-1.5 px-2 bg-white border border-[#B33D39]/40 hover:bg-[#FAECEA] text-[#B33D39] rounded-[8px] text-[11px] font-medium transition-colors"
                    >
                      Batalkan Pesanan
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRefundAmount(selectedOrder.totalAmount);
                        setRefundReason('');
                        setIsFullRefund(true);
                        setShowRefundModal(true);
                      }}
                      className="flex-1 py-1.5 px-2 bg-white border border-[#426BC6]/40 hover:bg-blue-50 text-[#426BC6] rounded-[8px] text-[11px] font-medium transition-colors"
                    >
                      Proses Refund
                    </button>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: MINTA REVISI BUKTI BAYAR                                           */}
      {/* ========================================================================= */}
      {showRejectModal && selectedOrder && (
        <div className="fixed inset-0 bg-[#24221F]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleRejectSubmit}
            className="bg-white rounded-[20px] max-w-md w-full p-6 text-xs text-left shadow-2xl border border-[#E9E5DF] space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E9E5DF]">
              <h3 className="font-semibold text-sm text-[#24221F]">Minta Perbaikan Bukti Bayar</h3>
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="text-[#716B64] hover:text-[#24221F]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[#716B64] mb-1 font-medium">Alasan Wajib Revisi:</label>
              <textarea
                required
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Contoh: Bukti buram, nominal transfer kurang Rp10.000..."
                className="w-full p-2.5 border border-[#E9E5DF] rounded-[10px] text-xs outline-none focus:border-[#87533F]"
              />
            </div>

            <div>
              <label className="block text-[#716B64] mb-1 font-medium">Batas Waktu Upload Ulang:</label>
              <select
                value={rejectDeadlineHours}
                onChange={(e) => setRejectDeadlineHours(Number(e.target.value))}
                className="w-full h-10 px-3 border border-[#E9E5DF] rounded-[10px] bg-white text-xs outline-none"
              >
                <option value={12}>12 Jam ke depan</option>
                <option value={24}>24 Jam (1 Hari)</option>
                <option value={48}>48 Jam (2 Hari)</option>
              </select>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 border border-[#E9E5DF] rounded-[10px] text-[#716B64] font-medium"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#B33D39] text-white rounded-[10px] font-semibold"
              >
                Kirim Permintaan Revisi
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BATALKAN PESANAN (DENGAN KONSEKUENSI STOK FIFO DITAMPILKAN)        */}
      {/* ========================================================================= */}
      {showCancelModal && selectedOrder && (
        <div className="fixed inset-0 bg-[#24221F]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCancelSubmit}
            className="bg-white rounded-[20px] max-w-md w-full p-6 text-xs text-left shadow-2xl border border-[#E9E5DF] space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E9E5DF]">
              <h3 className="font-semibold text-sm text-[#B33D39]">Konfirmasi Pembatalan Pesanan</h3>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="text-[#716B64] hover:text-[#24221F]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-[#FAECEA] border border-[#B33D39]/20 rounded-[12px] text-[#B33D39] text-[11px] space-y-1">
              <p className="font-semibold">Konsekuensi Pembatalan:</p>
              <p>• Seluruh {selectedOrder.items.reduce((s, it) => s + it.quantity, 0)} unit fisik akan otomatis dikembalikan ke batch stok FIFO asal.</p>
              <p>• Transaksi ini tidak akan lagi dihitung dalam total omzet penjualan toko.</p>
            </div>

            <div>
              <label className="block text-[#716B64] mb-1 font-medium">Alasan Pembatalan:</label>
              <input
                type="text"
                required
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Contoh: Permintaan pembeli, barang rusak sebelum kirim..."
                className="w-full h-10 px-3 border border-[#E9E5DF] rounded-[10px] text-xs outline-none focus:border-[#B33D39]"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 border border-[#E9E5DF] rounded-[10px] text-[#716B64] font-medium"
              >
                Kembali
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#B33D39] text-white rounded-[10px] font-semibold"
              >
                Batalkan &amp; Kembalikan Stok
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PROSES REFUND DANA                                                 */}
      {/* ========================================================================= */}
      {showRefundModal && selectedOrder && (
        <div className="fixed inset-0 bg-[#24221F]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleRefundSubmit}
            className="bg-white rounded-[20px] max-w-md w-full p-6 text-xs text-left shadow-2xl border border-[#E9E5DF] space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E9E5DF]">
              <h3 className="font-semibold text-sm text-[#426BC6]">Proses Pengembalian Dana (Refund)</h3>
              <button
                type="button"
                onClick={() => setShowRefundModal(false)}
                className="text-[#716B64] hover:text-[#24221F]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={isFullRefund}
                    onChange={() => {
                      setIsFullRefund(true);
                      setRefundAmount(selectedOrder.totalAmount);
                    }}
                    name="refundType"
                  />
                  <span>Refund Penuh ({formatRp(selectedOrder.totalAmount)})</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!isFullRefund}
                    onChange={() => setIsFullRefund(false)}
                    name="refundType"
                  />
                  <span>Refund Sebagian</span>
                </label>
              </div>

              {!isFullRefund && (
                <div>
                  <label className="block text-[#716B64] mb-1 font-medium">Nominal Refund (Rp):</label>
                  <input
                    type="number"
                    min={1}
                    max={selectedOrder.totalAmount}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(Number(e.target.value))}
                    className="w-full h-10 px-3 border border-[#E9E5DF] rounded-[10px] font-sans text-xs outline-none"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-[#716B64] mb-1 font-medium">Alasan Pengembalian Dana:</label>
              <input
                type="text"
                required
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Contoh: Barang retur disetujui, stok kain habis..."
                className="w-full h-10 px-3 border border-[#E9E5DF] rounded-[10px] text-xs outline-none"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRefundModal(false)}
                className="px-4 py-2 border border-[#E9E5DF] rounded-[10px] text-[#716B64] font-medium"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#426BC6] text-white rounded-[10px] font-semibold"
              >
                Konfirmasi Refund
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ZOOM FOTO BUKTI PEMBAYARAN                                         */}
      {/* ========================================================================= */}
      {zoomProofUrl && (
        <div
          className="fixed inset-0 bg-black/80 z-60 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoomProofUrl(null)}
        >
          <div className="relative max-w-2xl max-h-[90vh] bg-white rounded-[16px] overflow-hidden p-2 shadow-2xl">
            <img
              src={zoomProofUrl}
              alt="Perbesaran Bukti Transfer"
              className="w-full h-full object-contain max-h-[85vh] rounded-[10px]"
            />
            <button
              type="button"
              onClick={() => setZoomProofUrl(null)}
              className="absolute top-4 right-4 bg-[#24221F] text-white p-2 rounded-full shadow-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
