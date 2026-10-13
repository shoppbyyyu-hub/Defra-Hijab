import React, { useState } from 'react';
import {
  Plus,
  Tag,
  Trash2,
  Calendar,
  Check,
  X,
  AlertCircle,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Edit2
} from 'lucide-react';
import type { Voucher, Category, Product } from '../../types/index.ts';
import { formatRp } from './adminUtils.ts';
import { AdminMobileListCard } from './AdminMobileListCard.tsx';

interface VouchersTabProps {
  vouchers: Voucher[];
  categories: Category[];
  products: Product[];
  token: string;
  onRefresh: () => void;
  onShowMessage: (msg: string) => void;
}

export const AdminVouchersTab: React.FC<VouchersTabProps> = ({
  vouchers,
  categories,
  products,
  token,
  onRefresh,
  onShowMessage
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [filterState, setFilterState] = useState<'ALL' | 'ACTIVE' | 'SCHEDULED' | 'EXPIRED'>('ALL');
  const [search, setSearch] = useState('');

  // Form State
  const [code, setCode] = useState('');
  const [promoName, setPromoName] = useState('');
  const [discountType, setDiscountType] = useState<'NOMINAL' | 'PERCENTAGE'>('NOMINAL');
  const [discountValue, setDiscountValue] = useState(25000);
  const [minOrderAmount, setMinOrderAmount] = useState(150000);
  const [maxDiscountAmount, setMaxDiscountAmount] = useState<number | undefined>(undefined);
  const [scope, setScope] = useState<'ALL' | 'CATEGORY' | 'PRODUCT'>('ALL');
  const [targetCategoryId, setTargetCategoryId] = useState('');
  const [targetProductId, setTargetProductId] = useState('');
  const [quota, setQuota] = useState(50);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [submitting, setSubmitting] = useState(false);

  // Filter vouchers
  const now = new Date();
  const filteredVouchers = vouchers.filter((v) => {
    const start = new Date(v.startDate);
    const end = new Date(v.endDate);
    const isAct = v.isActive && start <= now && end >= now;
    const isSched = v.isActive && start > now;
    const isExp = !v.isActive || end < now;

    if (filterState === 'ACTIVE' && !isAct) return false;
    if (filterState === 'SCHEDULED' && !isSched) return false;
    if (filterState === 'EXPIRED' && !isExp) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      if (!v.code.toLowerCase().includes(q) && !v.promoName.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Open add modal
  const handleOpenAdd = () => {
    setEditingVoucher(null);
    setCode('');
    setPromoName('');
    setDiscountType('NOMINAL');
    setDiscountValue(25000);
    setMinOrderAmount(150000);
    setMaxDiscountAmount(undefined);
    setScope('ALL');
    setTargetCategoryId('');
    setTargetProductId('');
    setQuota(50);
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
    setShowAddModal(true);
  };

  // Open edit modal
  const handleOpenEdit = (v: Voucher) => {
    setEditingVoucher(v);
    setCode(v.code);
    setPromoName(v.promoName);
    setDiscountType(v.discountType);
    setDiscountValue(v.discountValue);
    setMinOrderAmount(v.minOrderAmount);
    setMaxDiscountAmount(v.maxDiscountAmount);
    setScope(v.scope);
    setTargetCategoryId(v.targetCategoryId || '');
    setTargetProductId(v.targetProductId || '');
    setQuota(v.quota);
    setStartDate(v.startDate.slice(0, 10));
    setEndDate(v.endDate.slice(0, 10));
    setShowAddModal(true);
  };

  // Submit Add / Edit Voucher
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      alert('Kode voucher wajib diisi.');
      return;
    }

    if (new Date(endDate) <= new Date(startDate)) {
      alert('Tanggal berakhir harus setelah tanggal mulai berlaku.');
      return;
    }

    setSubmitting(true);
    try {
      const url = editingVoucher ? `/api/admin/vouchers/${editingVoucher.id}` : '/api/admin/vouchers';
      const method = editingVoucher ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          promoName: promoName.trim() || code.trim().toUpperCase(),
          discountType,
          discountValue: Number(discountValue),
          minOrderAmount: Number(minOrderAmount),
          maxDiscountAmount: maxDiscountAmount ? Number(maxDiscountAmount) : undefined,
          scope,
          targetCategoryId: scope === 'CATEGORY' ? targetCategoryId : undefined,
          targetProductId: scope === 'PRODUCT' ? targetProductId : undefined,
          quota: Number(quota),
          startDate: `${startDate}T00:00:00Z`,
          endDate: `${endDate}T23:59:59Z`
        })
      });

      if (res.ok) {
        onShowMessage(
          editingVoucher
            ? `Voucher promo "${code.toUpperCase()}" berhasil diperbarui.`
            : `Voucher promo "${code.toUpperCase()}" berhasil dibuat.`
        );
        setShowAddModal(false);
        setEditingVoucher(null);
        setCode('');
        setPromoName('');
        onRefresh();
      } else {
        const err = await res.json();
        alert(err.error || 'Gagal menyimpan voucher.');
      }
    } catch {
      alert('Gagal menghubungi server.');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Voucher Active
  const handleToggleActive = async (v: Voucher) => {
    try {
      const res = await fetch(`/api/admin/vouchers/${v.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isActive: !v.isActive })
      });
      if (res.ok) {
        onShowMessage(`Status voucher ${v.code} diperbarui.`);
        onRefresh();
      }
    } catch {
      alert('Gagal memperbarui status voucher.');
    }
  };

  // Delete Voucher
  const handleDelete = async (v: Voucher) => {
    if (!window.confirm(`Hapus voucher "${v.code}"?`)) return;
    try {
      const res = await fetch(`/api/admin/vouchers/${v.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        onShowMessage(`Voucher "${v.code}" berhasil dihapus.`);
        onRefresh();
      }
    } catch {
      alert('Gagal menghapus voucher.');
    }
  };

  return (
    <div className="space-y-6 text-[#24221F]">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E9E5DF]">
        <div>
          <h1 className="text-[26px] font-medium tracking-tight text-[#24221F]">Voucher &amp; Promo</h1>
          <p className="text-xs text-[#716B64] mt-0.5">
            Kelola kode diskon, kuota pemakaian, minimum belanja, dan jadwal kampanye promosi.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="h-10 px-4 bg-[#24221F] hover:bg-[#40322B] text-white rounded-[10px] text-xs font-semibold flex items-center gap-2 transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4 text-[#B88770]" />
          <span>Buat Voucher Baru</span>
        </button>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="p-4 bg-white border border-[#E9E5DF] rounded-[16px] shadow-[0_6px_24px_rgba(36,34,31,.03)] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="inline-flex items-center bg-[#FAF9F7] p-0.5 rounded-[10px] border border-[#E9E5DF]">
          <button
            type="button"
            onClick={() => setFilterState('ALL')}
            className={`px-3 py-1.5 rounded-[8px] font-medium transition-colors ${filterState === 'ALL' ? 'bg-white text-[#24221F] shadow-xs' : 'text-[#716B64]'
              }`}
          >
            Semua ({vouchers.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterState('ACTIVE')}
            className={`px-3 py-1.5 rounded-[8px] font-medium transition-colors ${filterState === 'ACTIVE' ? 'bg-white text-[#26786C] shadow-xs font-semibold' : 'text-[#716B64]'
              }`}
          >
            Aktif Berjalan
          </button>
          <button
            type="button"
            onClick={() => setFilterState('SCHEDULED')}
            className={`px-3 py-1.5 rounded-[8px] font-medium transition-colors ${filterState === 'SCHEDULED' ? 'bg-white text-[#94691E] shadow-xs font-semibold' : 'text-[#716B64]'
              }`}
          >
            Terjadwal
          </button>
          <button
            type="button"
            onClick={() => setFilterState('EXPIRED')}
            className={`px-3 py-1.5 rounded-[8px] font-medium transition-colors ${filterState === 'EXPIRED' ? 'bg-white text-[#B33D39] shadow-xs font-semibold' : 'text-[#716B64]'
              }`}
          >
            Kedaluwarsa
          </button>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-[#716B64] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari kode promo atau nama promo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 border border-[#E9E5DF] rounded-[10px] bg-[#FAF9F7] text-xs text-[#24221F] outline-none focus:border-[#87533F] focus:bg-white"
          />
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {filteredVouchers.map((v) => {
          const used = v.usedCount || 0;
          const reserved = v.reservedQuota || 0;
          const available = Math.max(0, v.quota - used - reserved);
          const expired = new Date(v.endDate) < now;
          return <AdminMobileListCard key={v.id} eyebrow={v.code} date={v.endDate.slice(0, 10)} title={v.promoName} subtitle={v.scope === 'ALL' ? 'Semua Produk' : v.scope === 'CATEGORY' ? 'Kategori Khusus' : 'Produk Tertentu'}
            fields={[{label:'Diskon',value:v.discountType === 'NOMINAL' ? formatRp(v.discountValue) : `${v.discountValue}%`},{label:'Min. belanja',value:formatRp(v.minOrderAmount)},{label:'Tersedia',value:`${available} / ${v.quota}`},{label:'Ditahan',value:`${reserved} kuota`}]}
            status={<span className={v.isActive && !expired ? 'text-[#26786C]' : 'text-[#B33D39]'}>{v.isActive && !expired ? 'Aktif' : expired ? 'Kedaluwarsa' : 'Nonaktif'}</span>}
            primaryAction={<button type="button" onClick={() => handleToggleActive(v)} className="min-h-11 px-3 rounded-[8px] bg-[#282420] text-white">{v.isActive && !expired ? 'Nonaktifkan' : 'Aktifkan'}</button>}
            details={<><p><strong>Berlaku:</strong> {v.startDate.slice(0,10)} s/d {v.endDate.slice(0,10)}</p>{v.discountType !== 'NOMINAL' && <p><strong>Maks. diskon:</strong> {formatRp(v.maxDiscountAmount || 0)}</p>}</>}
            actions={<><button type="button" onClick={() => handleOpenEdit(v)} className="min-h-11 px-3 rounded-[8px] bg-[#F3EBDF] inline-flex items-center gap-1.5"><Edit2 className="w-4 h-4"/>Edit</button><button type="button" onClick={() => handleDelete(v)} className="min-h-11 px-3 rounded-[8px] text-[#B33D39] inline-flex items-center gap-1.5"><Trash2 className="w-4 h-4"/>Hapus</button></>}/>
        })}
        {filteredVouchers.length === 0 && <p className="py-6 text-center text-xs text-[#716B64]">Belum ada voucher yang sesuai.</p>}
      </div>

      {/* VOUCHERS TABLE */}
      <div className="hidden md:block bg-white border border-[#E9E5DF] rounded-[20px] overflow-hidden shadow-[0_6px_24px_rgba(36,34,31,.04)]">
        <div className="admin-responsive-table admin-vouchers-table overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#FAF9F7] text-[#716B64] font-medium border-b border-[#E9E5DF]">
              <tr>
                <th className="p-4 pl-5">Kode Promo &amp; Nama</th>
                <th className="p-4">Nilai Diskon</th>
                <th className="p-4">Min. Belanja</th>
                <th className="p-4">Cakupan Produk</th>
                <th className="p-4 text-center">Kuota (Tersedia / Terpakai)</th>
                <th className="p-4">Masa Berlaku</th>
                <th className="p-4 pr-5 text-right">Status &amp; Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E9E5DF]">
              {filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-[#716B64]">
                    Belum ada voucher yang sesuai filter pencarian.
                  </td>
                </tr>
              ) : (
                filteredVouchers.map((v) => {
                  const used = v.usedCount || 0;
                  const reserved = v.reservedQuota || 0;
                  const available = Math.max(0, v.quota - used - reserved);
                  const isExp = new Date(v.endDate) < now;

                  return (
                    <tr key={v.id} className="hover:bg-[#FAF9F7]/70 transition-colors">
                      <td className="p-4 pl-5">
                        <div className="flex items-center gap-2.5">
                          <span className="px-2.5 py-1 bg-[#FAF9F7] border border-[#E9E5DF] text-[#87533F] font-sans font-bold rounded-[6px] tracking-wider">
                            {v.code}
                          </span>
                          <div>
                            <p className="font-semibold text-xs text-[#24221F]">{v.promoName}</p>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 font-sans font-bold text-xs text-[#26786C]">
                        {v.discountType === 'NOMINAL' ? (
                          formatRp(v.discountValue)
                        ) : (
                          `${v.discountValue}% (Maks. ${formatRp(v.maxDiscountAmount || 0)})`
                        )}
                      </td>

                      <td className="p-4 font-sans text-xs text-[#716B64]">
                        {formatRp(v.minOrderAmount)}
                      </td>

                      <td className="p-4 text-xs text-[#716B64]">
                        {v.scope === 'ALL'
                          ? 'Semua Produk'
                          : v.scope === 'CATEGORY'
                            ? 'Kategori Khusus'
                            : 'Produk Tertentu'}
                      </td>

                      <td className="p-4 text-center font-sans text-xs">
                        <span className="font-bold text-[#24221F]">{available}</span>
                        <span className="text-[#716B64]"> / {v.quota}</span>
                        {reserved > 0 && (
                          <span className="block text-[10px] text-[#94691E] mt-0.5">
                            ({reserved} ditahan cart)
                          </span>
                        )}
                      </td>

                      <td className="p-4 font-sans text-[11px] text-[#716B64] whitespace-nowrap">
                        {v.startDate.slice(0, 10)} s/d {v.endDate.slice(0, 10)}
                      </td>

                      <td className="p-4 pr-5 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(v)}
                            className="px-2.5 py-1 bg-[#FAF9F7] hover:bg-[#F6F5F2] border border-[#E9E5DF] text-[#24221F] rounded-[6px] text-[11px] font-medium transition-colors inline-flex items-center gap-1"
                            title="Edit Data Voucher"
                          >
                            <Edit2 className="w-3 h-3 text-[#87533F]" />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleActive(v)}
                            className={`px-2.5 py-1 rounded-[6px] text-[11px] font-semibold transition-colors ${v.isActive && !isExp
                                ? 'bg-[#E8F3EF] text-[#26786C] hover:bg-[#D5EADF]'
                                : 'bg-[#FAECEA] text-[#B33D39] hover:bg-[#F2D7D4]'
                              }`}
                          >
                            {v.isActive && !isExp ? 'Aktif' : 'Nonaktif'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(v)}
                            className="p-1.5 text-[#716B64] hover:text-[#B33D39] hover:bg-[#FAECEA] rounded-[6px] transition-colors"
                            title="Hapus Voucher"
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

      {/* MODAL: BUAT VOUCHER BARU */}
      {showAddModal && (
        <div className="fixed inset-0 bg-[#24221F]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleAddSubmit}
            className="bg-white rounded-[20px] max-w-lg w-full p-6 sm:p-7 text-xs text-left shadow-2xl border border-[#E9E5DF] space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E9E5DF]">
              <h3 className="font-semibold text-sm text-[#24221F]">
                {editingVoucher ? `Edit Voucher Promo: ${editingVoucher.code}` : 'Buat Voucher Promo Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-[#716B64]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#716B64] mb-1 font-medium">Kode Kupon (Huruf Besar):</label>
                <input
                  type="text"
                  required
                  placeholder="DEFRA25K"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full h-10 px-3 border border-[#E9E5DF] rounded-[10px] font-sans font-bold text-xs uppercase outline-none focus:border-[#87533F]"
                />
              </div>

              <div>
                <label className="block text-[#716B64] mb-1 font-medium">Nama / Label Promosi:</label>
                <input
                  type="text"
                  required
                  placeholder="Diskon Pembukaan Spesial"
                  value={promoName}
                  onChange={(e) => setPromoName(e.target.value)}
                  className="w-full h-10 px-3 border border-[#E9E5DF] rounded-[10px] text-xs outline-none focus:border-[#87533F]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#716B64] mb-1 font-medium">Tipe Potongan Diskon:</label>
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as any)}
                  className="w-full h-10 px-3 border border-[#E9E5DF] rounded-[10px] bg-white text-xs outline-none"
                >
                  <option value="NOMINAL">Nominal Tetap (Rp)</option>
                  <option value="PERCENTAGE">Persentase (%)</option>
                </select>
              </div>

              <div>
                <label className="block text-[#716B64] mb-1 font-medium">
                  {discountType === 'NOMINAL' ? 'Nominal Potongan (Rp):' : 'Nilai Persen (%):'}
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                  className="w-full h-10 px-3 border border-[#E9E5DF] rounded-[10px] font-sans font-bold text-xs outline-none focus:border-[#87533F]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#716B64] mb-1 font-medium">Min. Belanja Pesanan (Rp):</label>
                <input
                  type="number"
                  min={0}
                  step={5000}
                  required
                  value={minOrderAmount}
                  onChange={(e) => setMinOrderAmount(Number(e.target.value))}
                  className="w-full h-10 px-3 border border-[#E9E5DF] rounded-[10px] font-sans text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-[#716B64] mb-1 font-medium">Kuota Jumlah Pemakaian:</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={quota}
                  onChange={(e) => setQuota(Number(e.target.value))}
                  className="w-full h-10 px-3 border border-[#E9E5DF] rounded-[10px] font-sans text-xs outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#716B64] mb-1 font-medium">Tanggal Mulai:</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-10 px-3 border border-[#E9E5DF] rounded-[10px] font-sans text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-[#716B64] mb-1 font-medium">Tanggal Berakhir:</label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full h-10 px-3 border border-[#E9E5DF] rounded-[10px] font-sans text-xs outline-none"
                />
              </div>
            </div>

            {/* Scope selection */}
            <div>
              <label className="block text-[#716B64] mb-1 font-medium">Cakupan Keberlakuan Voucher:</label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as any)}
                className="w-full h-10 px-3 border border-[#E9E5DF] rounded-[10px] bg-white text-xs outline-none"
              >
                <option value="ALL">Berlaku untuk Semua Produk Toko</option>
                <option value="CATEGORY">Hanya Kategori Tertentu</option>
                <option value="PRODUCT">Hanya Produk Spesifik</option>
              </select>
            </div>

            {scope === 'CATEGORY' && (
              <div>
                <label className="block text-[#716B64] mb-1 font-medium">Pilih Kategori:</label>
                <select
                  value={targetCategoryId}
                  onChange={(e) => setTargetCategoryId(e.target.value)}
                  className="w-full h-10 px-3 border border-[#E9E5DF] rounded-[10px] bg-white text-xs outline-none"
                >
                  <option value="">Pilih Kategori...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {scope === 'PRODUCT' && (
              <div>
                <label className="block text-[#716B64] mb-1 font-medium">Pilih Produk:</label>
                <select
                  value={targetProductId}
                  onChange={(e) => setTargetProductId(e.target.value)}
                  className="w-full h-10 px-3 border border-[#E9E5DF] rounded-[10px] bg-white text-xs outline-none"
                >
                  <option value="">Pilih Produk...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-[#E9E5DF] rounded-[10px] text-[#716B64] font-medium"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-[#24221F] text-white rounded-[10px] font-semibold transition-colors disabled:opacity-50"
              >
                {submitting ? 'Menyimpan...' : 'Simpan Voucher'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
