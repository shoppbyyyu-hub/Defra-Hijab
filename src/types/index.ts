export interface Category {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
}

export interface InventoryBatch {
  id: string;
  batchCode: string;
  initialQty: number;
  remainingQty: number;
  costPerUnit: number; // HPP per unit
  arrivalDate: string;
}

export interface ProductColorGallery {
  color: string;
  colorHex?: string;
  images: string[]; // List of photo URLs for this specific color
}

export interface ProductVariant {
  id: string;
  productId: string;
  color: string;
  colorHex: string;
  size: string;
  sku: string;
  isActive: boolean;
  batches: InventoryBatch[];
  // Calculated live:
  physicalStock: number;
  activeReservations: number;
  orderAllocations: number;
  availableStock: number; // physicalStock - activeReservations - orderAllocations
}

export interface Product {
  id: string;
  categoryId: string;
  categoryName?: string;
  name: string;
  slug: string;
  description: string;
  basePrice: number;
  discountPrice?: number; // Real discount price set by owner
  weightGrams: number;
  imageUrl: string; // Primary default photo
  images?: string[]; // General gallery photos
  sizes?: string[]; // List of available sizes, e.g. ["115 x 115 cm", "120 x 120 cm"]
  colors?: Array<{ color: string; colorHex?: string }>; // List of color options
  colorGalleries?: ProductColorGallery[]; // Specific photo gallery per color
  variants: ProductVariant[]; // Combinations of color x size with live stock
  isActive: boolean;
  isArchived: boolean;
  totalSoldUnits?: number; // Real metric for best seller
  createdAt: string;
  updatedAt: string;
}

export interface HeroBanner {
  id: string;
  desktopImageUrl: string;
  mobileImageUrl: string;
  focalX: number;
  focalY: number;
  mobileFocalX?: number;
  mobileFocalY?: number;
  isActive: boolean;
  isPortraitMissing?: boolean;
  createdAt?: string;
}

export interface CampaignGalleryItem {
  id: string;
  imageUrl: string;
  aspectRatio: '2:1' | '4:5';
  sortOrder: number;
  isActive: boolean;
}

export interface CommunityReel {
  id: string;
  provider: 'YOUTUBE' | 'INSTAGRAM' | 'TIKTOK';
  sourceUrl: string;
  externalId: string;
  title?: string;
  youtubeVideoId?: string;
  posterImageUrl?: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Voucher {
  id: string;
  code: string;
  promoName: string;
  discountType: 'NOMINAL' | 'PERCENTAGE';
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount?: number;
  scope: 'ALL' | 'CATEGORY' | 'PRODUCT';
  targetCategoryId?: string;
  targetProductId?: string;
  quota: number;
  reservedQuota: number;
  usedCount: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface CartItem {
  productId: string;
  variantId: string;
  productName: string;
  color: string;
  size: string;
  unitPrice: number;
  weightGrams: number;
  imageUrl: string;
  quantity: number;
}

export interface ShippingServiceOption {
  service: string;
  serviceCode?: string;
  provider?: 'JNE' | 'GOSEND';
  description: string;
  cost: number;
  etd: string; // e.g. "1-2 Hari"
}

export interface Reservation {
  id: string;
  sessionToken: string;
  expiresAt: string; // ISO String, exactly 24 hours
  items: CartItem[];
  subtotal: number;
  discountAmount: number;
  voucherId?: string;
  voucherCode?: string;
  shippingFee: number;
  shippingService: string;
  destinationId?: number | string;
  shippingOriginId: string;
  totalAmount: number;
  status: 'ACTIVE' | 'CONVERTED' | 'EXPIRED' | 'CANCELLED';
  createdAt: string;
}

export type PaymentMethod = 'QRIS' | 'BANK_TRANSFER';

export type PaymentStatus =
  | 'WAITING_VERIFICATION'
  | 'REVISION_REQUESTED'
  | 'VERIFIED'
  | 'REFUNDED_PARTIAL'
  | 'REFUNDED_FULL';

export type FulfillmentStatus =
  | 'WAITING_PAYMENT_VERIFIED'
  | 'PACKED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

export interface OrderItem {
  id: string;
  variantId: string;
  productName: string;
  color: string;
  size: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  allocatedBatches: Array<{
    batchId: string;
    batchCode: string;
    quantity: number;
    costPerUnit: number;
  }>;
}

export interface Order {
  id: string;
  orderNumber: string; // Cryptographic random unique ID
  reservationId: string;
  customerName: string;
  customerEmail: string;
  customerWhatsapp: string;
  customerBirthDate: string;
  addressLine: string;
  province: string;
  city: string;
  subdistrict: string;
  postalCode: string;
  subtotal: number;
  discount: number;
  shippingFee: number;
  shippingService: string;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  paymentProofUrl: string;
  paymentProofMime: string;
  rejectionReason?: string;
  rejectionDeadline?: string;
  actualDeliveryDate?: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  costs?: {
    packagingCost: number;
    paymentFee: number;
    shippingActualCost: number;
    shippingSubsidy: number;
    notes?: string;
  };
  refundAmount?: number;
  refundReason?: string;
  cancellationReason?: string;
}

export interface OperationalExpense {
  id: string;
  category: 'ELECTRICITY' | 'ADVERTISING' | 'PACKAGING_BULK' | 'SALARY' | 'MAINTENANCE' | 'OTHER';
  description: string;
  amount: number;
  periodMonth: string; // e.g. "2026-10"
  expenseDate: string; // ISO date
  receiptUrl?: string;
  createdAt: string;
}

export interface ReturnRequest {
  id: string;
  orderId: string;
  orderNumber: string;
  returnNumber: string;
  requestedResolution: 'REFUND' | 'REPLACEMENT';
  reasonCategory: 'WRONG_ITEM' | 'DAMAGED' | 'DEFECTIVE';
  customerNotes: string;
  proofImageUrls: string[];
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RECEIVED_INSPECTED' | 'COMPLETED';
  adminNotes?: string;
  inspectionResult?: 'RESTOCKED_GOOD' | 'RECORDED_DAMAGED_LOSS';
  receivedDate?: string;
  resolvedDate?: string;
  createdAt: string;
}

export interface DefraSettings {
  whatsappNumber: string;
  originProvince: string;
  originCity: string;
  originCityId: string;
  originLabel?: string;
  originSubdistrict: string;
  originPostalCode?: string;
  originAddress: string;
  qrisEnabled: boolean;
  bankTransferEnabled: boolean;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  lowStockThreshold: number;
  telegramEnabled: boolean;
  telegramChatId: string;
  telegramBotToken?: string;
  allowVoucherOnDiscountedProducts?: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actorType: 'BUYER' | 'ADMIN' | 'SYSTEM';
  actorId?: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
}
