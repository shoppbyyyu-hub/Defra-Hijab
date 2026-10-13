import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { CartItem, Reservation, ShippingServiceOption } from '../types/index.ts';

export interface CheckoutFormData {
  customerName: string;
  customerEmail: string;
  customerWhatsapp: string;
  customerBirthDate: string;
  addressLine: string;
  province: string;
  city: string;
  subdistrict: string;
  postalCode: string;
}

export interface ReservationValidationResult {
  valid: boolean;
  code?: string;
  error?: string;
  reservation?: Reservation;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  removeFromCart: (variantId: string) => void;
  clearCart: () => void;
  subtotal: number;
  totalItems: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  // Wishlist (IDs stored in localStorage per specification)
  wishlist: string[];
  toggleWishlist: (productId: string) => void;
  isWishlisted: (productId: string) => boolean;
  // Active reservation session
  activeReservation: Reservation | null;
  setActiveReservation: (res: Reservation | null) => void;
  validateServerReservation: (reservationId?: string) => Promise<ReservationValidationResult>;
  // Stable session identifier for idempotency
  sessionToken: string;
  // In-Memory Checkout Form (Survives internal navigation without storing PII in storage)
  checkoutFormData: CheckoutFormData;
  setCheckoutFormData: React.Dispatch<React.SetStateAction<CheckoutFormData>>;
  checkoutDestination: any | null;
  setCheckoutDestination: (dest: any | null) => void;
  checkoutShipping: ShippingServiceOption | null;
  setCheckoutShipping: (shipping: ShippingServiceOption | null) => void;
  checkoutVoucher: { code: string; discountAmount: number } | null;
  setCheckoutVoucher: (voucher: { code: string; discountAmount: number } | null) => void;
  clearCheckoutForm: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const INITIAL_FORM_DATA: CheckoutFormData = {
  customerName: '',
  customerEmail: '',
  customerWhatsapp: '',
  customerBirthDate: '',
  addressLine: '',
  province: '',
  city: '',
  subdistrict: '',
  postalCode: ''
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Cart stored in localStorage per specification
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('defra_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Wishlist stored in localStorage per specification
  const [wishlist, setWishlist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('defra_wishlist');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);

  // Active reservation: loaded from sessionStorage as client hint, but MUST be validated against server
  const [activeReservation, setActiveReservation] = useState<Reservation | null>(() => {
    try {
      const saved = sessionStorage.getItem('defra_reservation');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (new Date(parsed.expiresAt) > new Date() && parsed.status === 'ACTIVE') {
          return parsed;
        }
      }
      return null;
    } catch {
      return null;
    }
  });

  // Stable session token for idempotency (UUID string only, zero PII)
  const [sessionToken] = useState<string>(() => {
    try {
      let token = sessionStorage.getItem('defra_session_id');
      if (!token) {
        token = 'sess-' + (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15));
        sessionStorage.setItem('defra_session_id', token);
      }
      return token;
    } catch {
      return 'sess-' + Date.now();
    }
  });

  // In-Memory Checkout Form Data (Persists across internal view navigations, zero PII in storage)
  const [checkoutFormData, setCheckoutFormData] = useState<CheckoutFormData>(INITIAL_FORM_DATA);
  const [checkoutDestination, setCheckoutDestination] = useState<any | null>(null);
  const [checkoutShipping, setCheckoutShipping] = useState<ShippingServiceOption | null>(null);
  const [checkoutVoucher, setCheckoutVoucher] = useState<{ code: string; discountAmount: number } | null>(null);

  // Sync cart to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('defra_cart', JSON.stringify(cart));
    } catch {}
  }, [cart]);

  // Sync wishlist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('defra_wishlist', JSON.stringify(wishlist));
    } catch {}
  }, [wishlist]);

  // Sync reservation hint to sessionStorage
  useEffect(() => {
    try {
      if (activeReservation) {
        sessionStorage.setItem('defra_reservation', JSON.stringify(activeReservation));
      } else {
        sessionStorage.removeItem('defra_reservation');
      }
    } catch {}
  }, [activeReservation]);

  // Validate active reservation against server authority
  const validateServerReservation = useCallback(
    async (reservationId?: string): Promise<ReservationValidationResult> => {
      const targetId = reservationId || activeReservation?.id;
      if (!targetId) {
        return { valid: false, code: 'NO_RESERVATION', error: 'Tidak ada data reservasi.' };
      }

      try {
        const res = await fetch(`/api/reservations/${targetId}`, {
          headers: { 'X-Reservation-Token': sessionToken }
        });
        const data = await res.json();

        if (res.ok && data.valid && data.reservation) {
          // Authoritative server state
          setActiveReservation(data.reservation);
          return { valid: true, reservation: data.reservation };
        } else {
          // Server declared reservation invalid/not found/expired/converted
          const code = data.code || (res.status === 404 ? 'RESERVATION_NOT_FOUND' : 'RESERVATION_INVALID');
          const error = data.error || 'Reservasi tidak ditemukan atau sudah tidak aktif di server.';
          
          // Clear activeReservation if it was invalid
          setActiveReservation(null);
          try {
            sessionStorage.removeItem('defra_reservation');
          } catch {}

          return { valid: false, code, error };
        }
      } catch (err: any) {
        return {
          valid: false,
          code: 'NETWORK_ERROR',
          error: 'Kendala jaringan saat memverifikasi reservasi ke server.'
        };
      }
    },
    [activeReservation?.id, sessionToken]
  );

  const addToCart = (newItem: CartItem) => {
    setCart((prev) => {
      const index = prev.findIndex((i) => i.variantId === newItem.variantId);
      if (index >= 0) {
        const updated = [...prev];
        updated[index].quantity += newItem.quantity;
        return updated;
      }
      return [...prev, newItem];
    });
    setIsCartOpen(true);
  };

  const updateQuantity = (variantId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(variantId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.variantId === variantId ? { ...item, quantity } : item))
    );
  };

  const removeFromCart = (variantId: string) => {
    setCart((prev) => prev.filter((item) => item.variantId !== variantId));
  };

  const clearCart = () => {
    setCart([]);
    try {
      localStorage.removeItem('defra_cart');
    } catch {}
  };

  const clearCheckoutForm = () => {
    setCheckoutFormData(INITIAL_FORM_DATA);
    setCheckoutDestination(null);
    setCheckoutShipping(null);
    setCheckoutVoucher(null);
  };

  const toggleWishlist = (productId: string) => {
    setWishlist((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const isWishlisted = (productId: string) => wishlist.includes(productId);

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        subtotal,
        totalItems,
        isCartOpen,
        setIsCartOpen,
        wishlist,
        toggleWishlist,
        isWishlisted,
        activeReservation,
        setActiveReservation,
        validateServerReservation,
        sessionToken,
        checkoutFormData,
        setCheckoutFormData,
        checkoutDestination,
        setCheckoutDestination,
        checkoutShipping,
        setCheckoutShipping,
        checkoutVoucher,
        setCheckoutVoucher,
        clearCheckoutForm
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
};
