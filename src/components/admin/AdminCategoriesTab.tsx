import React, { useState, useRef } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Layers,
  Upload,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon
} from 'lucide-react';
import type { Category } from '../../types/index.ts';

interface CategoriesTabProps {
  categories: Category[];
  token: string;
  onRefresh: () => void;
  onShowMessage: (msg: string) => void;
}

export const AdminCategoriesTab: React.FC<CategoriesTabProps> = ({
  categories,
  token,
  onRefresh,
  onShowMessage
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [imageUrl, setImageUrl] = useState('/src/assets/images/cat_voal_luxury_1791700549401.jpg');
  const [sortOrder, setSortOrder] = useState(categories.length + 1);
  const [isActive, setIsActive] = useState(true);
  const [uploading, setUploading] = useState(false);

  const addFileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // File upload handler (max 2MB)
  const handleFileUpload = async (file: File, isEdit: boolean) => {
    if (file.size > 2000000) {
      alert('Ukuran file melebihi 2 MB. Harap pilih gambar di bawah 2 MB.');
      return;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      alert('Format gambar tidak didukung. Harap gunakan JPG, PNG, atau WebP.');
      return;
    }

    setUploading(true);
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
        if (isEdit && editingCategory) {
          setEditingCategory({ ...editingCategory, imageUrl: data.url });
        } else {
          setImageUrl(data.url);
        }
        onShowMessage('Foto kategori berhasil diunggah.');
      } else {
        alert(data.error || 'Gagal mengunggah foto.');
      }
    } catch {
      alert('Kesalahan jaringan saat mengunggah foto.');
    } finally {
      setUploading(false);
    }
  };

  // Add Category Submit
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !imageUrl.trim()) {
      alert('Nama dan foto landscape (2:1) wajib diisi.');
      return;
    }

    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim() || undefined,
          imageUrl: imageUrl.trim(),
          sortOrder: Number(sortOrder),
          isActive
        })
      });
      const data = await res.json();
      if (res.ok) {
        onShowMessage(`Kategori "${name}" berhasil ditambahkan.`);
        setShowAddModal(false);
        setName('');
        setSlug('');
        await onRefresh();
      } else {
        alert(data.error || 'Gagal menambahkan kategori.');
      }
    } catch {
      alert('Gagal menghubungi server.');
    }
  };

  // Edit Category Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editingCategory.name.trim()) return;

    try {
      const res = await fetch(`/api/admin/categories/${editingCategory.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: editingCategory.name.trim(),
          slug: editingCategory.slug,
          imageUrl: editingCategory.imageUrl,
          sortOrder: Number(editingCategory.sortOrder),
          isActive: editingCategory.isActive
        })
      });
      if (res.ok) {
        onShowMessage(`Perubahan kategori "${editingCategory.name}" berhasil disimpan.`);
        setEditingCategory(null);
        await onRefresh();
      } else {
        alert('Gagal memperbarui kategori.');
      }
    } catch {
      alert('Gagal menghubungi server.');
    }
  };

  // Delete Category
  const handleDeleteCategory = async (id: string, catName: string) => {
    if (!window.confirm(`Hapus kategori "${catName}"? Pastikan tidak ada produk yang terkait.`)) return;

    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        onShowMessage(`Kategori "${catName}" berhasil dihapus.`);
        await onRefresh();
      } else {
        if (res.status === 409 && data.code === 'CATEGORY_IN_USE') {
          const choices = categories.filter((category) => category.id !== id);
          if (!choices.length) {
            alert(`${data.error}\n\nBuat kategori tujuan terlebih dahulu.`);
            return;
          }
          if (!window.confirm(`${data.error}\n\nPilih kategori tujuan dan pindahkan seluruh produk?`)) return;
          const categoryNames = choices.map((category) => category.name).join(', ');
          const targetName = window.prompt(`Ketik persis nama kategori tujuan:\n${categoryNames}`)?.trim();
          if (!targetName) return;
          const target = choices.find((category) => category.name.toLocaleLowerCase('id-ID') === targetName.toLocaleLowerCase('id-ID'));
          if (!target) {
            alert('Kategori tujuan tidak ditemukan. Tidak ada data yang diubah.');
            return;
          }
          if (!window.confirm(`Pindahkan ${data.productCount} produk dari "${catName}" ke "${target.name}", lalu hapus kategori asal?`)) return;
          const moveRes = await fetch(`/api/admin/categories/${id}/move-and-delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ targetCategoryId: target.id })
          });
          const moveData = await moveRes.json();
          if (!moveRes.ok) {
            alert(moveData.error || 'Gagal memindahkan produk dan menghapus kategori.');
            return;
          }
          onShowMessage(`${moveData.movedProducts} produk dipindahkan ke "${target.name}" dan kategori "${catName}" berhasil dihapus.`);
          await onRefresh();
          return;
        }
        alert(data.error || 'Gagal menghapus kategori.');
      }
    } catch {
      alert('Gagal menghapus kategori.');
    }
  };

  // Reorder up / down
  const handleMoveOrder = async (cat: Category, direction: 'UP' | 'DOWN') => {
    const newOrder = direction === 'UP' ? Math.max(1, cat.sortOrder - 1) : cat.sortOrder + 1;
    try {
      await fetch(`/api/admin/categories/${cat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sortOrder: newOrder })
      });
      await onRefresh();
    } catch { }
  };

  return (
    <div className="space-y-6 text-[#24221F]">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E9E5DF]">
        <div>
          <h1 className="text-[26px] font-medium tracking-tight text-[#24221F]">Kategori Toko</h1>
          <p className="text-xs text-[#716B64] mt-0.5">
            Atur kategori produk, foto kategori, dan urutan tampilannya di toko.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setName('');
            setSlug('');
            setSortOrder(categories.length + 1);
            setShowAddModal(true);
          }}
          className="h-10 px-4 bg-[#24221F] hover:bg-[#40322B] text-white rounded-[10px] text-xs font-semibold flex items-center gap-2 transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4 text-[#B88770]" />
          <span>Tambah Kategori Baru</span>
        </button>
      </div>

      {/* CATEGORIES GRID / TABLE (LANDSCAPE 2:1 CARDS) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {categories.map((cat, idx) => (
          <div
            key={cat.id}
            className="bg-white border border-[#E9E5DF] rounded-[20px] overflow-hidden shadow-[0_6px_24px_rgba(36,34,31,.04)] flex flex-col justify-between"
          >
            {/* Landscape 2:1 Photo Banner */}
            <div className="relative w-full aspect-[2/1] bg-[#FAF9F7] overflow-hidden">
              <img
                src={cat.imageUrl || '/src/assets/images/cat_voal_luxury_1791700549401.jpg'}
                alt={cat.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/src/assets/images/cat_voal_luxury_1791700549401.jpg';
                }}
              />
              <div className="absolute top-3 left-3 bg-[#24221F]/80 backdrop-blur-xs text-white text-[11px] font-sans px-2.5 py-0.5 rounded-[999px]">
                Urutan #{cat.sortOrder}
              </div>
              <div className="absolute top-3 right-3">
                <span
                  className={`px-2.5 py-0.5 rounded-[999px] text-[11px] font-semibold ${cat.isActive ? 'bg-[#E8F3EF] text-[#26786C]' : 'bg-[#F6F5F2] text-[#716B64]'
                    }`}
                >
                  {cat.isActive ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
            </div>

            {/* Info & Action Controls */}
            <div className="p-5 space-y-3">
              <div>
                <h3 className="text-base font-bold text-[#24221F]">{cat.name}</h3>
                <p className="text-[11px] text-[#716B64] font-sans mt-0.5">Slug: /{cat.slug}</p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-[#E9E5DF] flex items-center justify-between">
                {/* Reorder Buttons */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleMoveOrder(cat, 'UP')}
                    disabled={idx === 0}
                    className="p-1.5 bg-[#FAF9F7] hover:bg-[#F6F5F2] rounded-[6px] border border-[#E9E5DF] text-[#716B64] disabled:opacity-40"
                    title="Geser Urutan Naik"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveOrder(cat, 'DOWN')}
                    disabled={idx === categories.length - 1}
                    className="p-1.5 bg-[#FAF9F7] hover:bg-[#F6F5F2] rounded-[6px] border border-[#E9E5DF] text-[#716B64] disabled:opacity-40"
                    title="Geser Urutan Turun"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingCategory(cat)}
                    className="px-3 py-1.5 bg-[#FAF9F7] hover:bg-[#F6F5F2] border border-[#E9E5DF] rounded-[8px] text-[11px] font-medium text-[#24221F] flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3 text-[#87533F]" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(cat.id, cat.name)}
                    className="p-1.5 text-[#B33D39] hover:bg-[#FAECEA] rounded-[8px] transition-colors"
                    title="Hapus Kategori"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL: TAMBAH KATEGORI */}
      {showAddModal && (
        <div className="fixed inset-0 bg-[#24221F]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleAddSubmit}
            className="bg-white rounded-[20px] max-w-md w-full p-6 text-xs text-left shadow-2xl border border-[#E9E5DF] space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E9E5DF]">
              <h3 className="font-semibold text-sm text-[#24221F]">Tambah Kategori Baru</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-[#716B64]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[#716B64] mb-1 font-medium">Nama Kategori:</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slug) setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                }}
                placeholder="Contoh: Voal Premium, Pashmina Silk..."
                className="w-full h-10 px-3 border border-[#E9E5DF] rounded-[10px] text-xs outline-none focus:border-[#87533F]"
              />
            </div>

            <div>
              <label className="block text-[#716B64] mb-1 font-medium">Slug URL:</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="voal-premium"
                className="w-full h-10 px-3 border border-[#E9E5DF] rounded-[10px] text-xs font-sans outline-none focus:border-[#87533F]"
              />
            </div>

            {/* Upload Foto Landscape 2:1 */}
            <div>
              <label className="block text-[#716B64] mb-1 font-medium">Foto Landscape 2:1 (Maks. 2 MB):</label>
              <div className="flex items-center gap-3">
                <div className="w-24 h-12 bg-[#FAF9F7] border border-[#E9E5DF] rounded-[8px] overflow-hidden shrink-0">
                  <img src={imageUrl} alt="Landscape" className="w-full h-full object-cover" />
                </div>
                <div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    ref={addFileInputRef}
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleFileUpload(e.target.files[0], false);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => addFileInputRef.current?.click()}
                    disabled={uploading}
                    className="px-3 py-1.5 bg-[#FAF9F7] border border-[#E9E5DF] rounded-[8px] text-[11px] font-semibold text-[#24221F] flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#87533F]" />
                    <span>{uploading ? 'Mengunggah...' : 'Pilih Berkas Foto'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="catActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="catActive" className="text-[#24221F] font-medium cursor-pointer">
                Tampilkan kategori ini di beranda toko
              </label>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-[#E9E5DF] rounded-[10px] text-[#716B64]"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#24221F] text-white rounded-[10px] font-semibold"
              >
                Simpan Kategori
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: EDIT KATEGORI */}
      {editingCategory && (
        <div className="fixed inset-0 bg-[#24221F]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleEditSubmit}
            className="bg-white rounded-[20px] max-w-md w-full p-6 text-xs text-left shadow-2xl border border-[#E9E5DF] space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E9E5DF]">
              <h3 className="font-semibold text-sm text-[#24221F]">Edit Kategori</h3>
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="text-[#716B64]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[#716B64] mb-1 font-medium">Nama Kategori:</label>
              <input
                type="text"
                required
                value={editingCategory.name}
                onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                className="w-full h-10 px-3 border border-[#E9E5DF] rounded-[10px] text-xs outline-none focus:border-[#87533F]"
              />
            </div>

            <div>
              <label className="block text-[#716B64] mb-1 font-medium">Slug URL:</label>
              <input
                type="text"
                value={editingCategory.slug}
                onChange={(e) => setEditingCategory({ ...editingCategory, slug: e.target.value })}
                className="w-full h-10 px-3 border border-[#E9E5DF] rounded-[10px] text-xs font-sans outline-none focus:border-[#87533F]"
              />
            </div>

            <div>
              <label className="block text-[#716B64] mb-1 font-medium">Foto Landscape 2:1:</label>
              <div className="flex items-center gap-3">
                <div className="w-24 h-12 bg-[#FAF9F7] border border-[#E9E5DF] rounded-[8px] overflow-hidden shrink-0">
                  <img src={editingCategory.imageUrl} alt="Landscape" className="w-full h-full object-cover" />
                </div>
                <div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    ref={editFileInputRef}
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleFileUpload(e.target.files[0], true);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => editFileInputRef.current?.click()}
                    disabled={uploading}
                    className="px-3 py-1.5 bg-[#FAF9F7] border border-[#E9E5DF] rounded-[8px] text-[11px] font-semibold text-[#24221F] flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#87533F]" />
                    <span>Ganti Foto</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="catEditActive"
                checked={editingCategory.isActive}
                onChange={(e) => setEditingCategory({ ...editingCategory, isActive: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="catEditActive" className="text-[#24221F] font-medium cursor-pointer">
                Aktif di storefront toko
              </label>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="px-4 py-2 border border-[#E9E5DF] rounded-[10px] text-[#716B64]"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#24221F] text-white rounded-[10px] font-semibold"
              >
                Simpan Perubahan
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
