import React, { useState, useEffect } from 'react';
import { Menu, Search, Heart, ShoppingBag, X } from 'lucide-react';
import { useCart } from '../context/CartContext.tsx';
import type { Category } from '../types/index.ts';

interface HeaderProps {
  onNavigate: (route: string) => void;
  onOpenSearch?: () => void;
  categories?: Category[];
}
const EMPTY_CATEGORIES: Category[] = [];

export const Header: React.FC<HeaderProps> = ({ onNavigate, onOpenSearch, categories = EMPTY_CATEGORIES }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [navCategories, setNavCategories] = useState<Category[]>(categories);
  const { totalItems, wishlist, setIsCartOpen } = useCart();

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 24) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (categories.length) {
      setNavCategories(categories);
      return;
    }
    const controller = new AbortController();
    fetch('/api/public/categories', { cache: 'no-store', signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('CATEGORY_FETCH_FAILED')))
      .then((data) => setNavCategories(data.categories || []))
      .catch(() => {});
    return () => controller.abort();
  }, [categories]);

  return (
    <>
      <header
        className={`sticky top-0 z-40 w-full transition-all duration-200 ${
          isScrolled
            ? 'bg-white/92 backdrop-blur-md border-b border-[#E8E2DC]'
            : 'bg-white border-b border-transparent'
        }`}
      >
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 h-[72px] lg:h-[88px] flex items-center justify-between relative">
          
          {/* SISI KIRI: Menu & Pencarian */}
          <div className="flex items-center gap-1 sm:gap-2 z-10">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Buka menu navigasi"
              className="w-11 h-11 flex items-center justify-center text-[#282420] hover:text-[#B88770] transition-colors"
            >
              <Menu className="w-5 h-5 lg:w-[22px] lg:h-[22px]" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => (onOpenSearch ? onOpenSearch() : onNavigate('/katalog'))}
              aria-label="Cari produk hijab"
              className="w-11 h-11 flex items-center justify-center text-[#282420] hover:text-[#B88770] transition-colors"
            >
              <Search className="w-5 h-5 lg:w-[22px] lg:h-[22px]" strokeWidth={1.5} />
            </button>
          </div>

          {/* TENGAH GEOMETRIS: Logo Monogram DE Terpusat */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              aria-label="Defra Hijab Beranda"
              className="pointer-events-auto flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#282420]"
            >
              <img
                src="/public/assets/brand/defra-logo.svg"
                alt="Defra Hijab Logo"
                className="w-16 h-12 lg:w-20 lg:h-14 object-contain"
              />
            </button>
          </div>

          {/* SISI KANAN: Wishlist & Tas Belanja */}
          <div className="flex items-center gap-1 sm:gap-2 z-10">
            <button
              type="button"
              onClick={() => onNavigate('/katalog?filter=wishlist')}
              aria-label={`Wishlist favorit (${wishlist.length} item)`}
              className="w-11 h-11 flex items-center justify-center text-[#282420] hover:text-[#B88770] transition-colors relative"
            >
              <Heart className="w-5 h-5 lg:w-[22px] lg:h-[22px]" strokeWidth={1.5} />
              {wishlist.length > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#B88770]" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              aria-label={`Tas belanja (${totalItems} item)`}
              className="w-11 h-11 flex items-center justify-center text-[#282420] hover:text-[#B88770] transition-colors relative"
            >
              <ShoppingBag className="w-5 h-5 lg:w-[22px] lg:h-[22px]" strokeWidth={1.5} />
              {totalItems > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-[#282420] text-white text-[10px] font-medium flex items-center justify-center rounded-full">
                  {totalItems}
                </span>
              )}
            </button>
          </div>

        </div>
      </header>

      {/* Drawer Menu Navigasi Sederhana */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex motion-overlay">
          <div
            className="fixed inset-0 bg-[#282420]/30 transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative w-full max-w-xs bg-white h-full shadow-lg p-6 flex flex-col justify-between z-10 motion-drawer-left">
            <div>
              <div className="flex items-center justify-between pb-6 border-b border-[#E8E2DC]">
                <span className="text-xs uppercase tracking-widest text-[#706861] font-medium">Navigasi</span>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-11 h-11 -mr-2 flex items-center justify-center text-[#282420] hover:text-[#B88770]"
                  aria-label="Tutup menu"
                >
                  <X className="w-5 h-5" strokeWidth={1.5} />
                </button>
              </div>
              <nav className="mt-6 flex flex-col gap-4 text-sm font-medium text-[#282420]">
                <button
                  type="button"
                  onClick={() => {
                    onNavigate('/');
                    setIsMobileMenuOpen(false);
                  }}
                  className="text-left py-2 hover:text-[#B88770] transition-colors"
                >
                  Beranda
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate('/katalog');
                    setIsMobileMenuOpen(false);
                  }}
                  className="text-left py-2 hover:text-[#B88770] transition-colors"
                >
                  Semua Koleksi Hijab
                </button>
                {navCategories.filter((category) => category.isActive).slice(0, 4).map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      onNavigate(`/katalog?cat=${encodeURIComponent(category.id)}`);
                      setIsMobileMenuOpen(false);
                    }}
                    className="text-left py-2 hover:text-[#B88770] transition-colors text-[#706861]"
                  >
                    {category.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    onNavigate('/cek-status');
                    setIsMobileMenuOpen(false);
                  }}
                  className="text-left py-2 hover:text-[#B88770] transition-colors"
                >
                  Cek Status Pesanan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate('/retur');
                    setIsMobileMenuOpen(false);
                  }}
                  className="text-left py-2 hover:text-[#B88770] transition-colors text-[#706861]"
                >
                  Kebijakan &amp; Pengajuan Retur
                </button>
              </nav>
            </div>

            <div className="pt-6 border-t border-[#E8E2DC] text-xs text-[#706861]">
              <p className="font-medium text-[#282420]">Defra Hijab Official</p>
              <p className="mt-1">Modest fashion &amp; premium hijab store.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
