import React, { useRef, useState } from 'react';
import { Heart } from 'lucide-react';
import type { Category, Product } from '../types/index.ts';
import { useCart } from '../context/CartContext.tsx';

interface ProductCatalogProps {
  products: Product[];
  onSelectProduct: (productId: string) => void;
  title?: string;
  categories?: Category[];
}
const EMPTY_CATEGORIES: Category[] = [];

export const ProductCatalog: React.FC<ProductCatalogProps> = ({
  products,
  onSelectProduct,
  title = 'Koleksi Hijab',
  categories = EMPTY_CATEGORIES
}) => {
  const [activeTab, setActiveTab] = useState('ALL');
  const gridMotionRef = useRef<HTMLDivElement>(null);
  const { isWishlisted, toggleWishlist } = useCart();

  let filtered = [...products];
  if (activeTab !== 'ALL') filtered = filtered.filter((product) => product.categoryId === activeTab);

  const visibleCategories = categories.filter((category) => category.isActive).slice(0, 4);
  React.useEffect(() => {
    if (activeTab !== 'ALL' && !visibleCategories.some((category) => category.id === activeTab)) setActiveTab('ALL');
  }, [activeTab, categories]);
  React.useEffect(() => {
    const grid = gridMotionRef.current;
    if (!grid) return;
    grid.classList.remove('motion-tab-enter');
    void grid.offsetWidth;
    grid.classList.add('motion-tab-enter');
  }, [activeTab]);

  return (
    <section data-reveal className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 my-12 md:my-16 lg:my-20">
      {/* Section Heading: "Koleksi Hijab" 24px/22px, weight 500, centered */}
      {title && <h2 className="text-[22px] md:text-[24px] font-medium text-[#282420] text-center mb-6 tracking-tight">
        {title}
      </h2>}

      {/* Clean interactive filter tabs within the catalog */}
      {categories.length > 0 && <div className="flex items-center justify-center gap-6 mb-8 text-sm font-medium border-b border-[#E8E2DC] pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('ALL')}
          className={`pb-2 transition-colors relative ${
            activeTab === 'ALL'
              ? 'text-[#282420] after:absolute after:bottom-[-13px] after:left-0 after:right-0 after:h-[2px] after:bg-[#282420]'
              : 'text-[#706861] hover:text-[#282420]'
          }`}
        >
          Semua Koleksi
        </button>
        {visibleCategories.map((category) => <button
          key={category.id}
          type="button"
          onClick={() => setActiveTab(category.id)}
          className={`pb-2 transition-colors relative ${activeTab === category.id
            ? 'text-[#282420] after:absolute after:bottom-[-13px] after:left-0 after:right-0 after:h-[2px] after:bg-[#282420]'
            : 'text-[#706861] hover:text-[#282420]'}`}
        >{category.name}</button>)}
      </div>}

      {/* Grid: Desktop 4 cols (16px H / 32px V gap), Tablet 3 cols, Mobile 2 cols (12px H / 24px V gap) */}
      <div ref={gridMotionRef} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 md:gap-x-4 gap-y-6 md:gap-y-8">
        {filtered.map((prod, index) => {
          const wish = isWishlisted(prod.id);
          const hasDiscount = Boolean(
            prod.discountPrice && prod.discountPrice > 0 && prod.discountPrice < prod.basePrice
          );
          const discountPercent = hasDiscount
            ? Math.floor(((prod.basePrice - prod.discountPrice!) / prod.basePrice) * 100)
            : 0;

          return (
            <div
              key={prod.id}
              className="group flex flex-col cursor-pointer"
              onClick={() => onSelectProduct(prod.id)}
            >
              {/* Product Photo: 3:4 ratio, 0px radius, no border, no shadow */}
              <div className="relative w-full aspect-[3/4] bg-[#F3EBDF] overflow-hidden rounded-none">
                <img
                  src={prod.imageUrl}
                  alt={prod.name}
                  loading={index === 0 ? 'eager' : 'lazy'}
                  fetchPriority={index === 0 ? 'high' : 'auto'}
                  decoding="async"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
                />

                {/* Badge Diskon Riil: Flush ke kiri (left-0), 16px dari atas (top-4), kiri siku, ujung kanan rounded, deep rose bronze #87533F */}
                {hasDiscount && (
                  <div
                    className="absolute top-4 left-0 h-7 px-2.5 bg-[#87533F] text-white text-xs font-semibold rounded-l-none rounded-r-full flex items-center justify-center shadow-sm select-none z-10"
                    aria-label={`Diskon ${discountPercent}%`}
                  >
                    -{discountPercent}%
                  </div>
                )}

                {/* Subtle wishlist outline control */}
                <button
                  type="button"
                  aria-label="Tambah ke favorit"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleWishlist(prod.id);
                  }}
                  className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-white/80 hover:bg-white text-[#282420] transition-colors rounded-none"
                >
                  <Heart
                    className={`w-4 h-4 ${wish ? 'fill-[#B88770] text-[#B88770]' : 'text-[#282420]'}`}
                    strokeWidth={1.5}
                  />
                </button>
              </div>

              {/* Product Info: Nama Centered, Harga Normal Muted/Coret, Harga Diskon dalam #87533F */}
              <div className="mt-3 flex flex-col text-center">
                {/* Product Name: Centered, sentence case, 2 lines reserved */}
                <h3 className="text-[13px] md:text-[14px] font-normal text-[#282420] text-center line-clamp-2 min-h-[38px] md:min-h-[42px] leading-snug group-hover:text-[#B88770] transition-colors">
                  {prod.name}
                </h3>

                {/* Harga: Jika diskon, harga normal coret lalu harga diskon dalam #87533F */}
                {hasDiscount ? (
                  <div className="mt-1 flex flex-col items-center">
                    <span className="text-[12px] text-[#706861] line-through">
                      Rp{prod.basePrice.toLocaleString('id-ID')}
                    </span>
                    <span className="text-[14px] font-medium text-[#87533F] mt-0.5">
                      Rp{prod.discountPrice!.toLocaleString('id-ID')}
                    </span>
                  </div>
                ) : (
                  <div className="mt-1 text-[14px] font-medium text-[#282420]">
                    Rp{prod.basePrice.toLocaleString('id-ID')}
                  </div>
                )}

                {/* Real Color Swatches (centered if variants exist) */}
                {prod.variants && prod.variants.length > 0 && (
                  <div className="mt-2 flex items-center justify-center gap-1.5 flex-wrap">
                    {prod.variants.slice(0, 4).map((v) => (
                      <span
                        key={v.id}
                        title={v.color}
                        className="w-3.5 h-3.5 rounded-full border border-[#E8E2DC]"
                        style={{ backgroundColor: v.colorHex || '#E5D3B3' }}
                      />
                    ))}
                    {prod.variants.length > 4 && (
                      <span className="text-[11px] text-[#706861]">+{prod.variants.length - 4}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
