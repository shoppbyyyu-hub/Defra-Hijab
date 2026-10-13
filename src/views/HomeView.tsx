import React, { useEffect, useState } from 'react';
import { Header } from '../components/Header.tsx';
import { Hero } from '../components/Hero.tsx';
import { CategoriesSection } from '../components/CategoriesSection.tsx';
import { CampaignGallery } from '../components/CampaignGallery.tsx';
import { ProductCatalog } from '../components/ProductCatalog.tsx';
import { AsSeenOn } from '../components/AsSeenOn.tsx';
import { Footer } from '../components/Footer.tsx';
import { CartDrawer } from '../components/CartDrawer.tsx';
import type { Category, HeroBanner, CampaignGalleryItem, CommunityReel, Product } from '../types/index.ts';
import { subscribeStorefrontInvalidation } from '../utils/storefrontInvalidation.ts';

interface HomeViewProps {
  onNavigate: (route: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onNavigate }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [heroBanner, setHeroBanner] = useState<HeroBanner | undefined>();
  const [gallery, setGallery] = useState<CampaignGalleryItem[]>([]);
  const [reels, setReels] = useState<CommunityReel[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [whatsappNumber, setWhatsappNumber] = useState('6281234567890');
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);

  useEffect(() => {
    let controller: AbortController | null = null;
    const refresh = () => {
      controller?.abort();
      controller = new AbortController();
      const request = (url: string) => fetch(url, { cache: 'no-store', signal: controller!.signal }).then((res) => res.ok ? res.json() : Promise.reject(new Error('PUBLIC_FETCH_FAILED')));
      void request('/api/public/categories').then((data) => setCategories(data.categories || [])).catch(() => {}).finally(() => setCategoriesLoading(false));
      void request('/api/public/products').then((data) => setProducts(data.products || [])).catch(() => {}).finally(() => setProductsLoading(false));
      void request('/api/public/content').then((data) => {
        setHeroBanner(data.heroBanners?.[0]);
        setGallery(data.campaignGallery || []);
        setReels(data.communityReels || []);
      }).catch(() => {}).finally(() => setContentLoading(false));
      void request('/api/public/settings').then((data) => {
        if (data.settings?.whatsappNumber) setWhatsappNumber(data.settings.whatsappNumber);
      }).catch(() => {});
    };
    refresh();
    const unsubscribe = subscribeStorefrontInvalidation(refresh);
    const handlePageShow = (event:PageTransitionEvent) => { if (event.persisted) refresh(); };
    window.addEventListener('pageshow', handlePageShow);
    return () => { controller?.abort(); unsubscribe(); window.removeEventListener('pageshow', handlePageShow); };
  }, []);

  return (
    <div className="min-h-screen bg-white text-[#282420] flex flex-col">
      {/* 1. Header Sticky with Liquid Glass */}
      <Header onNavigate={onNavigate} categories={categories} />

      <main className="flex-1 w-full">
        {/* 2. Hero: 1 Edge-to-edge banner, 2:1 desktop / 4:5 mobile, BEBAS TEKS */}
        <Hero banner={heroBanner} loading={contentLoading} />

        {/* 3. Shop by Categories: Persis "Shop by Categories", 4 cols desktop, ~68% mobile rail */}
        {categoriesLoading && categories.length === 0 ? <CategoriesSkeleton /> : <CategoriesSection
          categories={categories}
          onSelectCategory={(categoryId) => onNavigate(`/katalog?cat=${encodeURIComponent(categoryId)}`)}
        />}

        {/* 4. Campaign Photo Gallery: 1 Landscape (2:1) + 2 Portrait (4:5) */}
        {contentLoading && gallery.length === 0 ? <CampaignSkeleton /> : <CampaignGallery gallery={gallery} />}

        {/* 5. Product Catalog: "Koleksi Hijab", 4 cols desktop / 2 cols mobile, 3:4 unboxed */}
        {productsLoading && products.length === 0 ? <ProductsSkeleton /> : <ProductCatalog
          products={products}
          onSelectProduct={(id) => onNavigate(`/produk/${id}`)}
          title="Koleksi Hijab"
          categories={categories}
        />}

        {/* 6. As Seen On: 9:16 portrait frames, muted inline video, ~70% mobile rail */}
        {contentLoading && reels.length === 0 ? <ReelsSkeleton /> : <AsSeenOn
          reels={reels}
          onCommunityLinkClick={() => onNavigate('/katalog')}
        />}
      </main>

      {/* 7. Compact Footer */}
      <Footer onNavigate={onNavigate} whatsappNumber={whatsappNumber} />

      {/* Cart Drawer */}
      <CartDrawer onNavigate={onNavigate} />
    </div>
  );
};

const SkeletonBlock=({className}:{className:string})=><div aria-hidden="true" className={`defra-skeleton bg-[#F3EBDF] ${className}`}/>;
const CategoriesSkeleton=()=> <section aria-label="Memuat kategori" className="w-full max-w-[1440px] mx-auto px-2 md:px-6 lg:px-12 my-10 md:my-16"><SkeletonBlock className="h-6 w-44 mx-auto mb-7"/><div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">{Array.from({length:4},(_,i)=><div key={i}><SkeletonBlock className="w-full aspect-[2/1]"/><SkeletonBlock className="h-3 w-20 mx-auto mt-2"/></div>)}</div></section>;
const CampaignSkeleton=()=> <section aria-label="Memuat galeri" className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 my-12 md:my-16"><SkeletonBlock className="w-full aspect-[2/1]"/><div className="grid grid-cols-2 gap-3 mt-3"><SkeletonBlock className="aspect-[4/5]"/><SkeletonBlock className="aspect-[4/5]"/></div></section>;
const ProductsSkeleton=()=> <section aria-label="Memuat produk" className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 my-12 md:my-16"><SkeletonBlock className="h-6 w-40 mx-auto mb-7"/><div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">{Array.from({length:4},(_,i)=><div key={i}><SkeletonBlock className="aspect-[3/4]"/><SkeletonBlock className="h-4 w-3/4 mx-auto mt-3"/><SkeletonBlock className="h-4 w-1/2 mx-auto mt-2"/></div>)}</div></section>;
const ReelsSkeleton=()=> <section aria-label="Memuat media komunitas" className="w-full max-w-[1440px] mx-auto px-[15px] md:px-6 lg:px-12 my-10 md:my-16"><SkeletonBlock className="h-6 w-32 mx-auto mb-7"/><div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">{Array.from({length:4},(_,i)=><SkeletonBlock key={i} className="aspect-[9/16]"/>)}</div></section>;
