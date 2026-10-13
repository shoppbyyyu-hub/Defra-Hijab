import React, { useState, useRef } from 'react';
import {
  Plus,
  Edit2,
  Archive,
  Trash2,
  Tag,
  Package,
  Layers,
  Check,
  X,
  Upload,
  AlertCircle,
  Eye,
  Search,
  DollarSign,
  ChevronRight
} from 'lucide-react';
import type { Product, Category, ProductVariant } from '../../types/index.ts';
import { formatRp } from './adminUtils.ts';
import categoryFallback from '../../assets/images/cat_voal_luxury_1791700549401.jpg';
import silkFallback from '../../assets/images/product_silk_hijab_1791700562716.jpg';

interface ProductsTabProps {
  products: Product[];
  categories: Category[];
  token: string;
  onRefresh: () => void;
  onShowMessage: (msg: string) => void;
  onManageStock?: () => void;
}

export const AdminProductsTab: React.FC<ProductsTabProps> = ({
  products,
  categories,
  token,
  onRefresh,
  onShowMessage,
  onManageStock
}) => {
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [search, setSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');

  // Modal / Drawer states
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [pricingProduct, setPricingProduct] = useState<Product | null>(null);

  // Editor Form Tabs: 'IDENTITY' | 'COLORS_PHOTOS' | 'SIZES_VARIANTS' | 'PRICING' | 'PREVIEW'
  const [editorStep, setEditorStep] = useState<'IDENTITY' | 'COLORS' | 'VARIANTS' | 'PRICING' | 'PREVIEW'>('IDENTITY');

  // Product Form Fields
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [description, setDescription] = useState('');
  const [basePrice, setBasePrice] = useState(165000);
  const [discountPrice, setDiscountPrice] = useState<number | undefined>(undefined);
  const [weightGrams, setWeightGrams] = useState(150);
  const [imageUrl, setImageUrl] = useState(categoryFallback);
  const [coverImageChanged, setCoverImageChanged] = useState(false);
  const [uploadingMain, setUploadingMain] = useState(false);

  // Sizes List (Chip editable)
  const [sizesList, setSizesList] = useState<string[]>(['115 x 115 cm', '120 x 120 cm']);
  const [newSizeInput, setNewSizeInput] = useState('');

  // Colors List with Per-Color Galleries
  const [colorsList, setColorsList] = useState<Array<{
    color: string;
    colorHex: string;
    images: string[];
  }>>([
    { color: 'Rose Dust', colorHex: '#B88770', images: [categoryFallback] },
    { color: 'Warm Almond', colorHex: '#D4B996', images: [silkFallback] }
  ]);
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#B88770');
  const [newColorImages, setNewColorImages] = useState<string[]>([]);
  const [uploadingNewColor, setUploadingNewColor] = useState(false);

  // Combination stocks mapping: `${color}__${size}` -> { initialStock, costPerUnit }
  const [combinationStocks, setCombinationStocks] = useState<Record<string, { initialStock: number; costPerUnit: number }>>({});

  // Interactive preview selected color
  const [previewColorIdx, setPreviewColorIdx] = useState(0);

  // Quick Pricing State
  const [editBasePrice, setEditBasePrice] = useState(0);
  const [editDiscountPrice, setEditDiscountPrice] = useState<number | ''>('');

  const mainFileInputRef = useRef<HTMLInputElement>(null);

  // Filter products by tab & search
  const filteredProducts = products.filter((p) => {
    if (activeTab === 'ACTIVE' && p.isArchived) return false;
    if (activeTab === 'ARCHIVED' && !p.isArchived) return false;

    if (selectedCategoryFilter !== 'ALL' && p.categoryId !== selectedCategoryFilter) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchCat = (p.categoryName || '').toLowerCase().includes(q);
      if (!matchName && !matchCat) return false;
    }
    return true;
  });

  // Open add product modal
  const handleOpenAdd = () => {
    setEditingProduct(null);
    setName('');
    setCategoryId(categories[0]?.id || '');
    setDescription('');
    setBasePrice(165000);
    setDiscountPrice(undefined);
    setWeightGrams(150);
    setImageUrl(categoryFallback);
    setCoverImageChanged(false);
    setSizesList(['115 x 115 cm']);
    setColorsList([]);
    setNewColorName('');
    setNewColorHex('#B88770');
    setNewColorImages([]);
    setCombinationStocks({});
    setEditorStep('IDENTITY');
    setShowEditorModal(true);
  };

  // Open edit product modal
  const handleOpenEdit = (prod: Product) => {
    setEditingProduct(prod);
    setName(prod.name);
    setCategoryId(prod.categoryId);
    setDescription(prod.description || '');
    setBasePrice(prod.basePrice);
    setDiscountPrice(prod.discountPrice);
    setWeightGrams(prod.weightGrams || 150);
    setImageUrl(prod.imageUrl || categoryFallback);
    setCoverImageChanged(false);
    setSizesList(prod.sizes && prod.sizes.length > 0 ? prod.sizes : ['115 x 115 cm']);

    if (prod.colorGalleries && prod.colorGalleries.length > 0) {
      setColorsList(
        prod.colorGalleries.map((cg) => ({
          color: cg.color,
          colorHex: cg.colorHex || '#B88770',
          images: cg.images || []
        }))
      );
    } else if (prod.colors && prod.colors.length > 0) {
      setColorsList(
        prod.colors.map((c) => ({
          color: c.color,
          colorHex: c.colorHex || '#B88770',
          images: prod.imageUrl ? [prod.imageUrl] : []
        }))
      );
    } else {
      setColorsList([
        { color: 'Rose Dust', colorHex: '#B88770', images: [prod.imageUrl || categoryFallback] }
      ]);
    }

    const stocks: Record<string, { initialStock: number; costPerUnit: number }> = {};
    prod.variants.forEach((v) => {
      stocks[`${v.color}__${v.size}`] = {
        initialStock: v.physicalStock,
        costPerUnit: v.batches?.[0]?.costPerUnit || 60000
      };
    });
    setCombinationStocks(stocks);
    setEditorStep('IDENTITY');
    setShowEditorModal(true);
  };

  // Delete product
  const handleDeleteProduct = async (prod: Product) => {
    if (!window.confirm(`Hapus produk "${prod.name}" secara permanen?\n\nProduk hanya dapat dihapus jika tidak memiliki riwayat pesanan, reservasi, atau retur. Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/products/${prod.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        onShowMessage(`Produk "${prod.name}" berhasil dihapus dari database.`);
        await onRefresh();
      } else {
        const data = await res.json();
        if (res.status === 409 && data.code === 'PRODUCT_REFERENCED' && data.canArchive) {
          if (prod.isArchived) {
            alert(data.error || 'Produk masih memiliki referensi dan tidak dapat dihapus.');
          } else if (window.confirm(`${data.error}\n\nArsipkan produk ini sekarang?`)) {
            await handleToggleArchive(prod);
          }
          return;
        }
        alert(data.error || 'Gagal menghapus produk.');
      }
    } catch {
      alert('Terjadi kesalahan jaringan.');
    }
  };

  // Upload main image
  const handleMainUpload = async (file: File) => {
    if (file.size > 2000000) {
      alert('Ukuran file melebihi 2 MB. Harap pilih gambar di bawah 2 MB.');
      return;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      alert('Format file tidak didukung. Harap gunakan format JPG, PNG, atau WebP.');
      return;
    }

    setUploadingMain(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/admin/upload-media', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setImageUrl(data.url);
        setCoverImageChanged(true);
        onShowMessage('Foto utama produk berhasil diunggah.');
      } else {
        alert(data.error || 'Gagal mengunggah foto.');
      }
    } catch {
      alert('Terjadi kesalahan jaringan.');
    } finally {
      setUploadingMain(false);
    }
  };

  // Upload color gallery photos
  const handleColorGalleryUpload = async (colorIdx: number, files: FileList) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 2000000) {
        alert(`File ${file.name} melebihi 2 MB dan dilewati.`);
        continue;
      }
      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowed.includes(file.type)) {
        alert(`Format file ${file.name} tidak didukung.`);
        continue;
      }
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('/api/admin/upload-media', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        const data = await res.json();
        if (res.ok && data.url) {
          setColorsList((prev) => {
            const next = [...prev];
            next[colorIdx].images = [...next[colorIdx].images, data.url];
            return next;
          });
          onShowMessage(`Foto galeri warna ${colorsList[colorIdx].color} berhasil diunggah.`);
        }
      } catch {
        alert('Gagal mengunggah foto galeri.');
      }
    }
  };

  const uploadColorFile = async (file: File): Promise<string | null> => {
    if (file.size > 2000000) {
      alert(`File ${file.name} melebihi 2 MB.`);
      return null;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert(`Format file ${file.name} tidak didukung.`);
      return null;
    }
    const uploadData = new FormData();
    uploadData.append('file', file);
    const response = await fetch('/api/admin/upload-media', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: uploadData
    });
    const data = await response.json();
    if (!response.ok || !data.url) throw new Error(data.error || 'Gagal mengunggah foto warna.');
    return data.url;
  };

  const handleNewColorPhotos = async (files: FileList, replaceIndex?: number) => {
    setUploadingNewColor(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const url = await uploadColorFile(file);
        if (url) uploaded.push(url);
      }
      if (uploaded.length) {
        setNewColorImages((previous) => {
          if (replaceIndex === undefined) return [...previous, ...uploaded];
          const next = [...previous];
          next[replaceIndex] = uploaded[0];
          return next;
        });
      }
    } catch (error: any) {
      alert(error.message || 'Gagal mengunggah foto warna. Data warna tetap tersimpan.');
    } finally {
      setUploadingNewColor(false);
    }
  };

  // Add Size Chip
  const handleAddSizeChip = () => {
    if (!newSizeInput.trim()) return;
    if (!sizesList.includes(newSizeInput.trim())) {
      setSizesList([...sizesList, newSizeInput.trim()]);
    }
    setNewSizeInput('');
  };

  const handleRemoveSizeChip = (sz: string) => {
    if (sizesList.length <= 1) {
      alert('Minimal 1 ukuran wajib tersedia.');
      return;
    }
    setSizesList(sizesList.filter((s) => s !== sz));
  };

  // Add Color Item
  const handleAddColorItem = () => {
    if (!newColorName.trim() || !/^#[0-9A-F]{6}$/i.test(newColorHex) || newColorImages.length === 0) return;
    if (colorsList.some((item) => item.color.toLowerCase() === newColorName.trim().toLowerCase())) {
      alert('Nama warna sudah digunakan.');
      return;
    }
    setColorsList([
      ...colorsList,
      { color: newColorName.trim(), colorHex: newColorHex, images: [...newColorImages] }
    ]);
    setNewColorName('');
    setNewColorImages([]);
  };

  const handleRemoveColorItem = (idx: number) => {
    if (colorsList.length <= 1) {
      alert('Minimal 1 warna wajib tersedia.');
      return;
    }
    setColorsList(colorsList.filter((_, i) => i !== idx));
  };

  // Submit Add Product Form
  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !categoryId || sizesList.length === 0 || colorsList.length === 0) {
      alert('Nama, kategori, ukuran, dan warna wajib diisi.');
      return;
    }

    const variantsPayload: any[] = [];
    colorsList.forEach((c) => {
      sizesList.forEach((sz) => {
        const key = `${c.color}__${sz}`;
        const comb = combinationStocks[key] || { initialStock: 15, costPerUnit: 65000 };
        variantsPayload.push({
          color: c.color,
          colorHex: c.colorHex,
          size: sz,
          initialStock: Number(comb.initialStock) || 0,
          costPerUnit: Number(comb.costPerUnit) || 60000
        });
      });
    });

    const colorGalleriesPayload = colorsList.map((c, index) => ({
      color: c.color,
      colorHex: c.colorHex,
      images: coverImageChanged && index === 0
        ? [imageUrl, ...c.images.filter((item) => item !== imageUrl).slice(1)]
        : (c.images.length > 0 ? c.images : [imageUrl])
    }));

    try {
      const url = editingProduct ? `/api/admin/products/${editingProduct.id}` : '/api/admin/products';
      const method = editingProduct ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: name.trim(),
          categoryId,
          description,
          basePrice: Number(basePrice),
          discountPrice: discountPrice ? Number(discountPrice) : undefined,
          weightGrams: Number(weightGrams),
          imageUrl,
          sizes: sizesList,
          colors: colorGalleriesPayload.map((cg) => ({ color: cg.color, colorHex: cg.colorHex })),
          colorGalleries: colorGalleriesPayload,
          variants: editingProduct
            ? variantsPayload.map((variant) => ({ ...variant, initialStock: 0, costPerUnit: 0 }))
            : variantsPayload
        })
      });

      if (res.ok) {
        onShowMessage(
          editingProduct
            ? `Produk "${name}" berhasil diperbarui.`
            : `Produk baru "${name}" berhasil ditambahkan ke katalog.`
        );
        setShowEditorModal(false);
        setEditingProduct(null);
        await onRefresh();
      } else {
        const err = await res.json();
        alert(err.error || 'Gagal menyimpan produk.');
      }
    } catch {
      alert('Terjadi kendala saat menghubungi server.');
    }
  };

  // Toggle Archive
  const handleToggleArchive = async (prod: Product) => {
    const nextState = !prod.isArchived;
    try {
      const res = await fetch(`/api/admin/products/${prod.id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isArchived: nextState })
      });
      if (res.ok) {
        onShowMessage(`Produk "${prod.name}" berhasil ${nextState ? 'diarsipkan' : 'diaktifkan kembali'}.`);
        await onRefresh();
      } else {
        const data = await res.json();
        alert(data.error || 'Gagal mengubah status arsip produk.');
      }
    } catch {
      alert('Gagal mengubah status arsip produk.');
    }
  };

  // Quick Pricing Submit
  const handlePricingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pricingProduct) return;
    try {
      const res = await fetch(`/api/admin/products/${pricingProduct.id}/pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          basePrice: Number(editBasePrice),
          discountPrice: editDiscountPrice ? Number(editDiscountPrice) : undefined
        })
      });
      if (res.ok) {
        onShowMessage(`Harga produk "${pricingProduct.name}" berhasil diperbarui.`);
        setPricingProduct(null);
        onRefresh();
      } else {
        alert('Gagal memperbarui harga produk.');
      }
    } catch {
      alert('Gagal menghubungi server.');
    }
  };

  return (
    <div className="space-y-6 text-[#24221F]">
      {/* HEADER & TOP CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E9E5DF]">
        <div>
          <h1 className="text-[26px] font-medium tracking-tight text-[#24221F]">Katalog Produk</h1>
          <p className="text-xs text-[#716B64] mt-0.5">
            Tambah dan edit produk, foto, warna, ukuran, harga, diskon, serta berat pengiriman.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleOpenAdd}
            className="h-10 px-4 bg-[#24221F] hover:bg-[#40322B] text-white rounded-[10px] text-xs font-semibold flex items-center gap-2 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4 text-[#B88770]" />
            <span>Tambah Produk Baru</span>
          </button>
        </div>
      </div>

      {/* TABS & SEARCH BAR */}
      <div className="p-4 bg-white border border-[#E9E5DF] rounded-[16px] shadow-[0_6px_24px_rgba(36,34,31,.03)] flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Tab Aktif vs Arsip */}
        <div className="inline-flex items-center bg-[#FAF9F7] p-0.5 rounded-[10px] border border-[#E9E5DF]">
          <button
            type="button"
            onClick={() => setActiveTab('ACTIVE')}
            className={`px-3 py-1.5 rounded-[8px] font-medium transition-colors ${activeTab === 'ACTIVE'
              ? 'bg-white text-[#24221F] shadow-xs'
              : 'text-[#716B64] hover:text-[#24221F]'
              }`}
          >
            Katalog Aktif ({products.filter((p) => !p.isArchived).length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ARCHIVED')}
            className={`px-3 py-1.5 rounded-[8px] font-medium transition-colors ${activeTab === 'ARCHIVED'
              ? 'bg-white text-[#24221F] shadow-xs'
              : 'text-[#716B64] hover:text-[#24221F]'
              }`}
          >
            Diarsipkan ({products.filter((p) => p.isArchived).length})
          </button>
        </div>

        {/* Search & Category Filter */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1 max-w-lg justify-end">
          <div className="relative min-w-[200px] flex-1">
            <Search className="w-4 h-4 text-[#716B64] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari nama produk..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 border border-[#E9E5DF] rounded-[10px] bg-[#FAF9F7] text-xs text-[#24221F] outline-none focus:border-[#87533F] focus:bg-white"
            />
          </div>

          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="h-9 px-3 border border-[#E9E5DF] rounded-[10px] bg-[#FAF9F7] text-xs text-[#24221F] outline-none"
          >
            <option value="ALL">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* PRODUCTS TABLE */}
      <div className="bg-white border border-[#E9E5DF] rounded-[20px] overflow-hidden shadow-[0_6px_24px_rgba(36,34,31,.04)]">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#FAF9F7] text-[#716B64] font-medium border-b border-[#E9E5DF]">
              <tr>
                <th className="p-4 pl-5">Produk</th>
                <th className="p-4">Kategori</th>
                <th className="p-4">Variasi</th>
                <th className="p-4">Harga Normal / Sale</th>
                <th className="p-4 text-center">Stok Tersedia</th>
                <th className="p-4 text-center">Unit Terjual</th>
                <th className="p-4 pr-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E9E5DF]">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-[#716B64]">
                    Tidak ada produk pada tampilan ini.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const totalAvail = p.variants.reduce((sum, v) => sum + (v.availableStock ?? v.physicalStock), 0);
                  const hasDiscount = Boolean(p.discountPrice && p.discountPrice > 0 && p.discountPrice < p.basePrice);

                  return (
                    <tr key={p.id} className="hover:bg-[#FAF9F7]/70 transition-colors">
                      <td className="p-4 pl-5">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 bg-[#FAF9F7] border border-[#E9E5DF] rounded-[10px] overflow-hidden shrink-0">
                            <img
                              src={p.imageUrl || categoryFallback}
                              alt={p.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = categoryFallback;
                              }}
                            />
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-[#24221F]">{p.name}</p>
                            <span className="text-[11px] text-[#716B64] font-sans">
                              Berat: {p.weightGrams || 150}g
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 text-xs text-[#716B64] font-medium">
                        {p.categoryName || 'Koleksi'}
                      </td>

                      <td className="p-4 text-xs font-sans">
                        <span className="font-semibold text-[#24221F]">{p.variants.length} variasi</span>
                        <div className="flex items-center gap-1 mt-1">
                          {p.colors?.slice(0, 4).map((c, i) => (
                            <span
                              key={i}
                              className="w-3 h-3 rounded-full border border-[#E9E5DF] inline-block"
                              style={{ backgroundColor: c.colorHex || '#B88770' }}
                              title={c.color}
                            />
                          ))}
                          {p.colors && p.colors.length > 4 && (
                            <span className="text-[10px] text-[#716B64]">+{p.colors.length - 4}</span>
                          )}
                        </div>
                      </td>

                      <td className="p-4 font-sans text-xs">
                        {hasDiscount ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-[#B88770] tabular-nums">
                                {formatRp(p.discountPrice)}
                              </span>
                              <span className="px-1.5 py-0.2 bg-[#FAF9F7] text-[#87533F] border border-[#DCC39B] rounded text-[10px] font-semibold">
                                SALE
                              </span>
                            </div>
                            <span className="line-through text-[#716B64]/70 text-[11px] tabular-nums block">
                              {formatRp(p.basePrice)}
                            </span>
                          </div>
                        ) : (
                          <span className="font-bold text-[#24221F] tabular-nums">
                            {formatRp(p.basePrice)}
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-center font-sans tabular-nums">
                        {totalAvail <= 0 ? (
                          <span className="px-2.5 py-1 rounded-[8px] inline-block bg-[#FAECEA] text-[#B33D39] font-bold">
                            {totalAvail} pcs
                          </span>
                        ) : totalAvail <= 10 ? (
                          <span className="px-2.5 py-1 rounded-[8px] inline-block bg-[#FEF7EA] text-[#94691E] font-bold">
                            {totalAvail} pcs
                          </span>
                        ) : (
                          <span className="font-semibold text-[#24221F]">
                            {totalAvail} pcs
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-center font-sans font-semibold text-[#24221F] tabular-nums">
                        {p.totalSoldUnits || 0} pcs
                      </td>

                      <td className="p-4 pr-5 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(p)}
                            className="px-2.5 py-1.5 bg-[#FAF9F7] hover:bg-[#F6F5F2] border border-[#E9E5DF] text-[#24221F] rounded-[8px] font-medium transition-colors text-[11px] inline-flex items-center gap-1"
                            title="Edit Data Produk Lengkap"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-[#87533F]" />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setPricingProduct(p);
                              setEditBasePrice(p.basePrice);
                              setEditDiscountPrice(p.discountPrice || '');
                            }}
                            className="px-2.5 py-1.5 bg-[#FAF9F7] hover:bg-[#F6F5F2] border border-[#E9E5DF] text-[#24221F] rounded-[8px] font-medium transition-colors text-[11px] inline-flex items-center gap-1"
                            title="Atur Harga & Promo Sale"
                          >
                            <DollarSign className="w-3.5 h-3.5 text-[#87533F]" />
                            <span>Harga</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleArchive(p)}
                            className={`px-2.5 py-1.5 rounded-[8px] font-medium transition-colors text-[11px] inline-flex items-center gap-1 ${p.isArchived
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-[#FAF9F7] hover:bg-[#F6F5F2] border border-[#E9E5DF] text-[#716B64]'
                              }`}
                            title={p.isArchived ? 'Pulihkan ke Katalog Aktif' : 'Arsipkan Produk'}
                          >
                            <Archive className="w-3.5 h-3.5" />
                            <span>{p.isArchived ? 'Pulihkan' : 'Arsipkan'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(p)}
                            className="p-1.5 text-[#716B64] hover:text-[#B33D39] hover:bg-[#FAECEA] rounded-[8px] transition-colors"
                            title="Hapus Produk dari Database"
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
      {/* DRAWER: TAMBAH PRODUK BARU LENGKAP DENGAN COLOR GALLERY & PREVIEW          */}
      {/* ========================================================================= */}
      {showEditorModal && (
        <div className="fixed inset-0 bg-[#24221F]/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <form
            onSubmit={handleSubmitProduct}
            className="bg-white rounded-[20px] max-w-4xl w-full max-h-[92vh] overflow-y-auto p-6 sm:p-8 text-xs text-left shadow-2xl border border-[#E9E5DF] space-y-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#E9E5DF]">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#87533F]">
                  Formulir Katalog Busana
                </span>
                <h2 className="text-xl font-bold text-[#24221F] mt-0.5">
                  {editingProduct ? `Edit Produk: ${editingProduct.name}` : 'Tambah Produk Baru'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowEditorModal(false)}
                className="w-8 h-8 rounded-[8px] bg-[#FAF9F7] hover:bg-[#F6F5F2] flex items-center justify-center text-[#716B64]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step Navigation Pill Controls */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#FAF9F7] border border-[#E9E5DF] rounded-[12px] text-xs font-medium">
              <button
                type="button"
                onClick={() => setEditorStep('IDENTITY')}
                className={`px-3 py-1.5 rounded-[8px] transition-colors ${editorStep === 'IDENTITY' ? 'bg-[#24221F] text-white shadow-xs' : 'text-[#716B64]'
                  }`}
              >
                1. Identitas &amp; Foto Utama
              </button>
              <button
                type="button"
                onClick={() => setEditorStep('COLORS')}
                className={`px-3 py-1.5 rounded-[8px] transition-colors ${editorStep === 'COLORS' ? 'bg-[#24221F] text-white shadow-xs' : 'text-[#716B64]'
                  }`}
              >
                2. Warna &amp; Galeri Foto ({colorsList.length})
              </button>
              <button
                type="button"
                onClick={() => setEditorStep('VARIANTS')}
                className={`px-3 py-1.5 rounded-[8px] transition-colors ${editorStep === 'VARIANTS' ? 'bg-[#24221F] text-white shadow-xs' : 'text-[#716B64]'
                  }`}
              >
                3. Ukuran &amp; Matriks Stok
              </button>
              <button
                type="button"
                onClick={() => setEditorStep('PRICING')}
                className={`px-3 py-1.5 rounded-[8px] transition-colors ${editorStep === 'PRICING' ? 'bg-[#24221F] text-white shadow-xs' : 'text-[#716B64]'
                  }`}
              >
                4. Harga Normal &amp; Diskon
              </button>
              <button
                type="button"
                onClick={() => setEditorStep('PREVIEW')}
                className={`px-3 py-1.5 rounded-[8px] transition-colors ${editorStep === 'PREVIEW' ? 'bg-[#B88770] text-white shadow-xs font-semibold' : 'text-[#716B64]'
                  }`}
              >
                5. Pratinjau Interaktif
              </button>
            </div>

            {/* TAB 1: IDENTITAS PRODUK */}
            {editorStep === 'IDENTITY' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[#716B64] mb-1 font-medium">Nama Produk Busana:</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: Defra Silk Shimmer Shawl..."
                    className="w-full h-11 px-3 border border-[#E9E5DF] rounded-[10px] text-sm text-[#24221F] outline-none focus:border-[#87533F]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[#716B64] mb-1 font-medium">Kategori Toko:</label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full h-11 px-3 border border-[#E9E5DF] rounded-[10px] bg-white text-xs text-[#24221F] outline-none"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[#716B64] mb-1 font-medium">Bobot Gram Pengiriman :</label>
                    <input
                      type="number"
                      min={50}
                      step={10}
                      required
                      value={weightGrams}
                      onChange={(e) => setWeightGrams(Number(e.target.value))}
                      className="w-full h-11 px-3 border border-[#E9E5DF] rounded-[10px] text-xs font-sans text-[#24221F] outline-none focus:border-[#87533F]"
                    />
                    <span className="text-[10px] text-[#716B64]">Bukan ukuran kain; khusus tarif ongkir </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[#716B64] mb-1 font-medium">Deskripsi Produk &amp; Bahan:</label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Jelaskan karakteristik bahan, tekstur jatuh, breathable, dan kenyamanan pemakaian..."
                    className="w-full p-3 border border-[#E9E5DF] rounded-[10px] text-xs text-[#24221F] outline-none focus:border-[#87533F]"
                  />
                </div>

                {/* Upload Foto Utama */}
                <div>
                  <label className="block text-[#716B64] mb-1 font-medium">Foto Sampul Utama (Maks. 2 MB):</label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 bg-[#FAF9F7] border border-[#E9E5DF] rounded-[12px] overflow-hidden shrink-0">
                      <img src={imageUrl} alt="Sampul" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        ref={mainFileInputRef}
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) handleMainUpload(e.target.files[0]);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => mainFileInputRef.current?.click()}
                        disabled={uploadingMain}
                        className="px-4 py-2 bg-[#FAF9F7] hover:bg-[#F6F5F2] border border-[#E9E5DF] rounded-[10px] text-xs font-semibold text-[#24221F] flex items-center gap-2 transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5 text-[#87533F]" />
                        <span>{uploadingMain ? 'Mengunggah...' : 'Pilih Berkas Foto Utama'}</span>
                      </button>
                      <p className="text-[11px] text-[#716B64] mt-1">Format JPG, PNG, atau WebP. Maks 2 MB.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: WARNA & GALERI FOTO PER WARNA */}
            {editorStep === 'COLORS' && (
              <div className="space-y-4">
                {/* Add new color input */}
                <div className="p-4 bg-[#FAF9F7] border border-[#E9E5DF] rounded-[16px] space-y-3">
                  <span className="font-semibold text-xs text-[#24221F] block">Tambah Pilihan Warna</span>
                  <div>
                    <label className="w-full min-h-24 border-2 border-dashed border-[#E9E5DF] hover:border-[#87533F] rounded-[10px] flex flex-col items-center justify-center cursor-pointer transition-colors text-center p-3 bg-white">
                      <Upload className="w-5 h-5 text-[#716B64] mb-1" />
                      <span className="text-xs text-[#24221F] font-semibold">{uploadingNewColor ? 'Mengunggah foto...' : '1. Upload foto warna'}</span>
                      <span className="text-[10px] text-[#716B64]">Boleh beberapa JPG, PNG, atau WebP; maksimal 2 MB per foto</span>
                      <input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={uploadingNewColor} className="hidden" onChange={(e) => e.target.files && handleNewColorPhotos(e.target.files)} />
                    </label>
                    {newColorImages.length > 0 && (
                      <div className="flex flex-wrap gap-3 mt-3">
                        {newColorImages.map((url, imageIndex) => (
                          <div key={`${url}-${imageIndex}`} className="w-20 space-y-1">
                            <div className="w-20 h-20 rounded-[10px] overflow-hidden border border-[#E9E5DF] bg-white">
                              <img src={url} alt={`Foto warna ${imageIndex + 1}`} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex justify-between text-[10px]">
                              <label className="text-[#87533F] cursor-pointer hover:underline">
                                Ganti
                                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files && handleNewColorPhotos(e.target.files, imageIndex)} />
                              </label>
                              <button type="button" className="text-[#B33D39] hover:underline" onClick={() => setNewColorImages((items) => items.filter((_, index) => index !== imageIndex))}>Hapus</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <input
                      type="text"
                      placeholder="2. Isi nama warna (contoh: Sage Green)..."
                      value={newColorName}
                      onChange={(e) => setNewColorName(e.target.value)}
                      className="flex-1 h-10 px-3 border border-[#E9E5DF] rounded-[10px] bg-white text-xs outline-none focus:border-[#87533F]"
                    />
                    <div className="flex items-center gap-2 bg-white border border-[#E9E5DF] rounded-[10px] px-2.5 h-10">
                      <input
                        type="color"
                        value={newColorHex}
                        onChange={(e) => setNewColorHex(e.target.value)}
                        className="w-6 h-6 border-0 cursor-pointer p-0 rounded"
                        title="3. Pilih warna"
                      />
                      <span className="font-sans text-xs text-[#716B64] uppercase">{newColorHex}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddColorItem}
                      disabled={uploadingNewColor || newColorImages.length === 0 || !newColorName.trim() || !/^#[0-9A-F]{6}$/i.test(newColorHex)}
                      className="px-4 h-10 bg-[#24221F] text-white rounded-[10px] font-semibold text-xs flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Warna</span>
                    </button>
                  </div>
                </div>

                {/* List of colors & their upload galleries */}
                <div className="space-y-3">
                  {colorsList.map((c, idx) => (
                    <div key={idx} className="p-4 bg-white border border-[#E9E5DF] rounded-[16px] space-y-3 shadow-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-4 h-4 rounded-full border border-[#E9E5DF]"
                            style={{ backgroundColor: c.colorHex }}
                          />
                          <span className="font-semibold text-sm text-[#24221F]">{c.color}</span>
                          <span className="text-[11px] text-[#716B64]">({c.images.length} foto galeri)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveColorItem(idx)}
                          className="text-[#B33D39] hover:underline text-xs flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus Warna</span>
                        </button>
                      </div>

                      {/* Photo upload gallery for this specific color */}
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        {c.images.map((imgUrl, imgIdx) => (
                          <div key={imgIdx} className="relative w-20 h-20 bg-[#FAF9F7] border border-[#E9E5DF] rounded-[10px] overflow-hidden group">
                            <img src={imgUrl} alt={c.color} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => {
                                setColorsList((prev) => {
                                  const next = [...prev];
                                  next[idx].images = next[idx].images.filter((_, i) => i !== imgIdx);
                                  return next;
                                });
                              }}
                              className="absolute top-1 right-1 bg-black/70 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}

                        {/* Upload button for this color */}
                        <label className="w-20 h-20 border-2 border-dashed border-[#E9E5DF] hover:border-[#87533F] rounded-[10px] flex flex-col items-center justify-center cursor-pointer transition-colors text-center p-2">
                          <Upload className="w-4 h-4 text-[#716B64] mb-1" />
                          <span className="text-[9px] text-[#716B64] font-medium leading-tight">Unggah Foto (Maks 2MB)</span>
                          <input
                            type="file"
                            multiple
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files) handleColorGalleryUpload(idx, e.target.files);
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: UKURAN & MATRIKS STOK KOMBINASI */}
            {editorStep === 'VARIANTS' && (
              <div className="space-y-4">
                {/* Size Chips */}
                <div className="p-4 bg-[#FAF9F7] border border-[#E9E5DF] rounded-[16px] space-y-3">
                  <span className="font-semibold text-xs text-[#24221F] block">Pilihan Ukuran Kain Busana</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {sizesList.map((sz) => (
                      <span
                        key={sz}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-[#E9E5DF] rounded-[999px] text-xs font-semibold text-[#24221F] shadow-xs"
                      >
                        <span>{sz}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSizeChip(sz)}
                          className="hover:text-[#B33D39]"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="text"
                      placeholder="Tambah ukuran baru (contoh: 115 x 115 cm, 180 x 75 cm, All Size)..."
                      value={newSizeInput}
                      onChange={(e) => setNewSizeInput(e.target.value)}
                      className="flex-1 h-9 px-3 border border-[#E9E5DF] rounded-[10px] bg-white text-xs outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddSizeChip}
                      className="px-4 h-9 bg-[#24221F] text-white rounded-[10px] font-semibold text-xs"
                    >
                      Tambah Chip Ukuran
                    </button>
                  </div>
                </div>

                {/* Combination Matrix */}
                <div className="border border-[#E9E5DF] rounded-[16px] overflow-hidden shadow-xs">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#FAF9F7] text-[#716B64] font-medium border-b border-[#E9E5DF]">
                      <tr>
                        <th className="p-3 pl-4">Kombinasi Warna &amp; Ukuran</th>
                        <th className="p-3 text-center">{editingProduct ? 'Stok Fisik' : 'Stok Awal Fisik (Pcs)'}</th>
                        <th className="p-3 text-center">{editingProduct ? 'Modal Batch' : 'Harga Modal Batch (HPP Rp)'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E9E5DF]">
                      {colorsList.map((c) =>
                        sizesList.map((sz) => {
                          const key = `${c.color}__${sz}`;
                          const current = combinationStocks[key] || { initialStock: 15, costPerUnit: 65000 };
                          const savedVariant = editingProduct?.variants.find((variant) => variant.color === c.color && variant.size === sz);

                          return (
                            <tr key={key} className="hover:bg-[#FAF9F7]/50">
                              <td className="p-3 pl-4">
                                <div className="flex items-center gap-2 font-medium text-[#24221F]">
                                  <span
                                    className="w-3 h-3 rounded-full border border-[#E9E5DF]"
                                    style={{ backgroundColor: c.colorHex }}
                                  />
                                  <span>{c.color}</span>
                                  <span className="text-[#716B64]">({sz})</span>
                                </div>
                              </td>

                              <td className="p-3 text-center">
                                {editingProduct ? <span className="font-sans font-semibold">{savedVariant?.physicalStock ?? 0} pcs</span> : <input
                                  type="number"
                                  min={0}
                                  value={current.initialStock}
                                  onChange={(e) => {
                                    setCombinationStocks({
                                      ...combinationStocks,
                                      [key]: { ...current, initialStock: Number(e.target.value) }
                                    });
                                  }}
                                  className="w-24 h-8 px-2 border border-[#E9E5DF] rounded-[6px] text-center font-sans font-bold text-xs"
                                />}
                              </td>

                              <td className="p-3 text-center">
                                {editingProduct ? <span className="font-sans font-semibold">{savedVariant?.batches?.length ? formatRp(savedVariant.batches[savedVariant.batches.length - 1].costPerUnit) : 'Belum ada batch'}</span> : <input
                                  type="number"
                                  min={1000}
                                  step={1000}
                                  value={current.costPerUnit}
                                  onChange={(e) => {
                                    setCombinationStocks({
                                      ...combinationStocks,
                                      [key]: { ...current, costPerUnit: Number(e.target.value) }
                                    });
                                  }}
                                  className="w-32 h-8 px-2 border border-[#E9E5DF] rounded-[6px] text-center font-sans font-bold text-xs"
                                />}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                  {editingProduct && <div className="p-3 border-t border-[#E9E5DF] bg-[#FAF9F7] flex items-center justify-between gap-3 text-[11px] text-[#716B64]"><span>Stok dan modal tidak diubah dari form produk agar riwayat FIFO tetap aman.</span><button type="button" onClick={() => { setShowEditorModal(false); onManageStock?.(); }} className="h-9 px-3 rounded-[8px] bg-[#282420] text-white font-medium shrink-0">Restock atau Koreksi</button></div>}
                </div>
              </div>
            )}

            {/* TAB 4: PENETAPAN HARGA */}
            {editorStep === 'PRICING' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[#716B64] mb-1 font-medium">Harga Normal (Base Price Rp):</label>
                    <input
                      type="number"
                      min={1000}
                      step={1000}
                      required
                      value={basePrice}
                      onChange={(e) => setBasePrice(Number(e.target.value))}
                      className="w-full h-11 px-3 border border-[#E9E5DF] rounded-[10px] font-sans font-bold text-sm text-[#24221F] outline-none focus:border-[#87533F]"
                    />
                  </div>

                  <div>
                    <label className="block text-[#716B64] mb-1 font-medium">Harga Diskon / Sale (Opsional Rp):</label>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={discountPrice || ''}
                      onChange={(e) => setDiscountPrice(e.target.value ? Number(e.target.value) : undefined)}
                      placeholder="Biarkan kosong jika tidak sedang sale"
                      className="w-full h-11 px-3 border border-[#E9E5DF] rounded-[10px] font-sans font-bold text-sm text-[#B88770] outline-none focus:border-[#87533F]"
                    />
                    <span className="text-[10px] text-[#716B64]">
                      Akan memunculkan badge SALE dan mencoret harga normal di storefront.
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-[#FAF9F7] border border-[#E9E5DF] rounded-[16px] text-xs space-y-1">
                  <span className="font-semibold text-[#24221F] block">Pratinjau Tampilan Harga di Toko:</span>
                  {discountPrice && discountPrice > 0 && discountPrice < basePrice ? (
                    <div className="flex items-center gap-3 font-sans pt-1">
                      <span className="text-lg font-bold text-[#B88770]">{formatRp(discountPrice)}</span>
                      <span className="line-through text-xs text-[#716B64]">{formatRp(basePrice)}</span>
                      <span className="px-2 py-0.5 bg-[#FAF9F7] border border-[#DCC39B] text-[#87533F] rounded-[999px] text-[10px] font-bold">
                        HEMAT {formatRp(basePrice - discountPrice)}
                      </span>
                    </div>
                  ) : (
                    <p className="text-base font-bold text-[#24221F] font-sans pt-1">{formatRp(basePrice)}</p>
                  )}
                </div>
              </div>
            )}

            {/* TAB 5: PREVIEW PRODUK INTERAKTIF DENGAN COLOR SWITCHER */}
            {editorStep === 'PREVIEW' && (
              <div className="p-6 bg-[#FAF9F7] border border-[#E9E5DF] rounded-[16px] flex flex-col md:flex-row gap-6 items-start">
                {/* Photo Preview based on active color */}
                <div className="w-full md:w-64 h-64 bg-white border border-[#E9E5DF] rounded-[14px] overflow-hidden shrink-0 shadow-xs">
                  <img
                    src={
                      colorsList[previewColorIdx]?.images[0] ||
                      imageUrl ||
                      categoryFallback
                    }
                    alt="Preview"
                    className="w-full h-full object-cover transition-all"
                  />
                </div>

                <div className="space-y-3 flex-1 text-xs">
                  <span className="px-2.5 py-0.5 bg-[#E8F3EF] text-[#26786C] rounded-[999px] font-semibold text-[11px]">
                    Koleksi Siap Terbit
                  </span>
                  <h3 className="text-xl font-bold text-[#24221F]">{name || 'Nama Produk Busana'}</h3>

                  <div className="font-sans pt-1">
                    {discountPrice && discountPrice > 0 && discountPrice < basePrice ? (
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-[#B88770]">{formatRp(discountPrice)}</span>
                        <span className="line-through text-xs text-[#716B64]">{formatRp(basePrice)}</span>
                      </div>
                    ) : (
                      <span className="text-lg font-bold text-[#24221F]">{formatRp(basePrice)}</span>
                    )}
                  </div>

                  <p className="text-[#716B64] text-xs leading-relaxed max-w-md">
                    {description || 'Deskripsi kain voal premium dengan tekstur lembut, breathable, dan tegak rapi.'}
                  </p>

                  {/* Color Swatch Switcher (Interactive) */}
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[11px] font-semibold text-[#24221F] block">
                      Pilihan Warna ({colorsList[previewColorIdx]?.color}):
                    </span>
                    <div className="flex items-center gap-2">
                      {colorsList.map((c, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setPreviewColorIdx(i)}
                          className={`w-7 h-7 rounded-full border-2 transition-transform ${previewColorIdx === i
                            ? 'border-[#87533F] scale-110 shadow-sm'
                            : 'border-[#E9E5DF]'
                            }`}
                          style={{ backgroundColor: c.colorHex }}
                          title={c.color}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Size chips */}
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[11px] font-semibold text-[#24221F] block">Ukuran:</span>
                    <div className="flex gap-2">
                      {sizesList.map((sz) => (
                        <span key={sz} className="px-2.5 py-1 bg-white border border-[#E9E5DF] rounded-[6px] text-[11px] font-medium text-[#24221F]">
                          {sz}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Footer Actions */}
            <div className="pt-4 border-t border-[#E9E5DF] flex items-center justify-between">
              <span className="text-[11px] text-[#716B64]">
                Semua data akan divalidasi dan disimpan di server
              </span>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowEditorModal(false)}
                  className="px-4 py-2 border border-[#E9E5DF] rounded-[10px] text-[#716B64] font-medium hover:bg-[#FAF9F7]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#24221F] hover:bg-[#40322B] text-white rounded-[10px] font-semibold shadow-xs"
                >
                  Simpan &amp; Terbitkan Produk
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ATUR HARGA CEPAT (BASE PRICE & SALE PRICE)                         */}
      {/* ========================================================================= */}
      {pricingProduct && (
        <div className="fixed inset-0 bg-[#24221F]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handlePricingSubmit}
            className="bg-white rounded-[20px] max-w-md w-full p-6 text-xs text-left shadow-2xl border border-[#E9E5DF] space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E9E5DF]">
              <h3 className="font-semibold text-sm text-[#24221F]">Atur Harga Produk</h3>
              <button
                type="button"
                onClick={() => setPricingProduct(null)}
                className="text-[#716B64]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="font-semibold text-[#24221F]">{pricingProduct.name}</p>

            <div>
              <label className="block text-[#716B64] mb-1 font-medium">Harga Normal (Base Price Rp):</label>
              <input
                type="number"
                min={1000}
                step={1000}
                required
                value={editBasePrice}
                onChange={(e) => setEditBasePrice(Number(e.target.value))}
                className="w-full h-10 px-3 border border-[#E9E5DF] rounded-[10px] font-sans font-bold text-xs outline-none focus:border-[#87533F]"
              />
            </div>

            <div>
              <label className="block text-[#716B64] mb-1 font-medium">Harga Diskon / Sale (Opsional Rp):</label>
              <input
                type="number"
                min={0}
                step={1000}
                value={editDiscountPrice}
                onChange={(e) => setEditDiscountPrice(e.target.value ? Number(e.target.value) : '')}
                placeholder="Kosongkan jika tidak ada diskon"
                className="w-full h-10 px-3 border border-[#E9E5DF] rounded-[10px] font-sans font-bold text-xs text-[#B88770] outline-none focus:border-[#87533F]"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPricingProduct(null)}
                className="px-4 py-2 border border-[#E9E5DF] rounded-[10px] text-[#716B64] font-medium"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#24221F] text-white rounded-[10px] font-semibold"
              >
                Simpan Perubahan Harga
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
