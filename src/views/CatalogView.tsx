import React, { useEffect, useState } from 'react';
import { Header } from '../components/Header.tsx';
import { Footer } from '../components/Footer.tsx';
import { CartDrawer } from '../components/CartDrawer.tsx';
import { ProductCatalog } from '../components/ProductCatalog.tsx';
import { Search } from 'lucide-react';
import type { Product, Category } from '../types/index.ts';
import { useCart } from '../context/CartContext.tsx';
import { subscribeStorefrontInvalidation } from '../utils/storefrontInvalidation.ts';

interface CatalogViewProps {
  onNavigate: (route: string) => void;
  initialCategory?: string;
  isWishlistView?: boolean;
}

export const CatalogView: React.FC<CatalogViewProps> = ({
  onNavigate,
  initialCategory,
  isWishlistView = false
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>(initialCategory || 'ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('newest');
  const [loading, setLoading] = useState(true);
  const { wishlist } = useCart();

  useEffect(() => {
    let controller: AbortController | null = null;
    const refresh = () => {
      controller?.abort();
      controller = new AbortController();
      const request = (url:string) => fetch(url, { cache:'no-store', signal:controller!.signal }).then((res)=>res.ok?res.json():Promise.reject(new Error('PUBLIC_FETCH_FAILED')));
      void request('/api/public/categories').then((data) => {
        if (data.categories) {
          setCategories(data.categories);
          if (initialCategory) {
            const exactCategory = data.categories.find((category: Category) => category.id === initialCategory || category.slug === initialCategory);
            setSelectedCat(exactCategory?.id || 'ALL');
          }
        }
      }).catch(() => {});
      void request('/api/public/products').then((data)=>setProducts(data.products||[])).catch(()=>{}).finally(()=>setLoading(false));
    };
    refresh();
    const unsubscribe = subscribeStorefrontInvalidation(refresh);
    const handlePageShow = () => refresh();
    window.addEventListener('pageshow', handlePageShow);
    return () => { controller?.abort(); unsubscribe(); window.removeEventListener('pageshow', handlePageShow); };
  }, []);

  let displayed = [...products];

  if (isWishlistView) {
    displayed = displayed.filter((p) => wishlist.includes(p.id));
  } else {
    if (selectedCat !== 'ALL') {
      displayed = displayed.filter((p) => p.categoryId === selectedCat);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      displayed = displayed.filter(
        (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
      );
    }
    if (sortOption === 'bestseller') {
      displayed.sort((a, b) => (b.totalSoldUnits || 0) - (a.totalSoldUnits || 0));
    } else if (sortOption === 'price_asc') {
      displayed.sort((a, b) => a.basePrice - b.basePrice);
    } else if (sortOption === 'price_desc') {
      displayed.sort((a, b) => b.basePrice - a.basePrice);
    }
  }

  return (
    <div className="min-h-screen bg-white text-[#282420] flex flex-col">
      <Header onNavigate={onNavigate} categories={categories} />

      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 py-8 md:py-12">
        {/* Page Title */}
        <div className="text-center mb-8">
          <h1 className="text-[26px] md:text-[32px] font-medium text-[#282420] tracking-tight">
            {isWishlistView ? 'Daftar Favorit Saya' : 'Katalog Koleksi Hijab'}
          </h1>
          <p className="mt-2 text-[14px] text-[#706861]">
            {isWishlistView
              ? `${displayed.length} item tersimpan dalam daftar favorit Anda.`
              : 'Eksplorasi ragam material voal, pashmina, dan silk pilihan.'}
          </p>
        </div>

        {/* Search & Filter Controls */}
        {!isWishlistView && (
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8 pb-6 border-b border-[#E8E2DC]">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#706861]" />
              <input
                type="text"
                placeholder="Cari nama atau bahan hijab..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 pl-10 pr-4 bg-white border border-[#E8E2DC] rounded-[4px] text-sm text-[#282420] placeholder:text-[#706861] focus:outline-none focus:border-[#282420]"
              />
            </div>

            {/* Category and Sort Selectors */}
            <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
              <select
                value={selectedCat}
                onChange={(e) => setSelectedCat(e.target.value)}
                className="h-11 px-3 bg-white border border-[#E8E2DC] rounded-[4px] text-xs font-medium text-[#282420] focus:outline-none focus:border-[#282420]"
              >
                <option value="ALL">Semua Kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="h-11 px-3 bg-white border border-[#E8E2DC] rounded-[4px] text-xs font-medium text-[#282420] focus:outline-none focus:border-[#282420]"
              >
                <option value="newest">Koleksi Terbaru</option>
                <option value="bestseller">Paling Populer (Best Seller)</option>
                <option value="price_asc">Harga: Terendah ke Tertinggi</option>
                <option value="price_desc">Harga: Tertinggi ke Terendah</option>
              </select>
            </div>
          </div>
        )}

        {/* Product Grid */}
        {loading && products.length === 0 ? (
          <div aria-label="Memuat produk" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4"><>{Array.from({length:8},(_,i)=><div key={i}><div className="defra-skeleton bg-[#F3EBDF] aspect-[3/4]"/><div className="defra-skeleton bg-[#F3EBDF] h-4 w-3/4 mx-auto mt-3"/><div className="defra-skeleton bg-[#F3EBDF] h-4 w-1/2 mx-auto mt-2"/></div>)}</></div>
        ) : displayed.length === 0 ? (
          <div className="py-20 text-center text-[#706861]">
            <p className="text-sm">Tidak ada produk yang cocok dengan pencarian Anda.</p>
            <button
              type="button"
              onClick={() => {
                setSelectedCat('ALL');
                setSearchQuery('');
              }}
              className="mt-4 px-5 py-2 bg-[#282420] text-white text-xs font-medium rounded-[4px]"
            >
              Reset Filter
            </button>
          </div>
        ) : (
          <ProductCatalog
            products={displayed}
            onSelectProduct={(id) => onNavigate(`/produk/${id}`)}
            title={isWishlistView ? 'Item Favorit Anda' : 'Daftar Produk'}
            categories={categories}
          />
        )}
      </main>

      <Footer onNavigate={onNavigate} />
      <CartDrawer onNavigate={onNavigate} />
    </div>
  );
};
