import React from 'react';

interface FooterProps {
  onNavigate: (route: string) => void;
  whatsappNumber?: string;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, whatsappNumber = '6281234567890' }) => {
  return (
    <footer data-reveal className="w-full bg-white border-t border-[#E8E2DC] py-8 mt-16 md:mt-24">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 text-left">

          {/* Kolom 1: Brand & Filosofi */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <img
                src="/assets/brand/defra-logo.svg"
                alt="Defra Hijab"
                className="w-14 h-10 object-contain"
              />
            </div>
            <p className="text-[13px] text-[#706861] leading-relaxed max-w-sm">
              Defra Hijab menghadirkan kurasi hijab voal, pashmina, dan silk dengan jahitan presisi, drape anggun, serta kenyamanan material untuk wanita Indonesia.
            </p>
          </div>

          {/* Kolom 2: Layanan & Informasi Pelanggan */}
          <div>
            <h4 className="text-[14px] font-medium text-[#282420] mb-3">Layanan Pelanggan</h4>
            <ul className="space-y-2 text-[13px] text-[#706861]">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/katalog')}
                  className="hover:text-[#282420] transition-colors"
                >
                  Katalog Koleksi Hijab
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/cek-status')}
                  className="hover:text-[#282420] transition-colors"
                >
                  Cek Status Pesanan
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('/retur')}
                  className="hover:text-[#282420] transition-colors"
                >
                  Ketentuan Retur
                </button>
              </li>
            </ul>
          </div>

          {/* Kolom 3: Kontak & Pengiriman */}
          <div>
            <h4 className="text-[14px] font-medium text-[#282420] mb-3">Kontak &amp; Bantuan</h4>
            <p className="text-[13px] text-[#706861] leading-relaxed mb-3">
              WhatsApp Layanan Pelanggan:{' '}
              <a
                href={`https://wa.me/${whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#282420] font-medium underline"
              >
                +{whatsappNumber}
              </a>
            </p>
            <p className="text-[12px] text-[#706861]">
            </p>
          </div>

        </div>

        {/* Garis Hak Cipta Singkat */}
        <div className="pt-6 border-t border-[#E8E2DC]/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-[#706861]">
          <p>&copy; {new Date().getFullYear()} Defra Hijab. Seluruh hak cipta dilindungi.</p>
          <p className="text-[11px] text-[#706861]/80">Semua produk ready stock &amp; checkout aman.</p>
        </div>
      </div>
    </footer>
  );
};
