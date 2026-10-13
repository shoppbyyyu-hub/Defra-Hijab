export type CheckoutPaymentMethod = 'QRIS' | 'BANK_TRANSFER' | 'NONE';

export function resolveCheckoutPaymentMethod(
  totalAmount: number,
  qrisEnabled: boolean,
  bankTransferEnabled: boolean
): CheckoutPaymentMethod {
  if (qrisEnabled && bankTransferEnabled) {
    return totalAmount < 2000000 ? 'QRIS' : 'BANK_TRANSFER';
  }
  if (qrisEnabled) return 'QRIS';
  if (bankTransferEnabled) return 'BANK_TRANSFER';
  return 'NONE';
}
