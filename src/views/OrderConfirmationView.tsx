import React, { useState, useEffect, useLayoutEffect } from 'react';
import { Header } from '../components/Header.tsx';
import { Footer } from '../components/Footer.tsx';
import { CheckCircle2, Copy, MessageCircle, ArrowRight, Clock } from 'lucide-react';
import type { Order } from '../types/index.ts';

interface OrderConfirmationViewProps {
  orderNumber: string;
  onNavigate: (route: string) => void;
}

export const OrderConfirmationView: React.FC<OrderConfirmationViewProps> = ({
  orderNumber,
  onNavigate
}) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [copied, setCopied] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('6281234567890');

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [orderNumber]);

  useEffect(() => {
    fetch('/api/public/bootstrap')
      .then((res) => res.json())
      .then((data) => {
        if (data.settings?.whatsappNumber) {
          setWhatsappNumber(data.settings.whatsappNumber);
        }
      })
      .catch(() => { });
  }, []);

  const handleCopyOrderNumber = () => {
    navigator.clipboard.writeText(orderNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    const text = encodeURIComponent(
      `Halo Defra Hijab, saya ingin mengonfirmasi pesanan saya dengan Nomor Pesanan: ${orderNumber}. Bukti pembayaran telah saya upload di web. Terima kasih!`
    );
    window.open(`https://wa.me/${whatsappNumber}?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-white text-[#282420] flex flex-col">
      <Header onNavigate={onNavigate} />

      <main className="flex-1 w-full max-w-[800px] mx-auto px-4 sm:px-6 lg:px-12 py-12 md:py-16 text-center">
        {/* Success Icon */}
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#F3EBDF] flex items-center justify-center text-[#B88770]">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <h1 className="text-[24px] md:text-[28px] font-medium text-[#282420] tracking-tight">
          Pesanan Berhasil Disimpan
        </h1>
        <p className="mt-2 text-[14px] text-[#706861] max-w-md mx-auto">
          Terima kasih telah berbelanja di Defra Hijab. Bukti pembayaran Anda telah berhasil diunggah dan sedang dalam antrean verifikasi manual admin.
        </p>

        {/* Order Card Container */}
        <div className="mt-8 p-6 md:p-8 border border-[#E8E2DC] rounded-[4px] bg-[#F3EBDF]/10 text-left space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E8E2DC]">
            <div>
              <span className="text-xs text-[#706861] uppercase tracking-wider">Nomor Pesanan Anda</span>
              <div className="text-[20px] md:text-[22px] font-sans font-medium text-[#282420] mt-0.5">
                {orderNumber}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyOrderNumber}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#E8E2DC] bg-white rounded-[4px] text-xs font-medium text-[#282420] hover:border-[#282420] transition-colors self-start sm:self-center"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? 'Nomor Tersalin!' : 'Salin Nomor Pesanan'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-[#706861] block">Status Pembayaran:</span>
              <span className="inline-flex items-center gap-1.5 mt-1 font-medium text-[#B88770]">
                <Clock className="w-3.5 h-3.5" /> Menunggu verifikasi admin
              </span>
            </div>
            <div>
              <span className="text-[#706861] block">Status Pemenuhan Barang:</span>
              <span className="font-medium text-[#282420] block mt-1">
                Menunggu pembayaran terverifikasi
              </span>
            </div>
          </div>

          <div className="p-4 bg-white border border-[#E8E2DC] rounded-[4px] text-xs text-[#706861] space-y-1.5">
            <p className="font-medium text-[#282420]">Catatan Penting:</p>
            <p>&bull; Anda akan segera dihubungi oleh admin</p>
            <p>&bull; Pemilik toko akan memeriksa mutasi dana secara manual sebelum paket dikemas dan diserahkan ke Ekspedisi.</p>
            <p>&bull; Anda dapat memantau status pesanan kapan saja melalui menu <strong>Cek Status Pesanan</strong>.</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            type="button"
            onClick={handleOpenWhatsApp}
            className="w-full sm:w-auto px-6 h-11 bg-[#282420] text-white text-[14px] font-medium rounded-[4px] hover:bg-[#3d3834] transition-colors inline-flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Kirim Konfirmasi via WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('/cek-status')}
            className="w-full sm:w-auto px-6 h-11 border border-[#282420] bg-white text-[#282420] text-[14px] font-medium rounded-[4px] hover:bg-[#F3EBDF]/30 transition-colors inline-flex items-center justify-center gap-2"
          >
            <span>Cek Status Pesanan</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={() => onNavigate('/katalog')}
            className="text-xs text-[#706861] hover:text-[#282420] underline transition-colors"
          >
            Lanjut Berbelanja
          </button>
        </div>
      </main>

      <Footer onNavigate={onNavigate} whatsappNumber={whatsappNumber} />
    </div>
  );
};
