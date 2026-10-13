import React, { useState, useEffect, useRef } from 'react';
import { Header } from '../components/Header.tsx';
import { Footer } from '../components/Footer.tsx';
import { useCart } from '../context/CartContext.tsx';
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Upload,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  QrCode,
  Search
} from 'lucide-react';
import type { ShippingServiceOption, Reservation } from '../types/index.ts';
import { resolveCheckoutPaymentMethod } from '../utils/checkoutPayment.ts';

interface RajaOngkirDestination {
  id: number;
  label: string;
  subdistrict: string;
  district: string;
  city: string;
  province: string;
  postalCode: string;
}

interface CheckoutViewProps {
  onNavigate: (route: string) => void;
}

const ReservationCountdown: React.FC<{ expiresAt: string }> = ({ expiresAt }) => {
  const format = () => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Waktu Habis';
    const hours = Math.floor(diff / 3_600_000);
    const minutes = Math.floor((diff % 3_600_000) / 60_000);
    const seconds = Math.floor((diff % 60_000) / 1000);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };
  const [value, setValue] = useState(format);
  useEffect(() => {
    setValue(format());
    const timer = window.setInterval(() => setValue(format()), 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);
  return <div className="text-[10px] text-[#B88770] font-medium pt-0.5">Sisa Waktu Reservasi: <span className="font-mono">{value}</span></div>;
};

export const CheckoutView: React.FC<CheckoutViewProps> = ({ onNavigate }) => {
  const {
    cart,
    subtotal,
    clearCart,
    activeReservation,
    setActiveReservation,
    validateServerReservation,
    sessionToken,
    checkoutFormData: formData,
    setCheckoutFormData: setFormData,
    checkoutDestination: selectedDestination,
    setCheckoutDestination: setSelectedDestination,
    checkoutShipping: selectedShipping,
    setCheckoutShipping: setSelectedShipping,
    checkoutVoucher: appliedVoucher,
    setCheckoutVoucher: setAppliedVoucher
  } = useCart();

  // RajaOngkir Destination Search & Selection
  const [destinationSearchQuery, setDestinationSearchQuery] = useState(
    selectedDestination ? selectedDestination.label : ''
  );
  const [destinationResults, setDestinationResults] = useState<RajaOngkirDestination[]>([]);
  const [isSearchingDestination, setIsSearchingDestination] = useState(false);
  const [showDestinationDropdown, setShowDestinationDropdown] = useState(false);

  // Sync destination search query with selected destination if restored from provider
  useEffect(() => {
    if (selectedDestination && !destinationSearchQuery) {
      setDestinationSearchQuery(selectedDestination.label);
    }
  }, [selectedDestination]);

  // Shipping
  const [shippingOptions, setShippingOptions] = useState<ShippingServiceOption[]>([]);
  const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);
  const [shippingError, setShippingError] = useState('');
  const [shippingErrorCode, setShippingErrorCode] = useState('');
  const [serverCalculatedWeight, setServerCalculatedWeight] = useState<number | null>(null);

  // Voucher state
  const [voucherCodeInput, setVoucherCodeInput] = useState('');
  const [voucherError, setVoucherError] = useState('');
  const [isApplyingVoucher, setIsApplyingVoucher] = useState(false);
  const voucherMutationSeqRef = useRef(0);

  // Structured Reservation Recovery State
  const [reservationRecovery, setReservationRecovery] = useState<{
    code: string;
    message: string;
  } | null>(null);

  // In-flight reservation promise ref for request serialization & coalescing
  const inFlightReservationPromiseRef = useRef<Promise<Reservation | null> | null>(null);
  const activeReservationRef = useRef<Reservation | null>(activeReservation);

  useEffect(() => {
    activeReservationRef.current = activeReservation;
  }, [activeReservation]);

  // Payment method & Bank info
  const [storeSettings, setStoreSettings] = useState({
    qrisEnabled: true,
    bankTransferEnabled: true,
    bankName: 'BCA (Bank Central Asia)',
    bankAccountNumber: '8730291823',
    bankAccountHolder: 'DEFRA HIJAB OFFICIAL',
    whatsappNumber: '6281234567890'
  });

  // Upload proof & submission
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [copiedAccount, setCopiedAccount] = useState(false);

  // Dynamic QRIS Generator State
  const [qrisDataUrl, setQrisDataUrl] = useState<string>('');
  const qrisRequestVersionRef = useRef(0);
  const [isSyncingReservation, setIsSyncingReservation] = useState<boolean>(false);
  const [qrError, setQrError] = useState<string>('');
  const [isReservationExpired, setIsReservationExpired] = useState<boolean>(false);

  useEffect(() => () => {
    if (proofPreviewUrl) URL.revokeObjectURL(proofPreviewUrl);
  }, [proofPreviewUrl]);

  // Validate active reservation against server upon opening checkout
  useEffect(() => {
    if (activeReservation?.id) {
      validateServerReservation(activeReservation.id).then((result) => {
        if (!result.valid) {
          setReservationRecovery({
            code: result.code || 'RESERVATION_NOT_FOUND',
            message: result.error || 'Reservasi tidak ditemukan atau sudah tidak aktif di server.'
          });
          setQrisDataUrl('');
        }
      });
    }
  }, []);

  // Fetch settings on mount
  useEffect(() => {
    fetch('/api/public/bootstrap')
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          setStoreSettings((prev) => ({
            ...prev,
            ...data.settings
          }));
        }
      })
      .catch(() => { });
  }, []);

  // Calculate local estimate package weight (produk + 100g kemasan)
  const totalWeightGrams = cart.reduce((sum, item) => sum + (item.weightGrams || 150) * item.quantity, 0) + 100;

  // Search sequencing & abort controller to ignore stale/delayed responses
  const searchSeqRef = useRef(0);
  const searchAbortRef = useRef<AbortController | null>(null);

  // Debounced live search for valid RajaOngkir destinations (>= 3 chars, 700ms delay)
  useEffect(() => {
    const trimmed = (destinationSearchQuery || '').trim();
    if (trimmed.length < 3) {
      setDestinationResults([]);
      setIsSearchingDestination(false);
      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
      }
      return;
    }

    // Hindari re-fetch jika teks input sama dengan label destinasi yang sudah terpilih
    if (selectedDestination && trimmed.toLowerCase() === selectedDestination.label.trim().toLowerCase()) {
      setIsSearchingDestination(false);
      return;
    }

    setIsSearchingDestination(true);
    const timer = setTimeout(async () => {
      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
      }
      const controller = new AbortController();
      searchAbortRef.current = controller;
      const currentSeq = ++searchSeqRef.current;

      try {
        const res = await fetch(`/api/shipping/destinations?search=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal
        });
        const data = await res.json();
        // Ignore stale response if user has typed a newer search query
        if (currentSeq === searchSeqRef.current) {
          if (res.ok && Array.isArray(data.destinations)) {
            setDestinationResults(data.destinations);
            setShowDestinationDropdown(data.destinations.length > 0);
          } else {
            setDestinationResults([]);
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError' && currentSeq === searchSeqRef.current) {
          setDestinationResults([]);
        }
      } finally {
        if (currentSeq === searchSeqRef.current) {
          setIsSearchingDestination(false);
        }
      }
    }, 700);

    return () => {
      clearTimeout(timer);
    };
  }, [destinationSearchQuery, selectedDestination]);

  // Handler memilih destinasi resmi RajaOngkir
  const handleSelectDestination = (dest: RajaOngkirDestination) => {
    setSelectedDestination(dest);
    setDestinationSearchQuery(dest.label);
    setShowDestinationDropdown(false);
    setFormData((prev) => ({
      ...prev,
      province: dest.province,
      city: dest.city,
      subdistrict: dest.subdistrict || dest.district,
      postalCode: dest.postalCode || prev.postalCode
    }));
    // Saat destinasi berubah: batalkan pilihan tarif lama
    setSelectedShipping(null);
    setShippingOptions([]);
    setShippingError('');
    setShippingErrorCode('');
  };

  // Track last calculated parameters to avoid redundant network calls
  const lastCalculatedRef = useRef<{ destinationId: number | null; weightGrams: number | null }>({
    destinationId: null,
    weightGrams: null
  });

  // Calculate shipping strictly from live RajaOngkir API / server 15-min cache
  const handleCalculateShipping = async (targetDestId?: number, targetWeight?: number) => {
    const destId = targetDestId || selectedDestination?.id;
    const weight = targetWeight !== undefined ? targetWeight : totalWeightGrams;
    if (!destId || cart.length === 0) return;

    setIsCalculatingShipping(true);
    setShippingError('');
    setSelectedShipping(null);

    try {
      const res = await fetch('/api/shipping/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationId: destId,
          items: cart
        })
      });
      const data = await res.json();
      if (res.ok && data.services && data.services.length > 0) {
        setShippingOptions(data.services);
        setServerCalculatedWeight(data.calculatedWeightGrams || weight);
        // CRITICAL: Jangan otomatis memilih layanan. Pembeli harus memilih sendiri secara manual.
        setSelectedShipping(null);
        lastCalculatedRef.current = { destinationId: destId, weightGrams: weight };
      } else {
        setShippingOptions([]);
        setSelectedShipping(null);
        setShippingError(data.error || 'Gagal memuat tarif pengiriman dari RajaOngkir.');
        setShippingErrorCode(data.code || `HTTP_${res.status}`);
        lastCalculatedRef.current = { destinationId: null, weightGrams: null };
      }
    } catch {
      setShippingOptions([]);
      setSelectedShipping(null);
      setShippingError('Kendala jaringan saat menghubungi server pengiriman RajaOngkir.');
      setShippingErrorCode('NETWORK_ERROR');
      lastCalculatedRef.current = { destinationId: null, weightGrams: null };
    } finally {
      setIsCalculatingShipping(false);
    }
  };

  // Hanya hitung ongkir saat destinationId valid atau berat paket berubah
  // Perubahan nama, email, no WA, tanggal lahir, alamat jalan, voucher, atau metode bayar TIDAK memicu request!
  useEffect(() => {
    const destId = selectedDestination?.id;
    if (!destId || cart.length === 0) {
      if (shippingOptions.length > 0 || selectedShipping) {
        setSelectedShipping(null);
        setShippingOptions([]);
      }
      lastCalculatedRef.current = { destinationId: null, weightGrams: null };
      return;
    }

    // Jika kombinasi destinationId & berat sama persis dengan yang sudah dikalkulasi, jangan panggil ulang
    if (
      lastCalculatedRef.current.destinationId === destId &&
      lastCalculatedRef.current.weightGrams === totalWeightGrams &&
      shippingOptions.length > 0
    ) {
      return;
    }

    // Batalkan pilihan ongkir lama saat tujuan atau berat berubah
    setSelectedShipping(null);
    setShippingOptions([]);
    handleCalculateShipping(destId, totalWeightGrams);
  }, [selectedDestination?.id, totalWeightGrams, cart.length]);


  // Apply Voucher (Single active voucher per checkout. New voucher replaces old voucher)
  const handleApplyVoucher = async () => {
    const mutationSeq = ++voucherMutationSeqRef.current;
    const cleanCode = voucherCodeInput.trim().toUpperCase();
    if (!cleanCode) {
      setVoucherError('Silakan masukkan kode voucher.');
      return;
    }

    // Kode yang sama tidak boleh diterapkan dua kali
    if (appliedVoucher && appliedVoucher.code.toUpperCase() === cleanCode) {
      setVoucherError('Kode voucher ini sudah diterapkan pada pesanan Anda.');
      return;
    }

    setVoucherError('');
    setIsApplyingVoucher(true);

    try {
      const res = await fetch('/api/vouchers/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: cleanCode,
          subtotal,
          items: cart,
          currentVoucherCode: appliedVoucher?.code
        })
      });
      const data = await res.json();
      if (mutationSeq !== voucherMutationSeqRef.current) return;
      if (res.ok && data.valid) {
        const reservation = await syncReservationAndGenerateQR(data.code);
        if (reservation) {
          setVoucherCodeInput('');
          setVoucherError('');
        } else {
          setVoucherError('Voucher valid, tetapi total pesanan gagal disinkronkan. Voucher belum diterapkan.');
        }
      } else {
        setVoucherError(data.error || 'Voucher tidak valid.');
      }
    } catch {
      setVoucherError('Gagal memvalidasi voucher.');
    } finally {
      if (mutationSeq === voucherMutationSeqRef.current) setIsApplyingVoucher(false);
    }
  };

  // Remove applied voucher
  const handleRemoveVoucher = async () => {
    const mutationSeq = ++voucherMutationSeqRef.current;
    setVoucherError('');
    setIsApplyingVoucher(true);
    const reservation = await syncReservationAndGenerateQR(null);
    if (!reservation) {
      setVoucherError('Voucher belum dapat dihapus karena total pesanan gagal disinkronkan.');
    }
    if (mutationSeq === voucherMutationSeqRef.current) setIsApplyingVoucher(false);
  };

  const discountAmount = activeReservation?.discountAmount ?? appliedVoucher?.discountAmount ?? 0;
  const serverSubtotal = activeReservation?.subtotal ?? subtotal;
  const shippingFee = activeReservation?.shippingFee ?? selectedShipping?.cost ?? 0;
  const totalAmount = activeReservation?.totalAmount ?? Math.max(0, serverSubtotal - discountAmount + shippingFee);

  // Determine active payment method based on rules:
  // If QRIS & Transfer both active: total < Rp2.000.000 -> QRIS; >= Rp2.000.000 -> Transfer
  const activeMethod = resolveCheckoutPaymentMethod(
    totalAmount,
    storeSettings.qrisEnabled,
    storeSettings.bankTransferEnabled
  );

  // Handle Proof File selection with 2MB limit (2,000,000 bytes)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2000000) {
      setSubmitError('Ukuran file bukti pembayaran melebihi batas 2MB (2.000.000 bytes).');
      return;
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setSubmitError('Format file harus berupa JPG, PNG, atau WebP.');
      return;
    }

    setSubmitError('');
    setProofFile(file);
    setProofPreviewUrl(URL.createObjectURL(file));
  };

  // Countdown Timer & Expiration Watcher for Reservation
  useEffect(() => {
    if (!activeReservation?.expiresAt) {
      setIsReservationExpired(false);
      return;
    }
    const remaining = new Date(activeReservation.expiresAt).getTime() - Date.now();
    if (remaining <= 0) {
      setIsReservationExpired(true);
      return;
    }
    setIsReservationExpired(false);
    const timeout = window.setTimeout(() => setIsReservationExpired(true), remaining);
    return () => window.clearTimeout(timeout);
  }, [activeReservation?.expiresAt]);

  // Create or Update 24-hour Reservation with server-validated shipping rate (Serialized & Idempotent)
  const ensureReservation = async (forceNew: boolean = false, voucherOverride?: string | null): Promise<Reservation | null> => {
    if (!selectedShipping || !selectedDestination || cart.length === 0) return null;
    const previousRequest = inFlightReservationPromiseRef.current;
    const requestedVoucher = voucherOverride === undefined ? appliedVoucher?.code : voucherOverride || undefined;
    let execution!: Promise<Reservation | null>;
    execution = (async () => {
      if (previousRequest) await previousRequest.catch(() => null);
      try {
        const currentReservation = activeReservationRef.current;
        if (currentReservation && !forceNew) {
          // Update existing reservation keeping original expiry!
          const res = await fetch(`/api/reservations/${currentReservation.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-Reservation-Token': sessionToken },
            body: JSON.stringify({
              items: cart,
              destinationId: selectedDestination.id,
              voucherCode: requestedVoucher,
              shippingService: selectedShipping.service,
              shippingFee: selectedShipping.cost
            })
          });
          const data = await res.json();
          if (res.ok && data.reservation) {
            activeReservationRef.current = data.reservation;
            setActiveReservation(data.reservation);
            setReservationRecovery(null);
            return data.reservation;
          } else {
            // Check if failure is due to reservation missing/expired/converted
            if (
              data.code === 'RESERVATION_NOT_FOUND' ||
              data.code === 'RESERVATION_EXPIRED' ||
              data.code === 'RESERVATION_CONVERTED' ||
              data.code === 'RESERVATION_CANCELLED' ||
              data.code === 'SHIPPING_ORIGIN_CHANGED' ||
              res.status === 404
            ) {
              setActiveReservation(null);
              setReservationRecovery({
                code: data.code || 'RESERVATION_NOT_FOUND',
                message: data.error || 'Reservasi tidak ditemukan atau sudah tidak aktif di server.'
              });
              setQrisDataUrl('');
            } else {
              setSubmitError(data.error || 'Gagal memperbarui reservasi.');
            }
            return null;
          }
        }

        // Create new reservation using stable sessionToken for server idempotency
        const res = await fetch('/api/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionToken,
            items: cart,
            destinationId: selectedDestination.id,
            voucherCode: requestedVoucher,
            shippingService: selectedShipping.service,
            shippingFee: selectedShipping.cost
          })
        });
        const data = await res.json();
        if (res.ok && data.reservation) {
          activeReservationRef.current = data.reservation;
          setActiveReservation(data.reservation);
          setReservationRecovery(null);
          return data.reservation;
        } else {
          setSubmitError(data.error || 'Gagal membuat reservasi.');
          return null;
        }
      } catch {
        setSubmitError('Terjadi kesalahan jaringan saat reservasi.');
        return null;
      } finally {
        if (inFlightReservationPromiseRef.current === execution) {
          inFlightReservationPromiseRef.current = null;
        }
      }
    })();

    inFlightReservationPromiseRef.current = execution;
    return execution;
  };

  const handleCreateFreshReservation = async () => {
    setReservationRecovery(null);
    setSubmitError('');
    setActiveReservation(null);
    await ensureReservation(true);
    if (activeMethod === 'QRIS') {
      await syncReservationAndGenerateQR();
    }
  };

  // Synchronize reservation with server & generate dynamic QRIS
  const syncReservationAndGenerateQR = async (voucherOverride?: string | null): Promise<Reservation | null> => {
    const requestVersion = ++qrisRequestVersionRef.current;
    if (!selectedShipping || cart.length === 0) {
      setQrisDataUrl('');
      return null;
    }

    setIsSyncingReservation(true);
    setQrError('');
    setQrisDataUrl(''); // Sembunyikan QR lama saat sinkronisasi dimulai atau total berubah

    try {
      const reservation = await ensureReservation(false, voucherOverride);
      if (!reservation) {
        setQrError('Gagal menyinkronkan data reservasi pesanan dengan server.');
        setQrisDataUrl('');
        return null;
      }

      // Check if reservation is expired
      if (reservation.status === 'EXPIRED' || new Date(reservation.expiresAt).getTime() <= Date.now()) {
        setIsReservationExpired(true);
        setQrisDataUrl('');
        return null;
      }

      // Server-validated total amount (subtotal - diskon + ongkir)
      const serverTotal = reservation.totalAmount;
      if (!serverTotal || serverTotal <= 0) {
        setQrError('Total nominal transaksi dari server tidak valid.');
        setQrisDataUrl('');
        return null;
      }

      const nextVoucher = reservation.voucherCode
        ? { code: reservation.voucherCode, discountAmount: reservation.discountAmount }
        : null;
      setAppliedVoucher(nextVoucher);

      const serverMethod = resolveCheckoutPaymentMethod(
        serverTotal,
        storeSettings.qrisEnabled,
        storeSettings.bankTransferEnabled
      );
      if (serverMethod !== 'QRIS') {
        setQrisDataUrl('');
        return reservation;
      }

      const qrResponse = await fetch('/api/payments/qris', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Reservation-Token': sessionToken },
        body: JSON.stringify({ reservationId: reservation.id })
      });
      const qrData = await qrResponse.json();
      if (requestVersion !== qrisRequestVersionRef.current) return null;
      if (!qrResponse.ok || qrData.reservationId !== reservation.id || Number(qrData.totalAmount) !== serverTotal) {
        throw new Error(qrData.error || 'Nominal QRIS tidak sesuai reservasi terbaru.');
      }
      setQrisDataUrl(qrData.dataUrl);
      setQrError('');
      return reservation;
    } catch (err: any) {
      if (requestVersion !== qrisRequestVersionRef.current) return null;
      console.error('Error generating dynamic QRIS:', err);
      setQrError('Gagal memuat QRIS pembayaran dari server. Silakan klik tombol Coba Lagi.');
      setQrisDataUrl('');
      return null;
    } finally {
      if (requestVersion === qrisRequestVersionRef.current) setIsSyncingReservation(false);
    }
  };

  // Re-generate QRIS whenever server-validated total changes (cart, voucher, shipping)
  useEffect(() => {
    if (activeMethod === 'QRIS' && selectedShipping && cart.length > 0) {
      syncReservationAndGenerateQR();
    }
  }, [
    activeMethod,
    selectedShipping?.service,
    selectedShipping?.cost,
    appliedVoucher?.code,
    appliedVoucher?.discountAmount,
    subtotal,
    cart
  ]);

  // Finalize order submission
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    // Wait for in-flight synchronization to complete
    if (isSyncingReservation) {
      setSubmitError('Sedang menyinkronkan data reservasi dengan server. Harap tunggu sebentar lalu coba lagi.');
      return;
    }

    if (reservationRecovery) {
      setSubmitError(`Sesi reservasi Anda bermasalah (${reservationRecovery.message}). Silakan klik "Buat Reservasi Baru" atau hubungi owner via WhatsApp.`);
      return;
    }

    // Validation
    if (
      !formData.customerName.trim() ||
      !formData.customerEmail.trim() ||
      !formData.customerWhatsapp.trim() ||
      !formData.customerBirthDate ||
      !formData.addressLine.trim() ||
      !selectedDestination ||
      !formData.city.trim() ||
      !formData.postalCode.trim()
    ) {
      setSubmitError('Semua kolom data diri, alamat lengkap, dan wilayah tujuan resmi RajaOngkir wajib diisi.');
      return;
    }

    // Verify birth date is not in future
    if (new Date(formData.customerBirthDate) >= new Date()) {
      setSubmitError('Tanggal lahir harus tanggal valid di masa lalu.');
      return;
    }

    if (!selectedShipping) {
      setSubmitError('Silakan pilih salah satu opsi layanan pengiriman.');
      return;
    }

    if (!proofFile) {
      setSubmitError('Bukti transfer / pembayaran wajib diunggah sebelum finalisasi pesanan.');
      return;
    }

    if (isReservationExpired) {
      setSubmitError('Waktu reservasi di website telah habis. Silakan buat reservasi baru.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Lock/Update 24h Reservation
      const reservation = await ensureReservation();
      if (!reservation) {
        setIsSubmitting(false);
        return;
      }

      // 2. Prepare FormData for file upload & atomic finalization
      const payload = new FormData();
      payload.append('reservationId', reservation.id);
      payload.append('sessionToken', sessionToken);
      payload.append('customerName', formData.customerName);
      payload.append('customerEmail', formData.customerEmail);
      payload.append('customerWhatsapp', formData.customerWhatsapp);
      payload.append('customerBirthDate', formData.customerBirthDate);
      payload.append('addressLine', formData.addressLine);
      payload.append('province', formData.province);
      payload.append('city', formData.city);
      payload.append('subdistrict', formData.subdistrict);
      payload.append('postalCode', formData.postalCode);
      const finalPaymentMethod = resolveCheckoutPaymentMethod(
        reservation.totalAmount,
        storeSettings.qrisEnabled,
        storeSettings.bankTransferEnabled
      );
      if (finalPaymentMethod === 'NONE' || (finalPaymentMethod === 'QRIS' && !qrisDataUrl)) {
        setSubmitError('Metode pembayaran belum sesuai dengan total reservasi terbaru. Silakan tunggu sinkronisasi selesai.');
        setIsSubmitting(false);
        return;
      }
      payload.append('paymentMethod', finalPaymentMethod);
      payload.append('paymentProof', proofFile);

      const res = await fetch('/api/orders/finalize', {
        method: 'POST',
        body: payload
      });

      const data = await res.json();
      if (!res.ok || !data.orderNumber) {
        setSubmitError(data.error || 'Gagal menyimpan pesanan.');
        setIsSubmitting(false);
        return;
      }

      // Success: clear cart and open WhatsApp
      clearCart();
      setActiveReservation(null);

      // Open WhatsApp draft if draft text available
      if (data.whatsappDraftText && data.whatsappNumber) {
        const encoded = encodeURIComponent(data.whatsappDraftText);
        const waUrl = `https://wa.me/${data.whatsappNumber}?text=${encoded}`;
        window.open(waUrl, '_blank', 'noopener,noreferrer');
      }

      onNavigate(`/pesanan/${data.orderNumber}`);
    } catch {
      setSubmitError('Terjadi kesalahan teknis saat memproses pesanan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyAccountNumber = () => {
    navigator.clipboard.writeText(storeSettings.bankAccountNumber);
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2000);
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Header onNavigate={onNavigate} />
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <p className="text-base text-[#706861] mb-4">Tas belanja Anda kosong.</p>
          <button
            type="button"
            onClick={() => onNavigate('/katalog')}
            className="px-6 py-2.5 bg-[#282420] text-white text-xs font-medium rounded-[4px]"
          >
            Mulai Belanja
          </button>
        </div>
        <Footer onNavigate={onNavigate} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-[#282420] flex flex-col">
      <Header onNavigate={onNavigate} />

      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 py-8 md:py-12">
        <button
          type="button"
          onClick={() => onNavigate('/katalog')}
          className="inline-flex items-center gap-1.5 text-xs text-[#706861] hover:text-[#282420] mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Belanja</span>
        </button>

        <h1 className="text-[24px] md:text-[28px] font-medium text-[#282420] tracking-tight mb-8">
          Checkout Pembelian
        </h1>

        {reservationRecovery && (
          <div className="mb-8 p-5 bg-[#FFF9F5] border-2 border-[#E5A88B] rounded-[8px] space-y-4 text-left">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-[#A6532B] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="font-semibold text-sm text-[#282420]">
                  {reservationRecovery.code === 'RESERVATION_NOT_FOUND'
                    ? 'Sesi Reservasi Baru Dibutuhkan'
                    : reservationRecovery.code === 'RESERVATION_EXPIRED'
                      ? 'Batas Waktu 24 Jam Berakhir'
                      : reservationRecovery.code === 'RESERVATION_CONVERTED'
                        ? 'Reservasi Sudah Menjadi Pesanan'
                        : 'Kendala Status Reservasi'}
                </h3>
                <p className="text-xs text-[#706861] leading-relaxed">
                  {reservationRecovery.message}
                </p>
                <div className="p-3 bg-white/80 border border-[#F2D7C9] rounded-[4px] mt-2">
                  <p className="text-xs font-medium text-[#A6532B]">
                    ⚠️ Penting: Jika Anda sudah melakukan pembayaran / scan QRIS sebelumnya, jangan bayar ulang. Silakan hubungi owner melalui WhatsApp untuk konfirmasi dengan menyertakan bukti transfer. Data keranjang dan formulir Anda tetap kami simpan utuh.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#F2D7C9]">
              <a
                href={`https://wa.me/${storeSettings.whatsappNumber}?text=${encodeURIComponent(
                  `Halo Defra Hijab, saya ingin konfirmasi pembayaran untuk checkout atas nama ${formData.customerName || 'Pembeli'}.\nTotal: Rp${totalAmount.toLocaleString('id-ID')}\nAlamat: ${formData.city || '-'}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-[#25D366] hover:bg-[#1EBE5D] text-white text-xs font-semibold rounded-[4px] inline-flex items-center gap-2 transition-colors"
              >
                <span>Hubungi Owner via WhatsApp</span>
              </a>
              <button
                type="button"
                onClick={() => handleCreateFreshReservation()}
                className="px-4 py-2 bg-[#282420] hover:bg-[#3d3834] text-white text-xs font-semibold rounded-[4px] inline-flex items-center gap-2 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Buat Reservasi Baru (Formulir & Keranjang Tetap Utuh)</span>
              </button>
            </div>
          </div>
        )}

        {submitError && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-[4px] flex items-start gap-3 text-sm text-red-800">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-700 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}

        <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">

          {/* SISI KIRI (Col 1-7): Formulir Data Diri, Pengiriman, dan Bukti */}
          <div className="lg:col-span-7 space-y-8 text-left">

            {/* Bagian 1: Data Diri Pelanggan */}
            <div>
              <h2 className="text-[16px] font-medium text-[#282420] mb-4 pb-2 border-b border-[#E8E2DC]">
                1. Data Penerima
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#282420] mb-1.5">
                    Nama Lengkap <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Siti Nurhaliza"
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    className="w-full h-11 px-3 bg-white border border-[#E8E2DC] rounded-[4px] text-sm text-[#282420] focus:outline-none focus:border-[#282420]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#282420] mb-1.5">
                      Email Aktif <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="nama@email.com"
                      value={formData.customerEmail}
                      onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
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
                      placeholder="Contoh: 081234567890"
                      value={formData.customerWhatsapp}
                      onChange={(e) => setFormData({ ...formData, customerWhatsapp: e.target.value })}
                      className="w-full h-11 px-3 bg-white border border-[#E8E2DC] rounded-[4px] text-sm text-[#282420] focus:outline-none focus:border-[#282420]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#282420] mb-1.5">
                    Tanggal Lahir Lengkap <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    max={new Date().toISOString().split('T')[0]}
                    value={formData.customerBirthDate}
                    onChange={(e) => setFormData({ ...formData, customerBirthDate: e.target.value })}
                    className="w-full h-11 px-3 bg-white border border-[#E8E2DC] rounded-[4px] text-sm text-[#282420] focus:outline-none focus:border-[#282420]"
                  />
                  <p className="mt-1 text-[11px] text-[#706861]">
                    Wajib diisi untuk verifikasi identitas dan keamanan status pesanan tanpa akun.
                  </p>
                </div>
              </div>
            </div>

            {/* Bagian 2: Alamat Pengiriman */}
            <div>
              <h2 className="text-[16px] font-medium text-[#282420] mb-4 pb-2 border-b border-[#E8E2DC]">
                2. Alamat Pengiriman
              </h2>
              <div className="space-y-4">
                {/* Alamat Jalan Lengkap */}
                <div>
                  <label className="block text-xs font-medium text-[#282420] mb-1.5">
                    Alamat Lengkap / Nama Jalan &amp; No. Rumah, RT/RW <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Contoh: Jl. Senopati No. 88, RT 02 / RW 03, Patokan depan minimarket"
                    value={formData.addressLine}
                    onChange={(e) => setFormData({ ...formData, addressLine: e.target.value })}
                    className="w-full p-3 bg-white border border-[#E8E2DC] rounded-[4px] text-sm text-[#282420] focus:outline-none focus:border-[#282420]"
                  />
                  <p className="mt-1 text-[11px] text-[#706861]">

                  </p>
                </div>

                {/* Pencarian Destinasi Wilayah Resmi RajaOngkir */}
                <div className="relative">
                  <label className="block text-xs font-medium text-[#282420] mb-1.5">
                    Cari Kecamatan / Kota Tujuan (RajaOngkir) <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="(misal: Kebayoran Baru, Coblong, Denpasar)..."
                      value={destinationSearchQuery}
                      onChange={(e) => {
                        setDestinationSearchQuery(e.target.value);
                        if (selectedDestination && e.target.value !== selectedDestination.label) {
                          setSelectedDestination(null);
                          setSelectedShipping(null);
                          setShippingOptions([]);
                        }
                      }}
                      onFocus={() => {
                        if (destinationResults.length > 0) setShowDestinationDropdown(true);
                      }}
                      className="w-full h-11 pl-9 pr-10 bg-white border border-[#E8E2DC] rounded-[4px] text-sm text-[#282420] focus:outline-none focus:border-[#282420]"
                    />
                    <Search className="w-4 h-4 text-[#706861] absolute left-3 top-3.5" />
                    {isSearchingDestination && (
                      <RefreshCw className="w-4 h-4 text-[#706861] absolute right-3 top-3.5 animate-spin" />
                    )}
                  </div>

                  {/* Dropdown Hasil Pencarian Wilayah */}
                  {showDestinationDropdown && destinationResults.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-[#E8E2DC] rounded-[4px] shadow-lg max-h-56 overflow-y-auto motion-dropdown">
                      {destinationResults.map((dest) => (
                        <div
                          key={dest.id}
                          onClick={() => handleSelectDestination(dest)}
                          className="px-3.5 py-2.5 hover:bg-[#F3EBDF]/30 cursor-pointer border-b border-[#F0EBE6] last:border-b-0 text-left transition-colors"
                        >
                          <p className="text-xs font-medium text-[#282420]">{dest.label}</p>
                          <p className="text-[11px] text-[#706861] mt-0.5">
                            ID Wilayah: {dest.id} &middot; {dest.district ? `${dest.district}, ` : ''}{dest.city}, {dest.province} {dest.postalCode ? `(${dest.postalCode})` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedDestination ? (
                    <div className="">
                      <div className="">

                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDestination(null);
                          setDestinationSearchQuery('');
                          setSelectedShipping(null);
                          setShippingOptions([]);
                        }}
                        className="text-[11px] text-red-600 hover:text-red-800 font-medium ml-2 underline"
                      >
                        Ganti
                      </button>
                    </div>
                  ) : (
                    <p className="mt-1 text-[11px] text-[#706861]">

                    </p>
                  )}
                </div>

                {/* Kolom Informasi Wilayah Otomatis */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-[#282420] mb-1.5">
                      Kota / Kabupaten <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Terisi otomatis setelah memilih tujuan"
                      value={formData.city}
                      readOnly={Boolean(selectedDestination)}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className={`w-full h-11 px-3 border border-[#E8E2DC] rounded-[4px] text-sm text-[#282420] ${selectedDestination ? 'bg-[#F9F7F5]' : 'bg-white'
                        }`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#282420] mb-1.5">
                      Kecamatan <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Terisi otomatis setelah memilih tujuan"
                      value={formData.subdistrict}
                      readOnly={Boolean(selectedDestination)}
                      onChange={(e) => setFormData({ ...formData, subdistrict: e.target.value })}
                      className={`w-full h-11 px-3 border border-[#E8E2DC] rounded-[4px] text-sm text-[#282420] ${selectedDestination ? 'bg-[#F9F7F5]' : 'bg-white'
                        }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#282420] mb-1.5">
                      Provinsi <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Terisi otomatis setelah memilih tujuan"
                      value={formData.province}
                      readOnly={Boolean(selectedDestination)}
                      onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                      className={`w-full h-11 px-3 border border-[#E8E2DC] rounded-[4px] text-sm text-[#282420] ${selectedDestination ? 'bg-[#F9F7F5]' : 'bg-white'
                        }`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#282420] mb-1.5">
                      Kode Pos <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: 12180"
                      value={formData.postalCode}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                      className="w-full h-11 px-3 bg-white border border-[#E8E2DC] rounded-[4px] text-sm text-[#282420] focus:outline-none focus:border-[#282420]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Bagian 3: Pilih Layanan Pengiriman */}
            <div>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#E8E2DC]">
                <h2 className="text-[16px] font-medium text-[#282420]">
                  3. Layanan Pengiriman
                </h2>
                <span className="text-xs text-[#706861]">
                  Berat Paket: {serverCalculatedWeight || totalWeightGrams} gram (produk + kemasan)
                </span>
              </div>

              {/* Status Alamat Belum Lengkap */}
              {(!selectedDestination || !formData.addressLine.trim() || formData.addressLine.trim().length < 5) ? (
                <div className="p-4 bg-[#F9F7F5] border border-[#E8E2DC] rounded-[4px] text-center text-xs text-[#706861] space-y-1">
                  <p className="font-medium text-[#282420]">Alamat Belum Lengkap</p>
                  <p>
                    Lengkapi alamat jalan dan pilih wilayah tujuan di atas untuk menampilkan tarif resmi.
                  </p>
                </div>
              ) : isCalculatingShipping ? (
                <div className="p-6 border border-[#E8E2DC] rounded-[4px] text-center space-y-2">
                  <RefreshCw className="w-5 h-5 text-[#282420] animate-spin mx-auto" />
                  <p className="text-xs text-[#706861]">Mengambil tarif resmi JNE dari server RajaOngkir...</p>
                </div>
              ) : shippingError ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-[4px] space-y-3 text-left">
                  <div className="flex items-start gap-2.5 text-xs text-red-800">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">
                        {shippingErrorCode === 'QUOTA_EXCEEDED' ? 'Tidak bisa menghubungi ekspedisi, mohon hubungi admin'
                          : shippingErrorCode === 'AUTHENTICATION_FAILED' ? 'Konfigurasi Ekspedisi Ditolak'
                            : shippingErrorCode === 'INVALID_LOCATION' ? 'Wilayah Pengiriman Tidak Valid'
                              : shippingErrorCode === 'NO_SUPPORTED_SERVICE' ? 'Layanan JNE yang Didukung Tidak Tersedia'
                                : shippingErrorCode === 'NETWORK_ERROR' ? 'Koneksi Pengiriman Bermasalah'
                                  : 'Gagal Mengambil Tarif dari Server'}
                      </p>
                      <p className="text-[11px] mt-0.5 text-red-700">{shippingError}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCalculateShipping()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#282420] hover:bg-[#3d3834] text-white text-xs font-medium rounded-[4px] transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Coba Lagi Cek Ongkir</span>
                  </button>
                </div>
              ) : shippingOptions.length === 0 ? (
                <div className="p-4 bg-[#F9F7F5] border border-[#E8E2DC] rounded-[4px] text-center text-xs text-[#706861] space-y-2">
                  <p>Tidak ada opsi layanan JNE yang ditemukan untuk tujuan ini.</p>
                  <button
                    type="button"
                    onClick={() => handleCalculateShipping()}
                    className="px-3 py-1 bg-[#282420] text-white text-xs rounded-[4px]"
                  >
                    Coba Lagi
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-[#706861]">
                    Silakan pilih layanan pengiriman yang Anda inginkan:
                  </p>
                  {shippingOptions.map((opt) => {
                    const isSelected = selectedShipping?.service === opt.service;
                    return (
                      <div
                        key={opt.service}
                        onClick={() => setSelectedShipping(opt)}
                        className={`p-4 border rounded-[4px] cursor-pointer flex items-center justify-between transition-colors ${isSelected
                          ? 'border-[#282420] bg-[#F3EBDF]/30 ring-1 ring-[#282420]'
                          : 'border-[#E8E2DC] hover:border-[#706861]'
                          }`}
                      >
                        <div>
                          <p className="text-sm font-medium text-[#282420]">{opt.service}</p>
                          <p className="text-xs text-[#706861]">
                            {opt.description} &middot; Estimasi {opt.etd}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-[#282420]">
                            Rp{opt.cost.toLocaleString('id-ID')}
                          </p>
                          {isSelected ? (
                            <span className="text-[11px] text-[#B88770] font-medium flex items-center gap-1 justify-end mt-1">
                              <Check className="w-3 h-3" /> Terpilih
                            </span>
                          ) : (
                            <span className="text-[11px] text-[#706861] hover:underline mt-1 block">
                              Klik untuk Pilih
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* SISI KANAN (Col 8-12): Ringkasan Belanja, Instruksi Bayar, Tombol */}
          <div className="lg:col-span-5 text-left">
            <div className="border border-[#E8E2DC] rounded-[4px] p-6 bg-white">
              <h3 className="text-[16px] font-medium text-[#282420] mb-4 pb-2 border-b border-[#E8E2DC]">
                4. Ringkasan &amp; Pembayaran
              </h3>

              {/* Daftar Item Singkat */}
              <div className="space-y-3 mb-6 max-h-60 overflow-y-auto no-scrollbar">
                {cart.map((item) => (
                  <div key={item.variantId} className="flex items-center justify-between text-xs">
                    <div className="flex-1 pr-2">
                      <p className="font-medium text-[#282420] truncate">{item.productName}</p>
                      <p className="text-[#706861]">
                        {item.color} &middot; x{item.quantity}
                      </p>
                    </div>
                    <span className="font-medium text-[#282420]">
                      Rp{(item.unitPrice * item.quantity).toLocaleString('id-ID')}
                    </span>
                  </div>
                ))}
              </div>

              {/* Voucher Input */}
              <div className="mb-6 pt-4 border-t border-[#E8E2DC]">
                <label className="block text-xs font-medium text-[#282420] mb-1.5">
                  Gunakan Voucher Promo
                </label>
                <div className="grid grid-cols-[minmax(0,1fr)_104px] sm:grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <input
                    type="text"
                    placeholder="Kode promo"
                    value={voucherCodeInput}
                    onChange={(e) => setVoucherCodeInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleApplyVoucher();
                      }
                    }}
                    className="min-w-0 w-full h-10 px-3 bg-white border border-[#E8E2DC] rounded-[4px] text-xs text-[#282420] uppercase focus:outline-none focus:border-[#282420]"
                  />
                  <button
                    type="button"
                    onClick={handleApplyVoucher}
                    disabled={isApplyingVoucher}
                    className="w-full sm:w-auto px-3 sm:px-4 h-10 bg-[#282420] text-white text-xs font-medium rounded-[4px] hover:bg-[#3d3834] disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    {isApplyingVoucher ? 'Memproses...' : 'Terapkan'}
                  </button>
                </div>
                <p className="text-[11px] text-[#706861] mt-1">

                </p>
                {appliedVoucher && (
                  <div className="mt-2.5 p-2.5 bg-emerald-50 border border-emerald-200 rounded-[4px] flex items-center justify-between text-xs text-emerald-800">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Voucher <strong>{appliedVoucher.code}</strong> aktif (-Rp{appliedVoucher.discountAmount.toLocaleString('id-ID')})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveVoucher}
                      className="text-xs text-red-600 hover:text-red-800 font-medium ml-2 underline"
                    >
                      Hapus
                    </button>
                  </div>
                )}
                {voucherError && (
                  <p className="mt-1.5 text-xs text-red-700 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{voucherError}</span>
                  </p>
                )}
              </div>

              {/* Kalkulasi Rincian Biaya */}
              <div className="space-y-2 text-xs py-4 border-t border-[#E8E2DC]">
                <div className="flex justify-between text-[#706861]">
                  <span>Subtotal Barang</span>
                  <span>Rp{serverSubtotal.toLocaleString('id-ID')}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Diskon Promo</span>
                    <span>-Rp{discountAmount.toLocaleString('id-ID')}</span>
                  </div>
                )}
                <div className="flex justify-between text-[#706861]">
                  <span>Ongkos Kirim {selectedShipping ? `(${selectedShipping.service})` : ''}</span>
                  <span className={selectedShipping ? 'font-medium text-[#282420]' : 'text-amber-700 italic'}>
                    {selectedShipping ? `Rp${shippingFee.toLocaleString('id-ID')}` : 'Belum dipilih'}
                  </span>
                </div>
                <div className="pt-2 border-t border-[#E8E2DC] flex justify-between text-[15px] font-medium text-[#282420]">
                  <span>Total Pembayaran</span>
                  <span>Rp{totalAmount.toLocaleString('id-ID')}</span>
                </div>
              </div>

              {/* Instruksi Metode Pembayaran Sesuai Aturan */}
              <div className="mt-6 pt-4 border-t border-[#E8E2DC]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-[#282420]">
                    Metode: {activeMethod === 'QRIS' ? 'QRIS' : 'Transfer Bank'}
                  </span>
                  <span className="text-[11px] text-[#B88770] font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Batas waktu pembayaran 24 Jam
                  </span>
                </div>

                {activeMethod === 'QRIS' ? (
                  !selectedShipping ? (
                    <div className="p-4 bg-[#F3EBDF]/30 border border-[#E8E2DC] rounded-[4px] text-center text-xs text-[#706861]">
                      <p className="font-medium text-[#282420] mb-1">QRIS akan muncul setelah memilih jasa ekspedisi</p>
                      <p className="text-[11px]"></p>
                    </div>
                  ) : isReservationExpired ? (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-[6px] text-center space-y-2">
                      <div className="flex items-center justify-center gap-1.5 font-bold text-xs text-amber-900">
                        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                        <span>Waktu Reservasi di Website Telah Berakhir</span>
                      </div>
                      <p className="text-[11px] text-[#634211] leading-relaxed">
                        Batas waktu reservasi stok pesanan (24 jam) di website toko kami telah habis. Pembayaran melalui halaman ini dihentikan untuk menjaga ketersediaan stok. Silakan ulangi proses checkout untuk membuat reservasi baru.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveReservation(null);
                          syncReservationAndGenerateQR();
                        }}
                        className="mt-1 px-3 py-1.5 bg-[#282420] text-white text-xs font-medium rounded-[4px] hover:bg-[#3d3834] transition-colors"
                      >
                        Buat Reservasi Baru
                      </button>
                    </div>
                  ) : qrError ? (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-[6px] text-center space-y-2">
                      <div className="flex items-center justify-center gap-1.5 font-bold text-xs text-red-900">
                        <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
                        <span>Gagal Memuat QRIS Pembayaran</span>
                      </div>
                      <p className="text-[11px] text-red-700">{qrError}</p>
                      <button
                        type="button"
                        onClick={() => syncReservationAndGenerateQR()}
                        className="mt-2 px-3.5 py-1.5 bg-[#282420] text-white text-xs font-medium rounded-[4px] hover:bg-[#3d3834] transition-colors flex items-center gap-1.5 mx-auto"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Coba Lagi</span>
                      </button>
                    </div>
                  ) : isSyncingReservation && !qrisDataUrl ? (
                    <div className="p-6 bg-[#F3EBDF]/30 border border-[#E8E2DC] rounded-[4px] text-center space-y-2">
                      <RefreshCw className="w-5 h-5 text-[#87533F] animate-spin mx-auto" />
                      <p className="text-xs font-medium text-[#282420]">Menyiapkan QRIS Bernominal...</p>
                      <p className="text-[11px] text-[#706861]">Memvalidasi total reservasi dengan server...</p>
                    </div>
                  ) : qrisDataUrl ? (
                    <div className="p-4 bg-[#F3EBDF]/30 border border-[#E8E2DC] rounded-[4px] text-center space-y-3">
                      <p className="text-xs text-[#282420] font-medium leading-relaxed">
                        Scan QR untuk membayar. Nominal sudah terisi otomatis; pastikan nama toko dan jumlahnya sesuai.
                      </p>

                      {/* Large & Sharp QR Code */}
                      <div className="mx-auto w-52 h-52 sm:w-60 sm:h-60 bg-white border-2 border-[#E8E2DC] p-3 rounded-[8px] shadow-sm flex items-center justify-center">
                        <img
                          src={qrisDataUrl}
                          alt="QRIS Dinamis Bernominal Defra Hijab"
                          className="w-full h-full object-contain"
                        />
                      </div>

                      <div className="pt-2 border-t border-[#E8E2DC] space-y-1">
                        <div className="text-xs text-[#706861]">
                          Nama Toko: <strong className="text-[#282420] font-semibold">D'efra Hijab, Fashion</strong>
                        </div>
                        <div className="text-sm font-bold text-[#26786C]">
                          Total Pembayaran: Rp{(activeReservation?.totalAmount || totalAmount).toLocaleString('id-ID')}
                        </div>
                        {activeReservation?.expiresAt && <ReservationCountdown expiresAt={activeReservation.expiresAt} />}
                      </div>
                    </div>
                  ) : null
                ) : activeMethod === 'BANK_TRANSFER' ? (
                  <div className="p-4 bg-[#F3EBDF]/30 border border-[#E8E2DC] rounded-[4px]">
                    <p className="text-xs text-[#706861] mb-2">Transfer ke rekening resmi Defra Hijab:</p>
                    <p className="text-sm font-medium text-[#282420]">{storeSettings.bankName}</p>
                    <div className="flex items-center justify-between bg-white px-3 py-2 border border-[#E8E2DC] rounded-[4px] my-2">
                      <span className="font-sans text-sm font-medium text-[#282420]">
                        {storeSettings.bankAccountNumber}
                      </span>
                      <button
                        type="button"
                        onClick={copyAccountNumber}
                        className="text-xs font-medium text-[#B88770] hover:text-[#282420] flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        {copiedAccount ? 'Tersalin' : 'Salin'}
                      </button>
                    </div>
                    <p className="text-xs text-[#706861]">a.n {storeSettings.bankAccountHolder}</p>
                  </div>
                ) : (
                  <div className="p-3 bg-red-50 text-red-800 text-xs rounded-[4px]">
                    Metode pembayaran sedang dinonaktifkan sementara oleh pemilik toko.
                  </div>
                )}
              </div>

              {/* Bagian 5: bukti selalu setelah instruksi pembayaran */}
              <div className="mt-6 pt-5 border-t border-[#E8E2DC]">
                <h3 className="text-[14px] font-medium text-[#282420] mb-3">5. Bukti Pembayaran</h3>
                <p className="text-xs text-[#706861] mb-3 leading-relaxed">
                  Setelah membayar, unggah bukti pembayaran untuk diverifikasi manual oleh owner (maksimal 2 MB, JPG, PNG, atau WebP).
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="cursor-pointer px-4 py-2.5 bg-white border border-[#282420] text-[#282420] text-xs font-medium rounded-[4px] hover:bg-[#F3EBDF]/30 transition-colors inline-flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    <span>Pilih Berkas Bukti</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} className="hidden" />
                  </label>
                  {proofFile && <span className="text-xs font-medium truncate max-w-[220px]">{proofFile.name} ({Math.round(proofFile.size / 1024)} KB)</span>}
                </div>
                {proofPreviewUrl && (
                  <div className="mt-4 w-32 aspect-[3/4] border border-[#E8E2DC] rounded-[4px] overflow-hidden bg-white">
                    <img src={proofPreviewUrl} alt="Pratinjau Bukti" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              {/* Tombol Finalisasi Pesanan */}
              <p className="mt-6 text-xs font-medium text-[#282420]">6. Konfirmasi Pesanan</p>
              <button
                type="submit"
                disabled={isSubmitting || activeMethod === 'NONE' || isReservationExpired || isSyncingReservation || !selectedShipping || !proofFile || (activeMethod === 'QRIS' && !qrisDataUrl)}
                className="w-full mt-6 h-12 bg-[#282420] text-white text-[14px] font-medium rounded-[4px] hover:bg-[#3d3834] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-[#282420]"
              >
                {isSubmitting ? (
                  <span>Memproses Transaksi...</span>
                ) : isReservationExpired ? (
                  <span>Waktu Reservasi Berakhir</span>
                ) : !selectedShipping ? (
                  <span>Pilih Layanan Pengiriman Dahulu</span>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Konfirmasi &amp; Selesaikan Pesanan</span>
                  </>
                )}
              </button>

              <p className="mt-3 text-[11px] text-[#706861] text-center">

              </p>
            </div>
          </div>

        </form>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  );
};
