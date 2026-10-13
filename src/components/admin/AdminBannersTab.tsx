import React, { useState, useRef } from 'react';
import {
  Image as ImageIcon,
  Monitor,
  Smartphone,
  Upload,
  Check,
  AlertCircle,
  Plus,
  Info,
  Youtube,
  Play
} from 'lucide-react';
import type { HeroBanner } from '../../types/index.ts';

interface BannersTabProps {
  banners: HeroBanner[];
  token: string;
  onRefresh: () => void;
  onShowMessage: (msg: string) => void;
}

export const AdminBannersTab: React.FC<BannersTabProps> = ({
  banners,
  token,
  onRefresh,
  onShowMessage
}) => {
  // New banner form state (2 mandatory assets)
  const [desktopImageUrl, setDesktopImageUrl] = useState('');
  const [mobileImageUrl, setMobileImageUrl] = useState('');
  const [focalX, setFocalX] = useState(50);
  const [focalY, setFocalY] = useState(50);
  const [mobileFocalX, setMobileFocalX] = useState(50);
  const [mobileFocalY, setMobileFocalY] = useState(50);
  const [makeActive, setMakeActive] = useState(true);

  const [uploadingDesktop, setUploadingDesktop] = useState(false);
  const [uploadingMobile, setUploadingMobile] = useState(false);

  // Safe migration state for completing legacy portrait
  const [completingBannerId, setCompletingBannerId] = useState<string | null>(null);
  const [completePortraitUrl, setCompletePortraitUrl] = useState('');
  const [uploadingComplete, setUploadingComplete] = useState(false);

  const desktopFileInputRef = useRef<HTMLInputElement>(null);
  const mobileFileInputRef = useRef<HTMLInputElement>(null);
  const completeFileInputRef = useRef<HTMLInputElement>(null);

  // Direct file upload handler
  const handleUploadAsset = async (file: File, target: 'desktop' | 'mobile' | 'complete') => {
    if (file.size > 2000000) {
      alert('Ukuran banner melebihi 2 MB. Harap pilih gambar di bawah 2 MB.');
      return;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      alert('Format gambar banner tidak didukung. Gunakan JPG, PNG, atau WebP.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    if (target === 'desktop') setUploadingDesktop(true);
    if (target === 'mobile') setUploadingMobile(true);
    if (target === 'complete') setUploadingComplete(true);

    try {
      const res = await fetch('/api/admin/upload-banner', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.url) {
        if (target === 'desktop') setDesktopImageUrl(data.url);
        if (target === 'mobile') setMobileImageUrl(data.url);
        if (target === 'complete') setCompletePortraitUrl(data.url);
        onShowMessage('Berkas gambar banner berhasil diunggah.');
      } else {
        alert(data.error || 'Gagal mengunggah gambar banner.');
      }
    } catch {
      alert('Terjadi kesalahan jaringan saat mengunggah.');
    } finally {
      if (target === 'desktop') setUploadingDesktop(false);
      if (target === 'mobile') setUploadingMobile(false);
      if (target === 'complete') setUploadingComplete(false);
    }
  };

  // Publish new banner (Requires BOTH Landscape & Portrait)
  const handlePublishBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desktopImageUrl.trim() || !mobileImageUrl.trim()) {
      alert('Kedua foto (Landscape 2:1 dan Portrait 4:5) wajib diunggah sebelum menerbitkan banner baru.');
      return;
    }

    try {
      const res = await fetch('/api/admin/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          desktopImageUrl: desktopImageUrl.trim(),
          mobileImageUrl: mobileImageUrl.trim(),
          focalX,
          focalY,
          mobileFocalX,
          mobileFocalY,
          makeActive
        })
      });
      const data = await res.json();
      if (res.ok) {
        onShowMessage('Banner kampanye baru berhasil dipublish dengan 2 aset independen.');
        setDesktopImageUrl('');
        setMobileImageUrl('');
        onRefresh();
      } else {
        alert(data.error || 'Gagal menyimpan banner.');
      }
    } catch {
      alert('Gagal menghubungi server.');
    }
  };

  // Complete legacy portrait without modifying landscape
  const handleCompletePortrait = async (bannerId: string) => {
    if (!completePortraitUrl.trim()) {
      alert('Foto portrait wajib dipilih untuk melengkapi banner.');
      return;
    }

    try {
      const res = await fetch(`/api/admin/banners/${bannerId}/complete-portrait`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mobileImageUrl: completePortraitUrl.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        onShowMessage('Foto portrait berhasil ditambahkan tanpa mengubah landscape lama.');
        setCompletingBannerId(null);
        setCompletePortraitUrl('');
        onRefresh();
      } else {
        alert(data.error || 'Gagal melengkapi portrait banner.');
      }
    } catch {
      alert('Gagal menghubungi server.');
    }
  };

  // Activate banner
  const handleActivateBanner = async (bannerId: string) => {
    try {
      const res = await fetch(`/api/admin/banners/${bannerId}/activate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        onShowMessage('Banner utama toko berhasil diaktifkan.');
        onRefresh();
      } else {
        alert(data.error || 'Gagal mengaktifkan banner.');
      }
    } catch {
      alert('Gagal menghubungi server.');
    }
  };

  return (
    <div className="space-y-8 text-[#24221F]">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E9E5DF]">
        <div>
          <h1 className="text-[26px] font-medium tracking-tight text-[#24221F]">Banner Kampanye &amp; Media</h1>
          <p className="text-xs text-[#716B64] mt-0.5">
            Dua aset foto wajib: Landscape (2:1) untuk Desktop &amp; Tablet dan Portrait (4:5) terpisah untuk Smartphone.
          </p>
        </div>
      </div>

      {/* FORM PUBLISH BANNER BARU (SPLIT PREVIEW 2:1 & 4:5) */}
      <div className="p-6 sm:p-7 bg-white border border-[#E9E5DF] rounded-[20px] shadow-[0_6px_24px_rgba(36,34,31,.04)] space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-[#E9E5DF]">
          <div>
            <h2 className="text-[15px] font-medium text-[#24221F]">Tambah Banner Kampanye Baru</h2>
            <p className="text-xs text-[#716B64]">Unggah kedua orientasi gambar sebelum menerbitkan</p>
          </div>
          <span className="px-3 py-1 bg-[#FAF9F7] text-[#87533F] border border-[#E9E5DF] rounded-[999px] text-[11px] font-semibold">
            Landscape &amp; Portrait Wajib
          </span>
        </div>

        <form onSubmit={handlePublishBanner} className="space-y-6 text-xs">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

            {/* SISI 1: LANDSCAPE (2:1 DESKTOP & TABLET >=768px) - 7 COLS */}
            <div className="lg:col-span-7 p-5 bg-[#FAF9F7] border border-[#E9E5DF] rounded-[16px] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-xs text-[#24221F]">
                  <Monitor className="w-4 h-4 text-[#87533F]" />
                  <span>1. Foto Landscape (Desktop / Tablet &ge;768px)</span>
                </div>
                <span className="px-2 py-0.5 bg-[#24221F] text-white text-[10px] rounded-[6px] font-sans">
                  Rasio 2:1
                </span>
              </div>

              {/* Landscape 2:1 Preview Frame with Focal Point Marker */}
              <div
                className="w-full aspect-[2/1] bg-white border border-[#E9E5DF] rounded-[10px] relative overflow-hidden flex items-center justify-center cursor-crosshair group shadow-xs"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                  const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
                  setFocalX(x);
                  setFocalY(y);
                }}
              >
                {desktopImageUrl ? (
                  <>
                    <img
                      src={desktopImageUrl}
                      alt="Landscape Banner"
                      style={{ objectPosition: `${focalX}% ${focalY}%` }}
                      className="w-full h-full object-cover select-none pointer-events-none"
                    />
                    {/* Focal point indicator */}
                    <div
                      style={{ left: `${focalX}%`, top: `${focalY}%` }}
                      className="absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 border-2 border-white rounded-full bg-[#B88770]/80 shadow-md pointer-events-none"
                    />
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-[#716B64] space-y-1">
                    <ImageIcon className="w-6 h-6 text-[#716B64]/50" />
                    <span className="text-xs">Belum ada foto landscape</span>
                    <span className="text-[10px] text-[#716B64]/70">Rasio 2:1 (contoh: 2000 &times; 1000 px)</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    ref={desktopFileInputRef}
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleUploadAsset(e.target.files[0], 'desktop');
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => desktopFileInputRef.current?.click()}
                    disabled={uploadingDesktop}
                    className="px-3.5 py-2 bg-white hover:bg-[#F6F5F2] border border-[#E9E5DF] rounded-[10px] text-xs font-semibold text-[#24221F] flex items-center gap-2 transition-colors shadow-xs"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#87533F]" />
                    <span>{uploadingDesktop ? 'Mengunggah...' : 'Pilih Berkas Landscape'}</span>
                  </button>
                </div>
                <span className="text-[11px] font-sans text-[#716B64]">
                  Focal Point: X={focalX}%, Y={focalY}%
                </span>
              </div>
            </div>

            {/* SISI 2: PORTRAIT (4:5 HP MOBILE <768px) - 5 COLS */}
            <div className="lg:col-span-5 p-5 bg-[#FAF9F7] border border-[#E9E5DF] rounded-[16px] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-xs text-[#24221F]">
                  <Smartphone className="w-4 h-4 text-[#87533F]" />
                  <span>2. Foto Portrait (HP &lt;768px)</span>
                </div>
                <span className="px-2 py-0.5 bg-[#24221F] text-white text-[10px] rounded-[6px] font-sans">
                  Rasio 4:5
                </span>
              </div>

              {/* Portrait 4:5 Preview Frame with Focal Point Marker */}
              <div
                className="w-full max-w-[210px] mx-auto aspect-[4/5] bg-white border border-[#E9E5DF] rounded-[10px] relative overflow-hidden flex items-center justify-center cursor-crosshair group shadow-xs"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                  const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
                  setMobileFocalX(x);
                  setMobileFocalY(y);
                }}
              >
                {mobileImageUrl ? (
                  <>
                    <img
                      src={mobileImageUrl}
                      alt="Portrait Banner"
                      style={{ objectPosition: `${mobileFocalX}% ${mobileFocalY}%` }}
                      className="w-full h-full object-cover select-none pointer-events-none"
                    />
                    <div
                      style={{ left: `${mobileFocalX}%`, top: `${mobileFocalY}%` }}
                      className="absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 border-2 border-white rounded-full bg-[#B88770]/80 shadow-md pointer-events-none"
                    />
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-[#716B64] space-y-1 p-4 text-center">
                    <Smartphone className="w-6 h-6 text-[#716B64]/50" />
                    <span className="text-xs">Belum ada foto portrait</span>
                    <span className="text-[10px] text-[#716B64]/70">Rasio 4:5 (contoh: 1080 &times; 1350 px)</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    ref={mobileFileInputRef}
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleUploadAsset(e.target.files[0], 'mobile');
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => mobileFileInputRef.current?.click()}
                    disabled={uploadingMobile}
                    className="px-3.5 py-2 bg-white hover:bg-[#F6F5F2] border border-[#E9E5DF] rounded-[10px] text-xs font-semibold text-[#24221F] flex items-center gap-2 transition-colors shadow-xs"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#87533F]" />
                    <span>{uploadingMobile ? 'Mengunggah...' : 'Pilih Berkas Portrait'}</span>
                  </button>
                </div>
                <span className="text-[11px] font-sans text-[#716B64]">
                  Focal Point: X={mobileFocalX}%, Y={mobileFocalY}%
                </span>
              </div>
            </div>

          </div>

          <div className="pt-2 border-t border-[#E9E5DF] flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer font-medium text-xs text-[#24221F]">
              <input
                type="checkbox"
                checked={makeActive}
                onChange={(e) => setMakeActive(e.target.checked)}
                className="rounded"
              />
              <span>Jadikan langsung sebagai banner utama yang tampil di beranda toko</span>
            </label>

            <button
              type="submit"
              className="px-6 py-2.5 bg-[#24221F] hover:bg-[#40322B] text-white rounded-[10px] font-semibold text-xs transition-colors shadow-xs"
            >
              Terbitkan Banner Baru
            </button>
          </div>
        </form>
      </div>

      {/* DAFTAR BANNER YANG ADA */}
      <div className="bg-white border border-[#E9E5DF] rounded-[20px] p-6 shadow-[0_6px_24px_rgba(36,34,31,.04)] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E9E5DF]">
          <div>
            <h2 className="text-[15px] font-medium text-[#24221F]">Daftar Banner Toko</h2>
            <p className="text-xs text-[#716B64]">Riwayat kampanye dan status aktif storefront</p>
          </div>
          <span className="text-xs font-semibold text-[#87533F]">{banners.length} banner</span>
        </div>

        <div className="space-y-4">
          {banners.map((b) => (
            <div
              key={b.id}
              className={`p-5 rounded-[16px] border transition-all ${b.isActive
                  ? 'bg-white border-[#26786C] shadow-[0_4px_16px_rgba(38,120,108,.08)]'
                  : 'bg-[#FAF9F7] border-[#E9E5DF]'
                }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {/* Landscape Thumbnail 2:1 */}
                  <div className="w-28 aspect-[2/1] bg-white border border-[#E9E5DF] rounded-[8px] overflow-hidden shrink-0">
                    <img src={b.desktopImageUrl} alt="Landscape" className="w-full h-full object-cover" />
                  </div>

                  {/* Portrait Thumbnail 4:5 */}
                  <div className="w-12 aspect-[4/5] bg-white border border-[#E9E5DF] rounded-[8px] overflow-hidden shrink-0">
                    {b.mobileImageUrl ? (
                      <img src={b.mobileImageUrl} alt="Portrait" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[9px] text-[#B33D39] text-center p-1 bg-[#FAECEA]">
                        Perlu Portrait
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-[#24221F] font-sans">ID: {b.id}</span>
                      <span
                        className={`px-2 py-0.5 rounded-[999px] text-[10px] font-semibold ${b.isActive ? 'bg-[#E8F3EF] text-[#26786C]' : 'bg-[#F6F5F2] text-[#716B64]'
                          }`}
                      >
                        {b.isActive ? 'Sedang Tampil di Toko' : 'Arsip Kampanye'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#716B64] mt-0.5">
                      Focal Point: Landscape ({b.focalX}%, {b.focalY}%)
                      {b.mobileImageUrl && ` · Portrait (${b.mobileFocalX || 50}%, ${b.mobileFocalY || 50}%)`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!b.mobileImageUrl && (
                    <button
                      type="button"
                      onClick={() => setCompletingBannerId(b.id)}
                      className="px-3 py-1.5 bg-[#FAF9F7] border border-[#DCC39B] text-[#87533F] hover:bg-[#F6F5F2] rounded-[8px] text-[11px] font-semibold"
                    >
                      + Lengkapi Portrait HP
                    </button>
                  )}

                  {!b.isActive && (
                    <button
                      type="button"
                      onClick={() => handleActivateBanner(b.id)}
                      className="px-3 py-1.5 bg-[#24221F] hover:bg-[#40322B] text-white rounded-[8px] text-[11px] font-semibold transition-colors"
                    >
                      Aktifkan Banner Ini
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
