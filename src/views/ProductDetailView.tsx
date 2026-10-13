import React, { useEffect, useState } from 'react';
import { Header } from '../components/Header.tsx';
import { Footer } from '../components/Footer.tsx';
import { CartDrawer } from '../components/CartDrawer.tsx';
import { Heart, Minus, Plus, ArrowLeft, Check, Truck } from 'lucide-react';
import type { Product, ProductVariant } from '../types/index.ts';
import { useCart } from '../context/CartContext.tsx';

interface ProductDetailViewProps {
  productId: string;
  onNavigate: (route: string) => void;
}

export const ProductDetailView: React.FC<ProductDetailViewProps> = ({ productId, onNavigate }) => {
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const { addToCart, isWishlisted, toggleWishlist } = useCart();

  useEffect(() => {
    setLoading(true);
    fetch(`/api/public/products/${productId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.product) {
          const p: Product = data.product;
          setProduct(p);

          // Default selected color
          const firstColor = p.colors?.[0]?.color || p.variants?.[0]?.color || '';
          setSelectedColor(firstColor);

          // Default selected size
          const availableSizesForColor = p.variants
            ?.filter((v) => v.color === firstColor && v.isActive)
            .map((v) => v.size) || [];
          const defaultSize = availableSizesForColor[0] || p.sizes?.[0] || p.variants?.[0]?.size || '';
          setSelectedSize(defaultSize);
          setActivePhotoIndex(0);
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [productId]);

  // Derive all distinct colors for this product
  const availableColors = React.useMemo(() => {
    if (!product) return [];
    if (product.colors && product.colors.length > 0) return product.colors;
    const map = new Map<string, { color: string; colorHex?: string }>();
    product.variants?.forEach((v) => {
      if (!map.has(v.color)) {
        map.set(v.color, { color: v.color, colorHex: v.colorHex });
      }
    });
    return Array.from(map.values());
  }, [product]);

  // Derive all distinct sizes for this product
  const allProductSizes = React.useMemo(() => {
    if (!product) return [];
    if (product.sizes && product.sizes.length > 0) return product.sizes;
    return Array.from(new Set(product.variants?.map((v) => v.size) || []));
  }, [product]);

  // Get active color gallery images. If the selected color has a dedicated gallery, use it!
  const currentGalleryImages = React.useMemo(() => {
    if (!product) return [];
    const colorGalleries = product.colorGalleries || [];
    const matchedGallery = colorGalleries.find(
      (cg) => cg.color.toLowerCase() === selectedColor.toLowerCase()
    );
    if (matchedGallery && matchedGallery.images && matchedGallery.images.length > 0) {
      return matchedGallery.images;
    }
    // Fallback: general product images or primary image
    if (product.images && product.images.length > 0) return product.images;
    return [product.imageUrl];
  }, [product, selectedColor]);

  // Find exact matching variant for the combination of selectedColor + selectedSize
  const selectedVariant = React.useMemo(() => {
    if (!product || !selectedColor || !selectedSize) return null;
    return (
      product.variants?.find(
        (v) =>
          v.color.toLowerCase() === selectedColor.toLowerCase() &&
          v.size.toLowerCase() === selectedSize.toLowerCase() &&
          v.isActive
      ) || null
    );
  }, [product, selectedColor, selectedSize]);

  // Check live stock for this combination
  const availableStock = selectedVariant?.availableStock ?? 0;
  const isCombinationOutOfStock = !selectedVariant || availableStock <= 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Header onNavigate={onNavigate} />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-[#706861]">Memuat informasi produk...</p>
        </div>
        <Footer onNavigate={onNavigate} />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Header onNavigate={onNavigate} />
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <h2 className="text-lg font-medium text-[#282420] mb-2">Produk Tidak Ditemukan</h2>
          <button
            type="button"
            onClick={() => onNavigate('/katalog')}
            className="px-5 py-2 bg-[#282420] text-white text-xs font-medium rounded-[4px]"
          >
            Kembali ke Katalog
          </button>
        </div>
        <Footer onNavigate={onNavigate} />
      </div>
    );
  }

  const isFav = isWishlisted(product.id);

  const hasDiscount = Boolean(
    product.discountPrice && product.discountPrice > 0 && product.discountPrice < product.basePrice
  );
  const discountPercent = hasDiscount
    ? Math.floor(((product.basePrice - product.discountPrice!) / product.basePrice) * 100)
    : 0;
  const effectivePrice = hasDiscount ? product.discountPrice! : product.basePrice;

  const currentDisplayPhoto = currentGalleryImages[activePhotoIndex] || currentGalleryImages[0] || product.imageUrl;

  const handleSelectColor = (colorName: string) => {
    setSelectedColor(colorName);
    setActivePhotoIndex(0); // Reset gallery photo to first image of that color
    setQuantity(1);
  };

  const handleAddToCart = () => {
    if (!selectedVariant || isCombinationOutOfStock) return;
    addToCart({
      productId: product.id,
      variantId: selectedVariant.id,
      productName: product.name,
      color: selectedVariant.color,
      size: selectedVariant.size,
      unitPrice: effectivePrice,
      weightGrams: product.weightGrams,
      imageUrl: currentDisplayPhoto,
      quantity
    });
  };

  return (
    <div className="min-h-screen bg-white text-[#282420] flex flex-col">
      <Header onNavigate={onNavigate} />

      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 py-6 md:py-10">
        {/* Back Link */}
        <button
          type="button"
          onClick={() => onNavigate('/katalog')}
          className="inline-flex items-center gap-1.5 text-xs text-[#706861] hover:text-[#282420] mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Katalog</span>
        </button>

        {/* 2-Column Product Detail Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-14 items-start">

          {/* SISI KIRI: Galeri Foto Khusus Warna Terpilih */}
          <div className="space-y-3">
            {/* Foto Utama Rasio 3:4, Unboxed */}
            <div className="relative w-full aspect-[3/4] bg-[#F3EBDF] overflow-hidden rounded-none shadow-xs">
              <img
                src={currentDisplayPhoto}
                alt={`${product.name} - ${selectedColor}`}
                className="w-full h-full object-cover transition-all duration-300"
              />

              {/* Badge Diskon Riil */}
              {hasDiscount && (
                <div
                  className="absolute top-4 left-0 h-7 px-3 bg-[#87533F] text-white text-xs font-semibold rounded-l-none rounded-r-full flex items-center justify-center shadow-sm select-none z-10"
                >
                  -{discountPercent}%
                </div>
              )}

              {/* Indicator current color tag */}
              <div className="absolute bottom-3 right-3 px-2.5 py-1 bg-black/60 backdrop-blur-xs text-white text-[11px] rounded-[4px] font-medium">
                Varian Warna: {selectedColor}
              </div>
            </div>

            {/* Thumbnail Carousel jika warna memiliki lebih dari 1 foto galeri */}
            {currentGalleryImages.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {currentGalleryImages.map((imgUrl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActivePhotoIndex(idx)}
                    className={`relative w-16 h-20 shrink-0 border-2 overflow-hidden transition-all ${activePhotoIndex === idx
                      ? 'border-[#282420] opacity-100'
                      : 'border-[#E8E2DC] opacity-60 hover:opacity-100'
                      }`}
                  >
                    <img src={imgUrl} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* SISI KANAN: Informasi & Modul Pembelian */}
          <div className="flex flex-col text-left">
            <span className="text-[13px] text-[#706861] font-medium uppercase tracking-wider">
              {product.categoryName || 'Koleksi Defra'}
            </span>
            <h1 className="text-[20px] md:text-[24px] font-medium text-[#282420] mt-1 tracking-tight leading-snug">
              {product.name}
            </h1>

            {/* Harga dengan dukungan coret jika diskon */}
            {hasDiscount ? (
              <div className="mt-2 flex items-baseline gap-2.5">
                <span className="text-[14px] text-[#706861] line-through">
                  Rp{product.basePrice.toLocaleString('id-ID')}
                </span>
                <span className="text-[18px] font-medium text-[#87533F]">
                  Rp{product.discountPrice!.toLocaleString('id-ID')}
                </span>
              </div>
            ) : (
              <div className="text-[18px] font-medium text-[#282420] mt-2">
                Rp{product.basePrice.toLocaleString('id-ID')}
              </div>
            )}

            <div className="h-px bg-[#E8E2DC] my-5" />

            {/* PEMILIHAN WARNA: Klik warna langsung ubah galeri foto ke foto warna tersebut */}
            {availableColors.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2.5 text-xs">
                  <span className="text-[#706861] font-medium">Pilih Warna:</span>
                  <span className="font-semibold text-[#282420]">{selectedColor}</span>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  {availableColors.map((c) => {
                    const isSelected = selectedColor.toLowerCase() === c.color.toLowerCase();
                    return (
                      <button
                        key={c.color}
                        type="button"
                        onClick={() => handleSelectColor(c.color)}
                        className={`group relative flex items-center gap-2 px-3 py-1.5 border rounded-[6px] text-xs transition-all ${isSelected
                          ? 'border-[#282420] bg-[#282420] text-white shadow-xs'
                          : 'border-[#E8E2DC] bg-white text-[#706861] hover:border-[#282420] hover:text-[#282420]'
                          }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0"
                          style={{ backgroundColor: c.colorHex || '#D4B996' }}
                        />
                        <span className="font-medium">{c.color}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PEMILIHAN UKURAN: Tampilkan label ukuran admin, misal "115 x 115 cm" */}
            {allProductSizes.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2.5 text-xs">
                  <span className="text-[#706861] font-medium">Pilih Ukuran:</span>
                  <span className="font-semibold text-[#282420]">{selectedSize || 'Pilih ukuran'}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {allProductSizes.map((sz) => {
                    const isSelected = selectedSize.toLowerCase() === sz.toLowerCase();
                    // Check stock for this specific size under currently selected color
                    const varForSz = product.variants?.find(
                      (v) =>
                        v.color.toLowerCase() === selectedColor.toLowerCase() &&
                        v.size.toLowerCase() === sz.toLowerCase() &&
                        v.isActive
                    );
                    const szStock = varForSz ? varForSz.availableStock : 0;
                    const isSzEmpty = szStock <= 0;

                    return (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => {
                          setSelectedSize(sz);
                          setQuantity(1);
                        }}
                        className={`px-3.5 py-2 border rounded-[6px] text-xs transition-all flex items-center gap-1.5 ${isSelected
                          ? 'border-[#282420] bg-white text-[#282420] font-semibold ring-1 ring-[#282420]'
                          : isSzEmpty
                            ? 'border-[#E8E2DC] bg-[#F3EBDF]/20 text-[#A39990] line-through cursor-pointer'
                            : 'border-[#E8E2DC] bg-white text-[#706861] hover:border-[#282420] hover:text-[#282420]'
                          }`}
                      >
                        <span>{sz}</span>
                        {isSzEmpty && <span className="text-[10px] text-red-600 no-underline">(Habis)</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Indikator Stok Live Kombinasi Warna - Ukuran */}
            <div className="mb-6 flex items-center gap-2 text-xs">
              {isCombinationOutOfStock ? (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-[6px] font-medium w-full flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-600 inline-block" />
                  <span>Stok habis untuk kombinasi warna {selectedColor} - ukuran {selectedSize}. Silakan pilih kombinasi lain.</span>
                </div>
              ) : (
                <span className="text-[#706861] flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    Stok Tersedia: <strong className="text-[#282420]">{availableStock} unit</strong> (Warna {selectedColor}, Ukuran {selectedSize})
                  </span>
                </span>
              )}
            </div>

            {/* Stepper Jumlah & Tombol Tambah ke Tas */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center border border-[#E8E2DC] rounded-[6px] h-11">
                <button
                  type="button"
                  disabled={quantity <= 1 || isCombinationOutOfStock}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-10 h-full flex items-center justify-center text-[#282420] disabled:opacity-30 hover:bg-[#F3EBDF]/40"
                  aria-label="Kurangi jumlah"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-10 text-center text-sm font-medium text-[#282420]">
                  {quantity}
                </span>
                <button
                  type="button"
                  disabled={quantity >= availableStock || isCombinationOutOfStock}
                  onClick={() => setQuantity((q) => Math.min(availableStock, q + 1))}
                  className="w-10 h-full flex items-center justify-center text-[#282420] disabled:opacity-30 hover:bg-[#F3EBDF]/40"
                  aria-label="Tambah jumlah"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                disabled={isCombinationOutOfStock}
                onClick={handleAddToCart}
                className="flex-1 h-11 bg-[#282420] text-white text-[14px] font-medium rounded-[6px] hover:bg-[#3d3834] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#282420]"
              >
                {isCombinationOutOfStock ? 'Kombinasi Stok Habis' : 'Tambah ke Tas Belanja'}
              </button>

              {/* Wishlist Button */}
              <button
                type="button"
                onClick={() => toggleWishlist(product.id)}
                className={`w-11 h-11 border border-[#E8E2DC] rounded-[6px] flex items-center justify-center transition-colors ${isFav ? 'text-red-600 bg-red-50 border-red-200' : 'text-[#706861] hover:text-[#282420]'
                  }`}
                aria-label="Simpan ke favorit"
              >
                <Heart className={`w-5 h-5 ${isFav ? 'fill-current' : ''}`} />
              </button>
            </div>

            {/* Berat kirim info terpisah untuk RajaOngkir */}
            <div className="text-[11px] text-[#706861] flex items-center gap-2 pt-2 border-t border-[#E8E2DC]/80">
              <Truck className="w-3.5 h-3.5 text-[#B88770]" />
              <span>Berat Produk: <strong>{product.weightGrams} gram / pcs</strong></span>
            </div>

            {/* Deskripsi Produk */}
            <div className="mt-6 pt-6 border-t border-[#E8E2DC]">
              <h3 className="text-xs font-semibold text-[#282420] uppercase tracking-wider mb-2">
                Deskripsi Produk
              </h3>
              <p className="text-xs text-[#706861] leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer onNavigate={onNavigate} />
      <CartDrawer onNavigate={onNavigate} />
    </div>
  );
};

