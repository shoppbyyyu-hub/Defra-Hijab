import React, { useState } from 'react';
import {
  Package,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Search,
  Filter,
  Layers,
  Clock,
  ArrowRight,
  Info,
  X,
  History,
  RotateCcw
} from 'lucide-react';
import type { Product, ProductVariant } from '../../types/index.ts';
import { formatRp } from './adminUtils.ts';
import { AdminMobileListCard } from './AdminMobileListCard.tsx';

interface StockTabProps {
  products: Product[];
  token: string;
  onRefresh: () => void;
  onShowMessage: (msg: string) => void;
}

export const AdminStockTab: React.FC<StockTabProps> = ({
  products,
  token,
  onRefresh,
  onShowMessage
}) => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'LOW' | 'OUT'>('ALL');

  // Selected variant for Restock
  const [selectedVariant, setSelectedVariant] = useState<{
    variant: ProductVariant;
    product: Product;
  } | null>(null);

  // Restock Form
  const [batchCode, setBatchCode] = useState('');
  const [quantity, setQuantity] = useState(20);
  const [costPerUnit, setCostPerUnit] = useState(0);
  const [arrivalDate, setArrivalDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [correctionVariant, setCorrectionVariant] = useState<{ variant: ProductVariant; product: Product } | null>(null);
  const [correctionMode, setCorrectionMode] = useState<'STOCK' | 'COST'>('STOCK');
  const [targetPhysical, setTargetPhysical] = useState(0);
  const [correctionBatchId, setCorrectionBatchId] = useState('');
  const [correctedCost, setCorrectedCost] = useState(0);
  const [correctionReason, setCorrectionReason] = useState('');

  // Flatten all variants from all active products
  const allVariants = products.flatMap((p) =>
    p.variants.map((v) => ({
      variant: v,
      product: p
    }))
  );

  // Summary counts
  const totalVariantsCount = allVariants.length;
  const lowStockCount = allVariants.filter(
    (item) => (item.variant.availableStock ?? item.variant.physicalStock) > 0 &&
      (item.variant.availableStock ?? item.variant.physicalStock) <= 5
  ).length;
  const outOfStockCount = allVariants.filter(
    (item) => (item.variant.availableStock ?? item.variant.physicalStock) <= 0
  ).length;

  // Filtered variants
  const filteredList = allVariants.filter(({ variant, product }) => {
    const avail = variant.availableStock ?? variant.physicalStock;
    if (filterStatus === 'LOW' && (avail <= 0 || avail > 5)) return false;
    if (filterStatus === 'OUT' && avail > 0) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchProd = product.name.toLowerCase().includes(q);
      const matchColor = variant.color.toLowerCase().includes(q);
      const matchSize = (variant.size || '').toLowerCase().includes(q);
      const matchSku = (variant.sku || '').toLowerCase().includes(q);
      if (!matchProd && !matchColor && !matchSize && !matchSku) return false;
    }
    return true;
  });

  // Open restock drawer
  const handleOpenRestock = (variant: ProductVariant, product: Product) => {
    setSelectedVariant({ variant, product });
    setBatchCode(`BATCH-${Date.now().toString().slice(-6)}`);
    setQuantity(20);
    // Default cost from last batch if available
    const lastBatch = variant.batches && variant.batches.length > 0 ? variant.batches[variant.batches.length - 1] : null;
    setCostPerUnit(lastBatch?.costPerUnit || 0);
    setArrivalDate(new Date().toISOString().slice(0, 10));
    setNotes('');
  };

  const handleOpenCorrection = (variant: ProductVariant, product: Product) => {
    const batch = variant.batches?.[variant.batches.length - 1];
    setCorrectionVariant({ variant, product });
    setCorrectionMode('STOCK');
    setTargetPhysical(variant.physicalStock);
    setCorrectionBatchId(batch?.id || '');
    setCorrectedCost(batch?.costPerUnit || 0);
    setCorrectionReason('');
  };

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionVariant || correctionReason.trim().length < 3) {
      alert('Alasan koreksi wajib diisi.');
      return;
    }
    setSubmitting(true);
    try {
      const isStock = correctionMode === 'STOCK';
      const res = await fetch(isStock ? '/api/admin/products/stock-correction' : '/api/admin/products/batch-cost-correction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(isStock
          ? { variantId: correctionVariant.variant.id, targetPhysical: Number(targetPhysical), reason: correctionReason.trim() }
          : { batchId: correctionBatchId, costPerUnit: Number(correctedCost), reason: correctionReason.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Koreksi inventaris gagal disimpan.');
        return;
      }
      onShowMessage(isStock ? 'Koreksi stok berhasil dicatat.' : 'Koreksi modal batch berhasil dicatat.');
      setCorrectionVariant(null);
      await onRefresh();
    } catch {
      alert('Gagal menghubungi server. Data inventaris tidak diubah.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Restock
  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariant) return;
    if (quantity <= 0 || costPerUnit <= 0) {
      alert('Jumlah unit dan harga modal per unit harus lebih besar dari 0.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/products/restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          variantId: selectedVariant.variant.id,
          batchCode: batchCode.trim() || `BATCH-${Date.now()}`,
          quantity: Number(quantity),
          costPerUnit: Number(costPerUnit),
          arrivalDate,
          notes
        })
      });

      if (res.ok) {
        onShowMessage(
          `Restock berhasil: +${quantity} unit untuk ${selectedVariant.product.name} (${selectedVariant.variant.color}). Batch masuk tercatat di sistem FIFO.`
        );
        setSelectedVariant(null);
        onRefresh();
      } else {
        const err = await res.json();
        alert(err.error || 'Gagal memproses restock.');
      }
    } catch {
      alert('Gagal menghubungi server.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 text-[#24221F]">
      {/* HEADER & SUMMARY KPIS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E9E5DF]">
        <div>
          <h1 className="text-[26px] font-medium tracking-tight text-[#24221F]">Stok &amp; Restock Batch FIFO</h1>
          <p className="text-xs text-[#716B64] mt-0.5">

          </p>
        </div>

        {/* 3 Angka Kecil Tanpa Card Berlebihan (Sesuai Spesifikasi Poin 9) */}
        <div className="flex items-center gap-3 bg-white border border-[#E9E5DF] p-2 rounded-[14px] shadow-xs text-xs">
          <div className="px-3 py-1">
            <span className="text-[10px] uppercase font-semibold text-[#716B64] block">Total Variasi</span>
            <span className="text-base font-bold font-sans text-[#24221F] tabular-nums">{totalVariantsCount}</span>
          </div>
          <div className="h-7 w-px bg-[#E9E5DF]" />
          <div className="px-3 py-1">
            <span className="text-[10px] uppercase font-semibold text-[#94691E] block">Stok Menipis</span>
            <span className="text-base font-bold font-sans text-[#94691E] tabular-nums">{lowStockCount}</span>
          </div>
          <div className="h-7 w-px bg-[#E9E5DF]" />
          <div className="px-3 py-1">
            <span className="text-[10px] uppercase font-semibold text-[#B33D39] block">Stok Habis</span>
            <span className="text-base font-bold font-sans text-[#B33D39] tabular-nums">{outOfStockCount}</span>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="p-4 bg-white border border-[#E9E5DF] rounded-[16px] shadow-[0_6px_24px_rgba(36,34,31,.03)] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="w-4 h-4 text-[#716B64] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari nama produk, warna, ukuran, atau SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 border border-[#E9E5DF] rounded-[10px] bg-[#FAF9F7] text-xs text-[#24221F] placeholder:text-[#716B64] focus:outline-2 focus:outline-[#87533F] focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center bg-[#FAF9F7] p-0.5 rounded-[10px] border border-[#E9E5DF]">
            <button
              type="button"
              onClick={() => setFilterStatus('ALL')}
              className={`px-3 py-1.5 rounded-[8px] font-medium transition-colors ${filterStatus === 'ALL' ? 'bg-white text-[#24221F] shadow-xs' : 'text-[#716B64] hover:text-[#24221F]'
                }`}
            >
              Semua ({totalVariantsCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('LOW')}
              className={`px-3 py-1.5 rounded-[8px] font-medium transition-colors ${filterStatus === 'LOW' ? 'bg-white text-[#94691E] shadow-xs' : 'text-[#716B64] hover:text-[#94691E]'
                }`}
            >
              Menipis ({lowStockCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('OUT')}
              className={`px-3 py-1.5 rounded-[8px] font-medium transition-colors ${filterStatus === 'OUT' ? 'bg-white text-[#B33D39] shadow-xs' : 'text-[#716B64] hover:text-[#B33D39]'
                }`}
            >
              Habis ({outOfStockCount})
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {filteredList.map(({ variant, product }) => {
          const available = variant.availableStock ?? variant.physicalStock;
          const reserved = (variant.physicalStock || 0) - available;
          const activeBatches = variant.batches?.filter((batch) => batch.remainingQty > 0).length || 0;
          return <AdminMobileListCard key={variant.id} eyebrow={variant.id} title={product.name} subtitle={`${variant.color} · ${variant.size || 'Ukuran Standar'}`} thumbnail={product.imageUrl}
            fields={[{label:'Fisik',value:`${variant.physicalStock} pcs`},{label:'Ditahan',value:`${reserved} pcs`},{label:'Tersedia',value:`${available} pcs`},{label:'Batch aktif',value:activeBatches}]}
            status={<span className={available <= 0 ? 'text-[#B33D39]' : available <= 5 ? 'text-[#94691E]' : 'text-[#26786C]'}>{available <= 0 ? 'Stok habis' : available <= 5 ? 'Stok menipis' : 'Stok tersedia'}</span>}
            primaryAction={<div className="flex gap-2"><button type="button" onClick={() => handleOpenCorrection(variant, product)} className="min-h-11 px-3 rounded-[8px] border border-[#B88770] text-[#282420] inline-flex items-center gap-1.5"><RotateCcw className="w-4 h-4"/>Koreksi</button><button type="button" onClick={() => handleOpenRestock(variant, product)} className="min-h-11 px-3 rounded-[8px] bg-[#282420] text-white inline-flex items-center gap-1.5"><Plus className="w-4 h-4 text-[#B88770]"/>Restock</button></div>}
            details={<><p><strong>Kategori:</strong> {product.categoryName || 'Kategori'}</p><p><strong>HPP batch awal:</strong> {variant.batches?.length ? formatRp(variant.batches[0].costPerUnit) : 'Batch awal'}</p></>}/>
        })}
        {filteredList.length === 0 && <p className="py-6 text-center text-xs text-[#716B64]">Tidak ada variasi stok yang sesuai.</p>}
      </div>

      {/* VARIANT STOCK TABLE */}
      <div className="hidden md:block bg-white border border-[#E9E5DF] rounded-[20px] overflow-hidden shadow-[0_6px_24px_rgba(36,34,31,.04)]">
        <div className="admin-responsive-table admin-stock-table overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#FAF9F7] text-[#716B64] font-medium border-b border-[#E9E5DF]">
              <tr>
                <th className="p-4 pl-5">Produk &amp; Foto</th>
                <th className="p-4">Warna &amp; Ukuran</th>
                <th className="p-4 text-center">Fisik di Gudang</th>
                <th className="p-4 text-center">Ditahan (Cart)</th>
                <th className="p-4 text-center">Tersedia Dijual</th>
                <th className="p-4">Batch Masuk Aktif</th>
                <th className="p-4 pr-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E9E5DF]">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-[#716B64]">
                    Tidak ada variasi stok yang sesuai kriteria pencarian.
                  </td>
                </tr>
              ) : (
                filteredList.map(({ variant, product }) => {
                  const avail = variant.availableStock ?? variant.physicalStock;
                  const isOutOfStock = avail <= 0;
                  const isLow = avail > 0 && avail <= 5;
                  const reserved = (variant.physicalStock || 0) - avail;

                  return (
                    <tr key={variant.id} className="hover:bg-[#FAF9F7]/70 transition-colors">
                      <td className="p-4 pl-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#FAF9F7] border border-[#E9E5DF] rounded-[8px] overflow-hidden shrink-0">
                            <img
                              src={product.imageUrl || '/src/assets/images/cat_voal_luxury_1791700549401.jpg'}
                              alt={product.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/src/assets/images/cat_voal_luxury_1791700549401.jpg';
                              }}
                            />
                          </div>
                          <div>
                            <p className="font-semibold text-[#24221F] text-xs">{product.name}</p>
                            <span className="text-[11px] text-[#716B64] font-sans">{product.categoryName || 'Kategori'}</span>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {variant.colorHex && (
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-[#E9E5DF] shrink-0"
                              style={{ backgroundColor: variant.colorHex }}
                            />
                          )}
                          <div>
                            <span className="font-semibold text-[#24221F]">{variant.color}</span>
                            <span className="block text-[11px] text-[#716B64]">{variant.size || 'Ukuran Standar'}</span>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 text-center font-sans font-semibold text-[#24221F] tabular-nums">
                        {variant.physicalStock} pcs
                      </td>

                      <td className="p-4 text-center font-sans tabular-nums text-[#716B64]">
                        {reserved > 0 ? `${reserved} pcs` : '0'}
                      </td>

                      <td className="p-4 text-center font-sans tabular-nums">
                        {isOutOfStock ? (
                          <span className="px-2.5 py-1 rounded-[8px] inline-block bg-[#FAECEA] text-[#B33D39] font-bold">
                            {avail} pcs
                          </span>
                        ) : isLow ? (
                          <span className="px-2.5 py-1 rounded-[8px] inline-block bg-[#FEF7EA] text-[#94691E] font-bold">
                            {avail} pcs
                          </span>
                        ) : (
                          <span className="font-semibold text-[#24221F]">
                            {avail} pcs
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-xs font-sans text-[#716B64]">
                        {variant.batches && variant.batches.length > 0 ? (
                          <div className="space-y-0.5">
                            <span className="text-[11px] font-semibold text-[#24221F]">
                              {variant.batches.filter((b) => b.remainingQty > 0).length} batch aktif
                            </span>
                            <p className="text-[10px] text-[#87533F]">
                              HPP awal: {formatRp(variant.batches[0]?.costPerUnit)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#716B64]">Batch Awal</span>
                        )}
                      </td>

                      <td className="p-4 pr-5 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenCorrection(variant, product)}
                          className="px-3 py-1.5 mr-2 border border-[#B88770] text-[#282420] rounded-[8px] font-medium text-[11px] inline-flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Koreksi</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenRestock(variant, product)}
                          className="px-3 py-1.5 bg-[#24221F] hover:bg-[#40322B] text-white rounded-[8px] font-medium transition-colors text-[11px] inline-flex items-center gap-1.5 shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5 text-[#B88770]" />
                          <span>Restock</span>
                        </button>
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
      {/* DRAWER: RESTOCK VARIANT DENGAN BATCH FIFO & PREVIEW PERUBAHAN              */}
      {/* ========================================================================= */}
      {selectedVariant && (
        <div className="fixed inset-0 bg-[#24221F]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleRestockSubmit}
            className="bg-white rounded-[20px] max-w-lg w-full p-6 sm:p-7 text-xs text-left shadow-2xl border border-[#E9E5DF] space-y-5"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E9E5DF]">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#87533F]">
                  Pencatatan Masuk Gudang FIFO
                </span>
                <h3 className="text-base font-bold text-[#24221F] mt-0.5">
                  Restock: {selectedVariant.product.name}
                </h3>
                <p className="text-[11px] text-[#716B64]">
                  Warna: <strong>{selectedVariant.variant.color}</strong> · Ukuran: {selectedVariant.variant.size}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVariant(null)}
                className="w-8 h-8 rounded-[8px] bg-[#FAF9F7] hover:bg-[#F6F5F2] flex items-center justify-center text-[#716B64]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Input Form Fields */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#716B64] mb-1 font-medium">Jumlah Unit Masuk (Pcs):</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full h-10 px-3 border border-[#E9E5DF] rounded-[10px] bg-white text-xs font-sans font-bold text-[#24221F] outline-none focus:border-[#87533F]"
                  />
                </div>

                <div>
                  <label className="block text-[#716B64] mb-1 font-medium">Modal per Unit (HPP Rp):</label>
                  <input
                    type="number"
                    min={1000}
                    step={1000}
                    required
                    value={costPerUnit}
                    onChange={(e) => setCostPerUnit(Number(e.target.value))}
                    className="w-full h-10 px-3 border border-[#E9E5DF] rounded-[10px] bg-white text-xs font-sans font-bold text-[#24221F] outline-none focus:border-[#87533F]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#716B64] mb-1 font-medium">Kode Batch Masuk:</label>
                  <input
                    type="text"
                    required
                    value={batchCode}
                    onChange={(e) => setBatchCode(e.target.value)}
                    className="w-full h-10 px-3 border border-[#E9E5DF] rounded-[10px] bg-white text-xs font-sans text-[#24221F] outline-none focus:border-[#87533F]"
                  />
                </div>

                <div>
                  <label className="block text-[#716B64] mb-1 font-medium">Tanggal Kedatangan:</label>
                  <input
                    type="date"
                    required
                    value={arrivalDate}
                    onChange={(e) => setArrivalDate(e.target.value)}
                    className="w-full h-10 px-3 border border-[#E9E5DF] rounded-[10px] bg-white text-xs font-sans text-[#24221F] outline-none focus:border-[#87533F]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#716B64] mb-1 font-medium">Catatan Vendor / Jahit (Opsional):</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Produksi konveksi tahap 2 kain voal ultrafine"
                  className="w-full h-10 px-3 border border-[#E9E5DF] rounded-[10px] text-xs outline-none focus:border-[#87533F]"
                />
              </div>
            </div>

            {/* Preview Perubahan Stok & Total Modal Baru */}
            <div className="p-4 bg-[#FAF9F7] border border-[#E9E5DF] rounded-[14px] space-y-2 text-xs">
              <span className="font-semibold text-[#24221F] block text-[11px] uppercase tracking-wider">
                Pratinjau Perubahan Nilai
              </span>
              <div className="flex justify-between text-[#716B64]">
                <span>Stok Fisik Saat Ini:</span>
                <span className="font-sans font-bold text-[#24221F]">{selectedVariant.variant.physicalStock} pcs</span>
              </div>
              <div className="flex justify-between text-[#26786C]">
                <span>Tambahan Restock Baru:</span>
                <span className="font-sans font-bold">+{quantity} pcs</span>
              </div>
              <div className="flex justify-between font-bold text-[#24221F] pt-1.5 border-t border-[#E9E5DF]">
                <span>Total Fisik Baru:</span>
                <span className="font-sans text-sm text-[#24221F]">
                  {(selectedVariant.variant.physicalStock || 0) + (Number(quantity) || 0)} pcs
                </span>
              </div>
              <div className="flex justify-between text-[#87533F] pt-1">
                <span>Total Modal Dikeluarkan:</span>
                <span className="font-sans font-bold">
                  {formatRp((Number(quantity) || 0) * (Number(costPerUnit) || 0))}
                </span>
              </div>
            </div>

            {/* Riwayat Batch FIFO Sebelumnya */}
            {selectedVariant.variant.batches && selectedVariant.variant.batches.length > 0 && (
              <div className="space-y-1.5">
                <span className="font-medium text-[11px] text-[#716B64] flex items-center gap-1">
                  <History className="w-3.5 h-3.5" />
                  <span>Riwayat Batch Sebelumnya (FIFO Urutan Keluar):</span>
                </span>
                <div className="max-h-24 overflow-y-auto space-y-1 border border-[#E9E5DF] rounded-[8px] p-2 bg-white">
                  {selectedVariant.variant.batches.map((b, idx) => (
                    <div key={idx} className="flex justify-between text-[10px] font-sans text-[#716B64]">
                      <span>{b.batchCode} ({b.remainingQty}/{b.initialQty} pcs)</span>
                      <span>HPP: {formatRp(b.costPerUnit)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedVariant(null)}
                className="px-4 py-2 border border-[#E9E5DF] rounded-[10px] text-[#716B64] font-medium hover:bg-[#FAF9F7]"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-[#24221F] hover:bg-[#40322B] text-white rounded-[10px] font-semibold transition-colors disabled:opacity-50"
              >
                {submitting ? 'Menyimpan...' : 'Simpan Batch Restock'}
              </button>
            </div>
          </form>
        </div>
      )}
      {correctionVariant && (
        <div className="fixed inset-0 bg-[#24221F]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCorrectionSubmit} className="bg-white rounded-[20px] max-w-lg w-full p-6 text-xs shadow-2xl border border-[#E9E5DF] space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#E9E5DF]">
              <div><span className="text-[10px] font-semibold uppercase tracking-wider text-[#87533F]">Koreksi Tercatat</span><h3 className="text-base font-bold mt-0.5">{correctionVariant.product.name}</h3><p className="text-[11px] text-[#716B64]">{correctionVariant.variant.color} · {correctionVariant.variant.size}</p></div>
              <button type="button" onClick={() => setCorrectionVariant(null)} className="w-8 h-8 rounded-[8px] bg-[#FAF9F7] flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setCorrectionMode('STOCK')} className={`h-10 rounded-[8px] border ${correctionMode === 'STOCK' ? 'bg-[#282420] text-white' : 'border-[#E9E5DF]'}`}>Koreksi Stok</button><button type="button" disabled={!correctionVariant.variant.batches?.length} onClick={() => setCorrectionMode('COST')} className={`h-10 rounded-[8px] border disabled:opacity-40 ${correctionMode === 'COST' ? 'bg-[#282420] text-white' : 'border-[#E9E5DF]'}`}>Koreksi Modal</button></div>
            {correctionMode === 'STOCK' ? <div><label className="block text-[#716B64] mb-1">Stok fisik hasil hitung gudang</label><input type="number" min={0} required value={targetPhysical} onChange={(e) => setTargetPhysical(Number(e.target.value))} className="w-full h-10 px-3 border border-[#E9E5DF] rounded-[10px] font-sans font-bold"/><p className="mt-1 text-[10px] text-[#716B64]">Saat ini {correctionVariant.variant.physicalStock} pcs · ditahan reservasi aktif {correctionVariant.variant.activeReservations || 0} pcs.</p></div> : <><div><label className="block text-[#716B64] mb-1">Batch yang dikoreksi</label><select value={correctionBatchId} onChange={(e) => { setCorrectionBatchId(e.target.value); const batch=correctionVariant.variant.batches.find((item) => item.id===e.target.value); if(batch)setCorrectedCost(batch.costPerUnit); }} className="w-full h-10 px-3 border border-[#E9E5DF] rounded-[10px]">{correctionVariant.variant.batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.batchCode} · {formatRp(batch.costPerUnit)}</option>)}</select></div><div><label className="block text-[#716B64] mb-1">Modal per unit yang benar</label><input type="number" min={0} required value={correctedCost} onChange={(e) => setCorrectedCost(Number(e.target.value))} className="w-full h-10 px-3 border border-[#E9E5DF] rounded-[10px] font-sans font-bold"/><p className="mt-1 text-[10px] text-[#716B64]">Ditolak jika batch sudah dipakai transaksi. HPP pesanan lama tidak berubah.</p></div></>}
            <div><label className="block text-[#716B64] mb-1">Alasan koreksi</label><textarea required minLength={3} value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} className="w-full min-h-20 p-3 border border-[#E9E5DF] rounded-[10px]" placeholder="Contoh: hasil hitung fisik gudang"/></div>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setCorrectionVariant(null)} className="h-10 px-4 border border-[#E9E5DF] rounded-[10px]">Batal</button><button type="submit" disabled={submitting} className="h-10 px-5 bg-[#282420] text-white rounded-[10px] disabled:opacity-50">{submitting ? 'Menyimpan...' : 'Simpan Koreksi'}</button></div>
          </form>
        </div>
      )}
    </div>
  );
};
