import React, { useState } from 'react';
import { Header } from '../components/Header.tsx';
import { Footer } from '../components/Footer.tsx';
import { RotateCcw, AlertCircle, CheckCircle2, ShieldCheck, ArrowLeft } from 'lucide-react';

interface ReturnPolicyViewProps {
  onNavigate: (route: string) => void;
  initialOrderNumber?: string;
}

export const ReturnPolicyView: React.FC<ReturnPolicyViewProps> = ({
  onNavigate,
  initialOrderNumber = ''
}) => {
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [requestedResolution, setRequestedResolution] = useState<'REFUND' | 'REPLACEMENT'>('REFUND');
  const [reasonCategory, setReasonCategory] = useState<'WRONG_ITEM' | 'DAMAGED' | 'DEFECTIVE'>('DEFECTIVE');
  const [customerNotes, setCustomerNotes] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submittedReturnNumber, setSubmittedReturnNumber] = useState<string | null>(null);

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!orderNumber.trim() || !email.trim() || !whatsapp.trim() || !customerNotes.trim()) {
      setError('Seluruh kolom formulir verifikasi dan catatan kendala wajib diisi.');
      return;
    }

    setLoading(true);
    try {
      const payload = new FormData();
      payload.append('orderNumber', orderNumber.trim());
      payload.append('customerEmail', email.trim());
      payload.append('customerWhatsapp', whatsapp.trim());
      payload.append('requestedResolution', requestedResolution);
      payload.append('reasonCategory', reasonCategory);
      payload.append('customerNotes', customerNotes.trim());
      if (proofFile) payload.append('proofs', proofFile);
      const res = await fetch('/api/returns/submit', { method: 'POST', body: payload });

      const data = await res.json();
      if (!res.ok || !data.returnRequest) {
        setError(data.error || 'Gagal mengajukan permohonan retur.');
      } else {
        setSubmittedReturnNumber(data.returnRequest.returnNumber);
      }
    } catch {
      setError('Terjadi kendala jaringan saat mengajukan retur.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#282420] flex flex-col">
      <Header onNavigate={onNavigate} />

      <main className="flex-1 w-full max-w-[800px] mx-auto px-4 sm:px-6 lg:px-12 py-10 md:py-16 text-left">
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="inline-flex items-center gap-1.5 text-xs text-[#706861] hover:text-[#282420] mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Beranda</span>
        </button>

        <h1 className="text-[24px] md:text-[28px] font-medium text-[#282420] tracking-tight mb-2">
          Ketentuan &amp; Pengajuan Retur
        </h1>
        <p className="text-[14px] text-[#706861] mb-8">
          Defra Hijab berkomitmen menjaga kepuasan Anda melalui jaminan kualitas material dan kerapian jahitan setiap helai hijab.
        </p>

        {/* Kotak Kebijakan Resmi 3 Hari */}
        <div className="p-6 border border-[#E8E2DC] rounded-[4px] bg-[#F3EBDF]/20 space-y-3 mb-10 text-xs text-[#706861]">
          <h2 className="text-sm font-medium text-[#282420] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#B88770]" />
            <span>Ketentuan Retur 3 Hari Defra Hijab</span>
          </h2>
          <p>
            &bull; <strong>Jangka Waktu:</strong> Pengajuan retur dapat dilakukan maksimal <strong>3 hari (Jabodetabek)</strong> sejak tanggal faktual barang diterima.
          </p>
          <p>
            &bull; <strong>Syarat Kelayakan:</strong> Hanya berlaku untuk barang salah kirim, produk rusak saat ekspedisi, atau cacat jahitan/kain dari pabrik. Kami tidak melayani retur karena perubahan selera atau salah memilih warna secara mandiri.
          </p>
          <p>
            &bull; <strong>Ongkos Kirim Balik:</strong> Sepenuhnya ditanggung oleh pihak toko apabila kendala disebabkan oleh kelalaian pihak kami.
          </p>
        </div>

        {submittedReturnNumber ? (
          <div className="p-8 border border-emerald-200 bg-emerald-50 rounded-[4px] text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-medium text-emerald-900">
              Pengajuan Retur Berhasil Dikirim
            </h3>
            <p className="text-xs text-emerald-800 max-w-md mx-auto">
              Nomor Registrasi Retur Anda adalah <strong className="font-sans text-sm">{submittedReturnNumber}</strong>. Tim Defra Hijab akan meninjau keluhan Anda dan menghubungi via WhatsApp dalam 1x24 jam kerja.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="mt-4 px-6 py-2.5 bg-[#282420] text-white text-xs font-medium rounded-[4px]"
            >
              Kembali ke Beranda
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmitReturn} className="p-6 md:p-8 border border-[#E8E2DC] rounded-[4px] space-y-6">
            <h2 className="text-[16px] font-medium text-[#282420] pb-2 border-b border-[#E8E2DC]">
              Formulir Pengajuan Retur
            </h2>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-[4px] flex items-start gap-3 text-xs text-red-800">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-700 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#282420] mb-1.5">
                Nomor Pesanan <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="DF-R8K2P9X4"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
                className="w-full h-11 px-3 bg-white border border-[#E8E2DC] rounded-[4px] text-sm font-sans text-[#282420] focus:outline-none focus:border-[#282420]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#282420] mb-1.5">
                  Email Pesanan <span className="text-red-600">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="nama@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 px-3 bg-white border border-[#E8E2DC] rounded-[4px] text-sm text-[#282420] focus:outline-none focus:border-[#282420]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#282420] mb-1.5">
                  Nomor WhatsApp <span className="text-red-600">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="081234567890"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="w-full h-11 px-3 bg-white border border-[#E8E2DC] rounded-[4px] text-sm text-[#282420] focus:outline-none focus:border-[#282420]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#282420] mb-1.5">
                  Alasan Permohonan <span className="text-red-600">*</span>
                </label>
                <select
                  value={reasonCategory}
                  onChange={(e) => setReasonCategory(e.target.value as any)}
                  className="w-full h-11 px-3 bg-white border border-[#E8E2DC] rounded-[4px] text-xs font-medium text-[#282420] focus:outline-none focus:border-[#282420]"
                >
                  <option value="DEFECTIVE">Cacat Jahitan atau Kerusakan Kain</option>
                  <option value="WRONG_ITEM">Salah Kirim Barang atau Warna</option>
                  <option value="DAMAGED">Paket Rusak saat Pengiriman</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#282420] mb-1.5">
                  Solusi yang Diharapkan <span className="text-red-600">*</span>
                </label>
                <select
                  value={requestedResolution}
                  onChange={(e) => setRequestedResolution(e.target.value as any)}
                  className="w-full h-11 px-3 bg-white border border-[#E8E2DC] rounded-[4px] text-xs font-medium text-[#282420] focus:outline-none focus:border-[#282420]"
                >
                  <option value="REFUND">Pengembalian Dana (Refund)</option>
                  <option value="REPLACEMENT">Penggantian Produk yang Sama</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#282420] mb-1.5">
                Jelaskan Detail Kendala Produk <span className="text-red-600">*</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="Jelaskan secara spesifik cacat jahitan atau barang yang tidak sesuai..."
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                className="w-full p-3 bg-white border border-[#E8E2DC] rounded-[4px] text-sm text-[#282420] focus:outline-none focus:border-[#282420]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#282420] mb-1.5">
                Foto Bukti Kendala (maksimal 2 MB)
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  if (file && file.size > 2_000_000) {
                    setError('Ukuran foto bukti maksimal 2 MB.');
                    e.target.value = '';
                    setProofFile(null);
                  } else setProofFile(file);
                }}
                className="w-full h-11 px-3 bg-white border border-[#E8E2DC] rounded-[4px] text-xs text-[#282420] focus:outline-none focus:border-[#282420]"
              />
              <p className="mt-1 text-[11px] text-[#706861]">
                File disimpan privat dan hanya dapat dibuka owner melalui tautan sementara.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-[#282420] text-white text-[14px] font-medium rounded-[4px] hover:bg-[#3d3834] transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{loading ? 'Mengirim Pengajuan...' : 'Kirim Pengajuan Retur'}</span>
            </button>
          </form>
        )}
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  );
};
