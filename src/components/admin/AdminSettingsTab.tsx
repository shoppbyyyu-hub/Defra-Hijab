import React, { useState, useEffect, useRef } from 'react';
import {
  Store,
  Truck,
  CreditCard,
  Bell,
  Package,
  Send,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Save,
  QrCode,
  Copy,
  Check,
  RefreshCw,
  Info,
  Search,
  MapPin
} from 'lucide-react';
import type { DefraSettings } from '../../types/index.ts';
import type { QRISDecodeResult } from '../../utils/qris.ts';

export interface OriginDestinationItem {
  id: number;
  label: string;
  subdistrict: string;
  district: string;
  city: string;
  province: string;
  postalCode: string;
}

interface SettingsTabProps {
  settings: DefraSettings;
  token: string;
  onRefresh: () => void;
  onShowMessage: (msg: string) => void;
}

type SettingsSection = 'STORE' | 'SHIPPING' | 'PAYMENT' | 'NOTIFICATIONS' | 'STOCK';

export const AdminSettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  token,
  onRefresh,
  onShowMessage
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('STORE');
  const [formData, setFormData] = useState<DefraSettings>({ ...settings });
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<string | null>(null);
  const [telegramConfigured, setTelegramConfigured] = useState<boolean | null>(null);
  const [telegramState, setTelegramState] = useState<'ACTIVE' | 'WAITING' | 'PROBLEM' | null>(null);
  const [testingRajaOngkir, setTestingRajaOngkir] = useState(false);
  const [rajaOngkirResult, setRajaOngkirResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    services?: { service: string; description: string; cost: number; etd: string }[];
    destinationTested?: string;
    weightTestedGrams?: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  // Dynamic QRIS Workbench State (Uji Scan Admin Saja)
  const [testAmount, setTestAmount] = useState<number>(150000);
  const [testPoi, setTestPoi] = useState<'12' | '11'>('12');
  const [previewQrUrl, setPreviewQrUrl] = useState<string>('');
  const [previewPayload, setPreviewPayload] = useState<string>('');
  const [previewDecoded, setPreviewDecoded] = useState<QRISDecodeResult | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);

  // RajaOngkir Origin Region Search State (700ms Debounce, >= 3 chars, Dropdown)
  const [originSearchQuery, setOriginSearchQuery] = useState('');
  const [originResults, setOriginResults] = useState<OriginDestinationItem[]>([]);
  const [isSearchingOrigin, setIsSearchingOrigin] = useState(false);
  const [showOriginDropdown, setShowOriginDropdown] = useState(false);
  const [isChangingOrigin, setIsChangingOrigin] = useState(false);
  const originSearchSeqRef = useRef(0);
  const originSearchAbortRef = useRef<AbortController | null>(null);

  // Debounced search for RajaOngkir origin destinations (>= 3 chars, 700ms debounce, no initial call on mount/render)
  useEffect(() => {
    const trimmed = (originSearchQuery || '').trim();
    if (trimmed.length < 3) {
      setOriginResults([]);
      setIsSearchingOrigin(false);
      if (originSearchAbortRef.current) {
        originSearchAbortRef.current.abort();
      }
      return;
    }

    setIsSearchingOrigin(true);
    const timer = setTimeout(async () => {
      if (originSearchAbortRef.current) {
        originSearchAbortRef.current.abort();
      }
      const controller = new AbortController();
      originSearchAbortRef.current = controller;
      const currentSeq = ++originSearchSeqRef.current;

      try {
        const res = await fetch(`/api/shipping/destinations?search=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal
        });
        const data = await res.json();
        if (currentSeq === originSearchSeqRef.current) {
          if (res.ok && Array.isArray(data.destinations)) {
            setOriginResults(data.destinations);
            setShowOriginDropdown(data.destinations.length > 0);
          } else {
            setOriginResults([]);
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError' && currentSeq === originSearchSeqRef.current) {
          setOriginResults([]);
        }
      } finally {
        if (currentSeq === originSearchSeqRef.current) {
          setIsSearchingOrigin(false);
        }
      }
    }, 700);

    return () => {
      clearTimeout(timer);
    };
  }, [originSearchQuery]);

  const handleSelectOrigin = (item: OriginDestinationItem) => {
    setFormData((prev) => ({
      ...prev,
      originCityId: String(item.id),
      originLabel: item.label,
      originCity: item.city,
      originSubdistrict: item.subdistrict || item.district,
      originProvince: item.province,
      originPostalCode: item.postalCode
    }));
    setOriginSearchQuery('');
    setShowOriginDropdown(false);
    setOriginResults([]);
    setIsChangingOrigin(false);
    setRajaOngkirResult(null);
  };

  useEffect(() => {
    let isMounted = true;
    const runGeneration = async () => {
      try {
        if (!testAmount || testAmount <= 0) return;
        const response = await fetch('/api/admin/qris/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ amount: testAmount, pointOfInitiation: testPoi })
        });
        const res = await response.json();
        if (!response.ok) throw new Error(res.error || 'QRIS belum dikonfigurasi.');
        if (isMounted) {
          setPreviewPayload(res.payload);
          setPreviewDecoded(res.decoded);
          setPreviewQrUrl(res.dataUrl);
        }
      } catch (err) {
        console.error('Gagal generate QRIS dinamis:', err);
      }
    };
    runGeneration();
    return () => {
      isMounted = false;
    };
  }, [testAmount, testPoi, token]);

  // Save Settings
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if both payment methods are being turned off
    if (!formData.qrisEnabled && !formData.bankTransferEnabled) {
      const confirmOff = window.confirm(
        'PERINGATAN: Mematikan QRIS dan Transfer Bank sekaligus akan menyebabkan checkout baru pembeli berhenti. Lanjutkan menyimpan?'
      );
      if (!confirmOff) return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        onShowMessage('Pengaturan toko berhasil disimpan.');
        onRefresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Gagal menyimpan pengaturan.');
      }
    } catch {
      alert('Terjadi kendala jaringan.');
    } finally {
      setSaving(false);
    }
  };

  // Test RajaOngkir Connection (Checks real JNE rates with valid origin/destination & weight)
  const handleTestRajaOngkir = async () => {
    if (!formData.originCityId || !formData.originCityId.trim()) {
      setRajaOngkirResult({
        success: false,
        error: 'Alamat asal pengiriman belum dipilih. Silakan cari dan pilih wilayah asal pengiriman terlebih dahulu.'
      });
      return;
    }

    setTestingRajaOngkir(true);
    setRajaOngkirResult(null);
    try {
      // First save current origin settings to ensure latest originCityId is synced
      const saveResponse = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      if (!saveResponse.ok) {
        const saveData = await saveResponse.json().catch(() => ({}));
        setRajaOngkirResult({
          success: false,
          error: saveData.error || 'Wilayah asal belum berhasil disimpan.'
        });
        return;
      }

      const res = await fetch('/api/admin/rajaongkir/test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRajaOngkirResult({
          success: true,
          message: data.message || 'Koneksi RajaOngkir berhasil!',
          services: data.services,
          destinationTested: data.destinationTested,
          weightTestedGrams: data.weightTestedGrams
        });
      } else {
        setRajaOngkirResult({
          success: false,
          error: data.error || 'Gagal terhubung ke API RajaOngkir.'
        });
      }
    } catch {
      setRajaOngkirResult({
        success: false,
        error: 'Kendala jaringan saat menghubungi endpoint uji koneksi RajaOngkir.'
      });
    } finally {
      setTestingRajaOngkir(false);
    }
  };

  // Test Telegram Notification
  const handleTestTelegram = async () => {
    setTestingTelegram(true);
    setTelegramStatus(null);
    try {
      const res = await fetch('/api/admin/telegram/test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTelegramStatus(data.delivered ? 'SUKSES: Telegram menerima pesan tes.' : 'GAGAL: Telegram belum mengonfirmasi pesan tes.');
      } else {
        setTelegramStatus(`GAGAL: ${data.error || 'Pesan tes gagal dikirim.'}`);
      }
    } catch {
      setTelegramStatus('GAGAL: Kendala jaringan saat memanggil endpoint notifikasi Telegram.');
    } finally {
      setTestingTelegram(false);
    }
  };

  const checkTelegramStatus = async () => {
    try {
      const res = await fetch('/api/admin/telegram/status', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Status Telegram tidak dapat diperiksa.');
      setTelegramConfigured(Boolean(data.configured));
      setTelegramState(data.state);
      if (data.lastError) setTelegramStatus(`GAGAL: ${data.lastError}`);
      else if (data.pending) setTelegramStatus(`${data.pending} notifikasi masih menunggu diproses.`);
      else setTelegramStatus(data.workerRunning ? 'SUKSES: Worker Telegram aktif dan antrean kosong.' : 'GAGAL: Worker Telegram belum aktif.');
    } catch (error) {
      setTelegramStatus(`GAGAL: ${(error as Error).message}`);
    }
  };

  useEffect(() => {
    if (activeSection === 'NOTIFICATIONS') void checkTelegramStatus();
  }, [activeSection]);

  return (
    <div className="space-y-6 text-[#24221F] max-w-4xl text-left">
      {/* HEADER */}
      <div className="pb-2 border-b border-[#E9E5DF]">
        <h1 className="text-[26px] font-medium tracking-tight text-[#24221F]">Pengaturan Toko</h1>
        <p className="text-xs text-[#716B64] mt-0.5">
          Atur WhatsApp, alamat pengiriman toko, metode pembayaran, notifikasi Telegram, dan batas peringatan stok.
        </p>
      </div>

      {/* SECTION TABS (Sesuai Poin 16: Toko, Pengiriman, Pembayaran, Notifikasi, Stok) */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white border border-[#E9E5DF] rounded-[14px] shadow-xs text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveSection('STORE')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-[10px] transition-colors ${activeSection === 'STORE'
            ? 'bg-[#24221F] text-white shadow-xs font-semibold'
            : 'text-[#716B64] hover:text-[#24221F] hover:bg-[#FAF9F7]'
            }`}
        >
          <Store className="w-3.5 h-3.5" />
          <span>Toko</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('SHIPPING')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-[10px] transition-colors ${activeSection === 'SHIPPING'
            ? 'bg-[#24221F] text-white shadow-xs font-semibold'
            : 'text-[#716B64] hover:text-[#24221F] hover:bg-[#FAF9F7]'
            }`}
        >
          <Truck className="w-3.5 h-3.5" />
          <span>Pengiriman</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('PAYMENT')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-[10px] transition-colors ${activeSection === 'PAYMENT'
            ? 'bg-[#24221F] text-white shadow-xs font-semibold'
            : 'text-[#716B64] hover:text-[#24221F] hover:bg-[#FAF9F7]'
            }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Pembayaran</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('NOTIFICATIONS')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-[10px] transition-colors ${activeSection === 'NOTIFICATIONS'
            ? 'bg-[#24221F] text-white shadow-xs font-semibold'
            : 'text-[#716B64] hover:text-[#24221F] hover:bg-[#FAF9F7]'
            }`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>Notifikasi Telegram</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('STOCK')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-[10px] transition-colors ${activeSection === 'STOCK'
            ? 'bg-[#24221F] text-white shadow-xs font-semibold'
            : 'text-[#716B64] hover:text-[#24221F] hover:bg-[#FAF9F7]'
            }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Stok</span>
        </button>
      </div>

      {/* FORM CONTAINER */}
      <form onSubmit={handleSave} className="bg-white border border-[#E9E5DF] rounded-[20px] p-6 sm:p-8 shadow-[0_6px_24px_rgba(36,34,31,.04)] space-y-6 text-xs">

        {/* TAB 1: TOKO */}
        {activeSection === 'STORE' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-[15px] font-medium text-[#24221F]">Kontak &amp; Identitas Toko</h2>
              <p className="text-xs text-[#716B64]">Nomor WhatsApp resmi untuk layanan pelanggan</p>
            </div>

            <div>
              <label className="block text-[#716B64] mb-1 font-medium">
                Nomor WhatsApp Bisnis (Awali 628...):
              </label>
              <input
                type="text"
                required
                value={formData.whatsappNumber}
                onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                className="w-full h-11 px-3 border border-[#E9E5DF] rounded-[10px] text-xs font-sans font-bold text-[#24221F] outline-none focus:border-[#87533F]"
              />
              <p className="text-[11px] text-[#716B64] mt-1">

              </p>
            </div>
          </div>
        )}

        {/* TAB 2: PENGIRIMAN */}
        {activeSection === 'SHIPPING' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-[15px] font-medium text-[#24221F]">Alamat Asal Ekspedisi JNE</h2>
              <p className="text-xs text-[#716B64]">
                Titik awal pengiriman paket dari gudang Defra Hijab untuk kalkulasi tarif resmi Ekspedisi
              </p>
            </div>

            {/* Wilayah Asal Terpilih ATAU Form Pencarian Wilayah */}
            {formData.originCityId && !isChangingOrigin ? (
              <div className="p-4 bg-[#FAF9F7] border border-[#E9E5DF] rounded-[16px] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E9E5DF]">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-[#E8F3EF] text-[#26786C] rounded-[8px]">
                      <MapPin className="w-4 h-4" />
                    </span>
                    <div>
                      <h3 className="font-semibold text-xs text-[#24221F]">Wilayah Asal Terkonfigurasi</h3>
                      <p className="text-[11px] text-[#716B64]">ID ini terdaftar resmi pada endpoint kalkulasi Ekspedisi</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-[#24221F] text-white rounded-[6px] font-sans font-bold text-[11px]">
                      ID RajaOngkir: {formData.originCityId}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsChangingOrigin(true);
                        setOriginSearchQuery('');
                      }}
                      className="px-3 py-1 bg-white hover:bg-[#F3EBDF]/40 border border-[#E9E5DF] text-[#87533F] rounded-[6px] text-xs font-semibold transition-colors"
                    >
                      Ubah Wilayah Asal
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                  <div className="bg-white p-2.5 rounded-[10px] border border-[#E9E5DF]">
                    <span className="text-[10px] text-[#716B64] block font-medium">Kota / Kabupaten</span>
                    <span className="font-semibold text-[#24221F] mt-0.5 block">{formData.originCity || '-'}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-[10px] border border-[#E9E5DF]">
                    <span className="text-[10px] text-[#716B64] block font-medium">Kecamatan / Kelurahan</span>
                    <span className="font-semibold text-[#24221F] mt-0.5 block">{formData.originSubdistrict || '-'}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-[10px] border border-[#E9E5DF]">
                    <span className="text-[10px] text-[#716B64] block font-medium">Provinsi</span>
                    <span className="font-semibold text-[#24221F] mt-0.5 block">{formData.originProvince || '-'}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-[10px] border border-[#E9E5DF]">
                    <span className="text-[10px] text-[#716B64] block font-medium">Kode Pos</span>
                    <span className="font-semibold text-[#24221F] mt-0.5 block">{formData.originPostalCode || '-'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-[#FAF9F7] border border-[#E9E5DF] rounded-[16px] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-xs text-[#24221F]">
                      {isChangingOrigin ? 'Ganti Wilayah Asal Pengiriman' : 'Pilih Wilayah Asal Pengiriman'}
                    </h3>
                    <p className="text-[11px] text-[#716B64]">
                      Ketik minimal 3 karakter untuk mencari kecamatan / kota resmi pada database RajaOngkir
                    </p>
                  </div>
                  {isChangingOrigin && formData.originCityId && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsChangingOrigin(false);
                        setOriginSearchQuery('');
                        setShowOriginDropdown(false);
                      }}
                      className="text-xs text-[#716B64] hover:text-[#24221F] underline font-medium"
                    >
                      Batal Ubah
                    </button>
                  )}
                </div>

                <div className="relative">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Ketik nama kecamatan atau kota (misal: Kebayoran Baru, Gambir, Bandung)..."
                      value={originSearchQuery}
                      onChange={(e) => {
                        setOriginSearchQuery(e.target.value);
                        if (!showOriginDropdown && e.target.value.trim().length >= 3) {
                          setShowOriginDropdown(true);
                        }
                      }}
                      onFocus={() => {
                        if (originResults.length > 0) setShowOriginDropdown(true);
                      }}
                      className="w-full h-11 pl-9 pr-10 bg-white border border-[#E9E5DF] rounded-[10px] text-xs font-medium text-[#24221F] outline-none focus:border-[#87533F]"
                    />
                    <Search className="w-4 h-4 text-[#716B64] absolute left-3 top-3.5" />
                    {isSearchingOrigin && (
                      <RefreshCw className="w-4 h-4 text-[#87533F] absolute right-3 top-3.5 animate-spin" />
                    )}
                  </div>

                  {/* Dropdown Hasil Pencarian Wilayah */}
                  {showOriginDropdown && originResults.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-[#E9E5DF] rounded-[12px] shadow-lg max-h-60 overflow-y-auto motion-dropdown">
                      {originResults.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleSelectOrigin(item)}
                          className="px-3.5 py-2.5 hover:bg-[#F3EBDF]/30 cursor-pointer border-b border-[#F0EBE6] last:border-b-0 text-left transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-[#24221F]">{item.label}</p>
                            <span className="px-2 py-0.5 bg-[#FAF9F7] border border-[#E9E5DF] text-[10px] font-sans font-bold text-[#716B64] rounded">
                              ID: {item.id}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#716B64] mt-0.5">
                            {item.subdistrict ? `${item.subdistrict}, ` : ''}{item.city}, {item.province} {item.postalCode ? `(${item.postalCode})` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {showOriginDropdown && !isSearchingOrigin && originSearchQuery.trim().length >= 3 && originResults.length === 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-[#E9E5DF] rounded-[12px] shadow-lg p-3 text-center text-xs text-[#716B64]">
                      Wilayah "{originSearchQuery.trim()}" tidak ditemukan dalam data RajaOngkir. Coba kata kunci kecamatan atau kota lain.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Kolom Alamat Jalan Terpisah */}
            <div>
              <label className="block text-[#716B64] mb-1 font-medium">
                Alamat Jalan / Detail Lokasi Gudang (Terpisah):
              </label>
              <textarea
                rows={2}
                value={formData.originAddress || ''}
                onChange={(e) => setFormData({ ...formData, originAddress: e.target.value })}
                placeholder="Contoh: Jl. Senopati No. 88, RT 02 / RW 03, Patokan depan minimarket (Gudang Utama)"
                className="w-full p-3 border border-[#E9E5DF] rounded-[10px] text-xs text-[#24221F] outline-none focus:border-[#87533F] resize-none"
              />
              <p className="text-[11px] text-[#716B64] mt-1">
                Alamat fisik lengkap atau patokan lokasi untuk keperluan penjemputan paket kurir (pick-up) dan cetak label pengiriman.
              </p>
            </div>

            {/* Uji Koneksi RajaOngkir */}
            <div className="mt-4 p-4 bg-[#FAF9F7] border border-[#E9E5DF] rounded-[16px] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-xs text-[#24221F]">Tes Koneksi Integrasi RajaOngkir</h3>
                  <p className="text-[11px] text-[#716B64]">
                    Uji cek tarif real-time kurir JNE dari alamat asal ke alamat tujuan dengan berat valid (1.000 gram).
                  </p>
                </div>
                <span className={`px-2.5 py-0.5 rounded-[999px] font-semibold text-[11px] shrink-0 ${formData.originCityId
                  ? 'bg-[#E8F3EF] text-[#26786C]'
                  : 'bg-[#FAECEA] text-[#B33D39]'
                  }`}>
                  {formData.originCityId ? `Asal ID: ${formData.originCityId}` : 'Asal Belum Diatur'}
                </span>
              </div>

              <div className="pt-1 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <button
                  type="button"
                  onClick={handleTestRajaOngkir}
                  disabled={testingRajaOngkir}
                  className="px-4 py-2 bg-[#24221F] hover:bg-[#40322B] text-white rounded-[10px] text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 shrink-0"
                >
                  <Truck className="w-3.5 h-3.5 text-[#B88770]" />
                  <span>{testingRajaOngkir ? 'Menguji Koneksi...' : 'Uji Koneksi Tarif JNE (RajaOngkir)'}</span>
                </button>
                <p className="text-[11px] text-[#A66337] flex items-center gap-1.5 font-medium">
                  <Info className="w-3.5 h-3.5 shrink-0 text-[#87533F]" />
                  <span>Uji koneksi ini memakai 1 kuota request API harian RajaOngkir. Gunakan hanya saat verifikasi konfigurasi.</span>
                </p>
              </div>

              {rajaOngkirResult && (
                <div
                  className={`p-3.5 rounded-[12px] text-xs border space-y-2 ${rajaOngkirResult.success
                    ? 'bg-[#E8F3EF] border-[#26786C]/30 text-[#1E574F]'
                    : 'bg-[#FAECEA] border-[#B33D39]/30 text-[#B33D39]'
                    }`}
                >
                  <div className="flex items-start gap-2">
                    {rajaOngkirResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-[#26786C] shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-[#B33D39] shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="font-semibold">
                        {rajaOngkirResult.success ? 'SUKSES: ' + rajaOngkirResult.message : 'GAGAL: ' + rajaOngkirResult.error}
                      </p>
                      {rajaOngkirResult.success && (
                        <p className="text-[11px] opacity-90 mt-0.5">
                          Tujuan: {rajaOngkirResult.destinationTested} &middot; Berat: {rajaOngkirResult.weightTestedGrams}g &middot; Kurir: JNE
                        </p>
                      )}
                    </div>
                  </div>

                  {rajaOngkirResult.success && rajaOngkirResult.services && rajaOngkirResult.services.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-[#26786C]/20">
                      <p className="font-semibold text-[11px] text-[#1E574F] mb-1.5">Layanan &amp; Tarif Terverifikasi dari RajaOngkir:</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {rajaOngkirResult.services.map((srv, idx) => (
                          <div key={idx} className="p-2 bg-white/80 rounded-[8px] border border-[#26786C]/20 text-[11px] flex justify-between items-center">
                            <div>
                              <span className="font-semibold text-[#24221F] block">{srv.service}</span>
                              <span className="text-[10px] text-[#716B64]">{srv.etd}</span>
                            </div>
                            <span className="font-bold text-[#26786C]">Rp{srv.cost.toLocaleString('id-ID')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: PEMBAYARAN */}
        {activeSection === 'PAYMENT' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-[15px] font-medium text-[#24221F]">Metode Pembayaran Checkout</h2>
              <p className="text-xs text-[#716B64]">Pilih metode pembayaran yang tersedia untuk pembeli: QRIS atau transfer BCA.</p>
            </div>

            {/* Business Priority Rule Explanation in 1 line */}
            <div className="p-3 bg-[#FAF9F7] border border-[#E9E5DF] rounded-[12px] text-[#716B64] text-[11px]">
              <strong className="text-[#24221F]">Aturan Bisnis Checkout:</strong> Transaksi &ge; Rp2.000.000 otomatis memprioritaskan Transfer Bank. Jika hanya 1 metode aktif, sistem otomatis menggunakannya.
            </div>

            {/* QRIS Toggle */}
            <div className="p-4 bg-white border border-[#E9E5DF] rounded-[16px] space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-xs text-[#24221F]">QRIS Standar (BCA / E-Wallet)</h3>
                  <p className="text-[11px] text-[#716B64]">BCA QRIS / GoPay / OVO / ShopeePay / Livin' Mandiri</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.qrisEnabled}
                    onChange={(e) => setFormData({ ...formData, qrisEnabled: e.target.checked })}
                    className="w-4 h-4 rounded text-[#26786C]"
                  />
                  <span className={`text-xs font-semibold ${formData.qrisEnabled ? 'text-[#26786C]' : 'text-[#716B64]'}`}>
                    {formData.qrisEnabled ? 'Aktif' : 'Nonaktif'}
                  </span>
                </label>
              </div>
            </div>

            {/* WORKBENCH PRATINJAU & UJI SCAN QRIS BERNOMINAL (LOKAL) */}
            <div className="p-5 bg-gradient-to-br from-[#FAF9F7] to-[#F5F2EC] border border-[#D5C7B7] rounded-[20px] shadow-sm space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E3DACF]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#24221F] text-[#E8D7C8] flex items-center justify-center">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-[#24221F]">Pratinjau &amp; Uji Scan QRIS Bernominal</h3>
                    <p className="text-[11px] text-[#716B64]">Generator lokal sesuai standar EMVCo / QRIS tanpa pihak ketiga</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-[#F5EDE4] text-[#87533F] border border-[#DFCFC0] rounded-full text-[10px] font-semibold tracking-wide uppercase">
                  Mode Pengujian Admin
                </span>
              </div>

              {/* Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#40322B] mb-1.5 font-semibold text-xs">
                    Nominal Uji Coba (Rupiah):
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-2.5 text-xs font-semibold text-[#8C827A]">Rp</span>
                      <input
                        type="number"
                        min="1"
                        step="1000"
                        value={testAmount || ''}
                        onChange={(e) => setTestAmount(Math.max(1, parseInt(e.target.value) || 0))}
                        className="w-full h-9 pl-9 pr-3 bg-white border border-[#D5C7B7] rounded-[10px] text-xs font-bold text-[#24221F] outline-none focus:border-[#87533F]"
                        placeholder="Contoh: 150000"
                      />
                    </div>
                  </div>
                  {/* Preset Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {[25000, 150000, 500000, 1014000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setTestAmount(preset)}
                        className={`px-2.5 py-1 rounded-[8px] text-[11px] font-medium transition-colors ${testAmount === preset
                          ? 'bg-[#87533F] text-white shadow-xs'
                          : 'bg-white border border-[#D5C7B7] text-[#40322B] hover:bg-[#F2ECE4]'
                          }`}
                      >
                        Rp{preset.toLocaleString('id-ID')}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[#40322B] mb-1.5 font-semibold text-xs">
                    Mode Inisiasi (Tag 01):
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTestPoi('12')}
                      className={`p-2 rounded-[10px] text-left border transition-all ${testPoi === '12'
                        ? 'border-[#26786C] bg-[#E8F3EF] text-[#1E574F] shadow-xs'
                        : 'border-[#D5C7B7] bg-white text-[#716B64] hover:bg-[#FAF9F7]'
                        }`}
                    >
                      <div className="font-semibold text-xs flex items-center justify-between">
                        <span>Dinamis (12)</span>
                        {testPoi === '12' && <Check className="w-3 h-3 text-[#26786C]" />}
                      </div>
                      <p className="text-[10px] opacity-80 mt-0.5">Direkomendasikan untuk nominal</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTestPoi('11')}
                      className={`p-2 rounded-[10px] text-left border transition-all ${testPoi === '11'
                        ? 'border-[#87533F] bg-[#F5EDE4] text-[#593424] shadow-xs'
                        : 'border-[#D5C7B7] bg-white text-[#716B64] hover:bg-[#FAF9F7]'
                        }`}
                    >
                      <div className="font-semibold text-xs flex items-center justify-between">
                        <span>Statis (11)</span>
                        {testPoi === '11' && <Check className="w-3 h-3 text-[#87533F]" />}
                      </div>
                      <p className="text-[10px] opacity-80 mt-0.5">Mode standar kompatibilitas</p>
                    </button>
                  </div>
                  <p className="text-[10px] text-[#716B64] mt-1.5">
                    Tag 01:12 menandakan QRIS Dinamis sehingga aplikasi perbankan langsung mengunci nominal.
                  </p>
                </div>
              </div>

              {/* QR Preview & Round-Trip Decode Details */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 pt-3 border-t border-[#E3DACF]">
                {/* QR Canvas Display */}
                <div className="md:col-span-5 flex flex-col items-center justify-center p-4 bg-white border border-[#D5C7B7] rounded-[16px] shadow-xs text-center">
                  <div className="text-[10px] font-bold text-[#87533F] tracking-wider uppercase mb-1.5">
                    Kode QRIS Uji Coba
                  </div>
                  {previewQrUrl ? (
                    <div className="p-3 bg-white border-2 border-dashed border-[#DFCFC0] rounded-[16px] shadow-inner inline-block my-1">
                      <img
                        src={previewQrUrl}
                        alt="Preview QRIS Dinamis Defra"
                        className="w-48 h-48 mx-auto object-contain rounded-[8px]"
                      />
                    </div>
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center border-2 border-dashed border-[#DFCFC0] rounded-[16px]">
                      <span className="text-xs text-[#716B64]">Membuat QR...</span>
                    </div>
                  )}
                  <div className="mt-2">
                    <span className="text-xs font-bold text-[#24221F]">
                      {previewDecoded?.merchantName || "D'efra Hijab, Fashion"}
                    </span>
                    <div className="text-xs font-extrabold text-[#26786C] mt-0.5">
                      {previewDecoded?.amountFormatted || `Rp${testAmount.toLocaleString('id-ID')}`}
                    </div>
                  </div>
                  <p className="text-[10px] text-[#716B64] mt-2 leading-tight">
                    Arahkan kamera aplikasi m-banking (BCA, GoPay, OVO, ShopeePay) ke QR ini untuk menguji apakah nama merchant &amp; nominal terbaca dengan benar.
                  </p>
                </div>

                {/* Round-trip Verification / Decode Result */}
                <div className="md:col-span-7 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[#24221F] flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-[#26786C]" />
                      <span>Hasil Verifikasi Balik (Round-Trip Decode)</span>
                    </h4>
                    <span className="px-2 py-0.5 bg-[#E8F3EF] text-[#26786C] rounded-[6px] font-bold text-[10px]">
                      CRC-16 VALID: {previewDecoded?.crc.expected}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2.5 bg-white border border-[#E9E5DF] rounded-[10px]">
                      <span className="text-[#8C827A] text-[10px] block">Merchant (Tag 59):</span>
                      <strong className="text-[#24221F]">{previewDecoded?.merchantName}</strong>
                    </div>
                    <div className="p-2.5 bg-white border border-[#E9E5DF] rounded-[10px]">
                      <span className="text-[#8C827A] text-[10px] block">Kota &amp; Pos (Tag 60/61):</span>
                      <strong className="text-[#24221F]">
                        {previewDecoded?.merchantCity} ({previewDecoded?.postalCode})
                      </strong>
                    </div>
                    <div className="p-2.5 bg-white border border-[#E9E5DF] rounded-[10px]">
                      <span className="text-[#8C827A] text-[10px] block">Nominal Terbaca (Tag 54):</span>
                      <strong className="text-[#26786C] text-xs">
                        {previewDecoded?.amountFormatted || 'Tidak ada'}
                      </strong>
                    </div>
                    <div className="p-2.5 bg-white border border-[#E9E5DF] rounded-[10px]">
                      <span className="text-[#8C827A] text-[10px] block">Inisiasi (Tag 01):</span>
                      <strong className="text-[#40322B]">{previewDecoded?.pointOfInitiationLabel}</strong>
                    </div>
                  </div>

                  {/* Raw Payload with Copy */}
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-[#716B64] mb-1">
                      <span className="font-semibold text-[#40322B]">String Payload EMVCo Terkalkulasi:</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(previewPayload);
                          setCopiedPayload(true);
                          setTimeout(() => setCopiedPayload(false), 2000);
                        }}
                        className="flex items-center gap-1 text-[#87533F] hover:underline font-semibold"
                      >
                        {copiedPayload ? (
                          <>
                            <Check className="w-3 h-3 text-[#26786C]" />
                            <span className="text-[#26786C]">Tersalin!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Salin Payload</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="p-2.5 bg-[#24221F] text-[#E8D7C8] rounded-[10px] font-mono text-[10px] break-all max-h-20 overflow-y-auto select-all leading-relaxed">
                      {previewPayload}
                    </div>
                  </div>
                </div>
              </div>

              {/* WARNING & LIMITATION AUDIT BOX (Kepatuhan Penuh Sesuai Instruksi) */}
              <div className="p-3.5 bg-amber-50/80 border border-amber-200/90 rounded-[14px] space-y-2 text-[11px] text-[#634211]">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span>Keterbatasan &amp; Ketentuan Operasional QRIS Bernominal Mandiri:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-[#634211] leading-relaxed pl-1">
                  <li>
                    <strong>Checkout memakai nominal server:</strong> QRIS pembeli dibuat ulang dari total reservasi aktif. QR lama disembunyikan ketika barang, voucher, atau ongkir sedang disinkronkan.
                  </li>
                  <li>
                    <strong>Bukan QR sekali pakai di switching bank:</strong> Dihasilkan secara lokal tanpa API payment gateway inter-bank (Midtrans/Xendit/DOKU), sehingga tidak memiliki session locking di server perbankan.
                  </li>
                  <li>
                    <strong>Tidak kedaluwarsa otomatis:</strong> Batas waktu reservasi 24 jam berlaku di database toko, bukan di sisi server switching QRIS.
                  </li>
                  <li>
                    <strong>Nominal tidak terkunci di 100% aplikasi:</strong> Meskipun Tag 01:12 disematkan, beberapa aplikasi perbankan tetap mengizinkan nasabah mengubah angka nominal saat transfer.
                  </li>
                  <li>
                    <strong>Verifikasi manual &amp; bukti upload tetap wajib:</strong> Sistem tidak menerima webhook instan. Admin wajib memeriksa mutasi rekening bank sebelum menandai pesanan lunas. <em>Pembayaran kurang tidak boleh ditandai lunas.</em>
                  </li>
                  <li>
                    <strong>Pembaruan otomatis jika total berubah:</strong> Jika rincian belanja, diskon voucher, atau biaya ongkir berubah, QR baru wajib di-generate ulang dengan nominal yang sesuai.
                  </li>
                  <li>
                    <strong>Integritas file aset:</strong> Generator ini tidak menimpa aset QRIS asli di <code>/assets/payments/qris.png</code>.
                  </li>
                </ul>
              </div>
            </div>

            {/* Bank Transfer Toggle & Account Details */}
            <div className="p-4 bg-white border border-[#E9E5DF] rounded-[16px] space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-xs text-[#24221F]">Transfer Bank Manual</h3>
                  <p className="text-[11px] text-[#716B64]">Verifikasi bukti upload struk transfer</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.bankTransferEnabled}
                    onChange={(e) => setFormData({ ...formData, bankTransferEnabled: e.target.checked })}
                    className="w-4 h-4 rounded text-[#26786C]"
                  />
                  <span className={`text-xs font-semibold ${formData.bankTransferEnabled ? 'text-[#26786C]' : 'text-[#716B64]'}`}>
                    {formData.bankTransferEnabled ? 'Aktif' : 'Nonaktif'}
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#E9E5DF]">
                <div>
                  <label className="block text-[#716B64] mb-1 font-medium">Nama Bank:</label>
                  <input
                    type="text"
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    className="w-full h-9 px-3 border border-[#E9E5DF] rounded-[8px] text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[#716B64] mb-1 font-medium">Nomor Rekening:</label>
                  <input
                    type="text"
                    value={formData.bankAccountNumber}
                    onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                    className="w-full h-9 px-3 border border-[#E9E5DF] rounded-[8px] text-xs font-sans font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[#716B64] mb-1 font-medium">Atas Nama:</label>
                  <input
                    type="text"
                    value={formData.bankAccountHolder}
                    onChange={(e) => setFormData({ ...formData, bankAccountHolder: e.target.value })}
                    className="w-full h-9 px-3 border border-[#E9E5DF] rounded-[8px] text-xs font-semibold"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: NOTIFIKASI TELEGRAM */}
        {activeSection === 'NOTIFICATIONS' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-[15px] font-medium text-[#24221F]">Notifikasi Pesanan ke Telegram</h2>
              <p className="text-xs text-[#716B64]">Pemberitahuan ke chat pribadi atau grup owner setelah pesanan dan bukti berhasil disimpan</p>
            </div>

            <div className="p-4 bg-[#FAF9F7] border border-[#E9E5DF] rounded-[16px] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-[#24221F]">Status pengiriman Telegram:</span>
                <span className={`px-2.5 py-0.5 rounded-[999px] font-semibold text-[11px] ${telegramState === 'PROBLEM' ? 'bg-[#FAECEA] text-[#B33D39]' : telegramState === 'WAITING' ? 'bg-[#FFF4DE] text-[#94691E]' : 'bg-[#E8F3EF] text-[#26786C]'}`}>
                  {telegramState === 'ACTIVE' ? 'Pengiriman aktif' : telegramState === 'WAITING' ? 'Pesan menunggu' : telegramState === 'PROBLEM' ? 'Pengiriman bermasalah' : telegramConfigured === false ? 'Belum dikonfigurasi' : 'Memeriksa...'}
                </span>
              </div>
              <p className="text-[#716B64] text-[11px]">
                Token bot dan Chat ID dikelola aman pada sisi server. Chat pribadi, grup, dan supergroup didukung oleh Telegram.
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleTestTelegram}
                  disabled={testingTelegram}
                  className="px-4 py-2 bg-[#24221F] hover:bg-[#40322B] text-white rounded-[10px] text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5 text-[#B88770]" />
                  <span>{testingTelegram ? 'Mengirim Tes...' : 'Uji Kirim Pesan Telegram'}</span>
                </button>
                <button type="button" onClick={checkTelegramStatus} className="px-4 py-2 border border-[#E9E5DF] bg-white rounded-[10px] text-xs font-semibold">Periksa Status Antrean</button>
              </div>

              {telegramStatus && (
                <div
                  className={`p-3 rounded-[10px] text-xs font-medium border ${telegramStatus.startsWith('SUKSES')
                    ? 'bg-[#E8F3EF] border-[#26786C]/30 text-[#26786C]'
                    : 'bg-[#FAECEA] border-[#B33D39]/30 text-[#B33D39]'
                    }`}
                >
                  {telegramStatus}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: AMBANG BATAS STOK */}
        {activeSection === 'STOCK' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-[15px] font-medium text-[#24221F]">Ambang Batas Peringatan Stok</h2>
              <p className="text-xs text-[#716B64]">Variasi dengan sisa stok di bawah nilai ini akan memicu peringatan di dashboard</p>
            </div>

            <div className="max-w-xs">
              <label className="block text-[#716B64] mb-1 font-medium">Batas Minimum Peringatan (Pcs):</label>
              <input
                type="number"
                min={1}
                required
                value={formData.lowStockThreshold}
                onChange={(e) => setFormData({ ...formData, lowStockThreshold: Number(e.target.value) })}
                className="w-full h-11 px-3 border border-[#E9E5DF] rounded-[10px] font-sans font-bold text-sm text-[#24221F] outline-none focus:border-[#87533F]"
              />
              <span className="text-[10px] text-[#716B64] mt-1 block">
                Default: 5 unit. Variasi dengan stok &le; ambang ini muncul di panel Perlu Perhatian.
              </span>
            </div>
          </div>
        )}

        {/* Form Save Button */}
        <div className="pt-4 border-t border-[#E9E5DF] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <span className="text-[11px] text-[#716B64]">

          </span>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-[#24221F] hover:bg-[#40322B] text-white rounded-[10px] font-semibold text-xs flex items-center gap-2 transition-colors shadow-xs disabled:opacity-50 shrink-0"
          >
            <Save className="w-3.5 h-3.5 text-[#B88770]" />
            <span>{saving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
