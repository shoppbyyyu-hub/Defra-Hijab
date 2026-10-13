import React from 'react';
import { X, Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { useCart } from '../context/CartContext.tsx';

interface CartDrawerProps {
  onNavigate: (route: string) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ onNavigate }) => {
  const { cart, isCartOpen, setIsCartOpen, updateQuantity, removeFromCart, subtotal, totalItems } = useCart();

  if (!isCartOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end motion-overlay">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#282420]/30 transition-opacity"
        onClick={() => setIsCartOpen(false)}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 motion-drawer-right">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#E8E2DC]">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#282420]" strokeWidth={1.5} />
            <h3 className="text-[16px] font-medium text-[#282420]">
              Tas Belanja ({totalItems})
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setIsCartOpen(false)}
            className="w-10 h-10 -mr-2 flex items-center justify-center text-[#282420] hover:text-[#B88770]"
            aria-label="Tutup tas belanja"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {cart.length === 0 ? (
            <div className="py-16 text-center text-[#706861]">
              <p className="text-sm">Tas belanja Anda saat ini masih kosong.</p>
              <button
                type="button"
                onClick={() => {
                  setIsCartOpen(false);
                  onNavigate('/katalog');
                }}
                className="mt-4 px-6 py-2.5 bg-[#282420] text-white text-xs font-medium rounded-[4px] hover:bg-[#3d3834] transition-colors"
              >
                Jelajahi Koleksi
              </button>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.variantId}
                className="flex gap-4 py-4 border-b border-[#E8E2DC] last:border-b-0"
              >
                {/* 3:4 ratio thumbnail, 0px radius */}
                <div className="w-20 aspect-[3/4] bg-[#F3EBDF] shrink-0 overflow-hidden">
                  <img
                    src={item.imageUrl}
                    alt={item.productName}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 flex flex-col justify-between text-left">
                  <div>
                    <h4 className="text-[13px] font-normal text-[#282420] line-clamp-2">
                      {item.productName}
                    </h4>
                    <p className="text-[12px] text-[#706861] mt-0.5">
                      {item.color} &middot; {item.size}
                    </p>
                    <p className="text-[13px] font-medium text-[#282420] mt-1">
                      Rp{item.unitPrice.toLocaleString('id-ID')}
                    </p>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center border border-[#E8E2DC] rounded-[4px]">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                        className="w-7 h-7 flex items-center justify-center text-[#282420] hover:bg-[#F3EBDF]/50"
                        aria-label="Kurangi jumlah"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center text-xs font-medium text-[#282420]">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                        className="w-7 h-7 flex items-center justify-center text-[#282420] hover:bg-[#F3EBDF]/50"
                        aria-label="Tambah jumlah"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFromCart(item.variantId)}
                      className="text-[#706861] hover:text-red-700 p-1 transition-colors"
                      aria-label="Hapus dari tas belanja"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="p-6 border-t border-[#E8E2DC] bg-white">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-[#706861]">Subtotal</span>
              <span className="text-[16px] font-medium text-[#282420]">
                Rp{subtotal.toLocaleString('id-ID')}
              </span>
            </div>

            <p className="text-[11px] text-[#706861] mb-4">
              Ongkos kirim dan potongan voucher dihitung pada langkah checkout.
            </p>

            <button
              type="button"
              onClick={() => {
                setIsCartOpen(false);
                onNavigate('/checkout');
              }}
              className="w-full h-11 bg-[#282420] text-white text-[14px] font-medium rounded-[4px] hover:bg-[#3d3834] transition-colors flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#282420]"
            >
              Lanjut ke Pembayaran
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
