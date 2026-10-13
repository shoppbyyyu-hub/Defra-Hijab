/**
 * Shared utility functions for Defra Owner Admin Panel
 * Compliant with admin UI/UX specification design tokens
 */

export function formatRp(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return 'Rp0';
  }
  const isNegative = amount < 0;
  const abs = Math.abs(Math.round(amount));
  const formatted = abs.toLocaleString('id-ID');
  return isNegative ? `−Rp${formatted}` : `Rp${formatted}`;
}

export function formatRpShort(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return 'Rp0';
  }
  const isNegative = amount < 0;
  const abs = Math.abs(amount);

  let text = '';
  if (abs >= 1_000_000_000) {
    text = `${(abs / 1_000_000_000).toFixed(1).replace('.', ',')} M`;
  } else if (abs >= 1_000_000) {
    text = `${(abs / 1_000_000).toFixed(1).replace('.', ',')} jt`;
  } else if (abs >= 100_000) {
    text = `${Math.round(abs / 1000)} rb`;
  } else {
    text = abs.toLocaleString('id-ID');
  }

  return isNegative ? `−Rp${text}` : `Rp${text}`;
}

export function getPaymentStatusInfo(status: string) {
  switch (status) {
    case 'VERIFIED':
      return {
        label: 'Terverifikasi',
        bg: 'bg-[#E8F3EF]',
        text: 'text-[#26786C]',
        border: 'border-[#26786C]/20',
        dot: 'bg-[#26786C]'
      };
    case 'WAITING_VERIFICATION':
      return {
        label: 'Menunggu Review',
        bg: 'bg-[#FEF7EA]',
        text: 'text-[#94691E]',
        border: 'border-[#94691E]/20',
        dot: 'bg-[#94691E]'
      };
    case 'REVISION_REQUESTED':
      return {
        label: 'Perlu Revisi Bukti',
        bg: 'bg-[#FAECEA]',
        text: 'text-[#B33D39]',
        border: 'border-[#B33D39]/20',
        dot: 'bg-[#B33D39]'
      };
    case 'REFUNDED':
    case 'REFUNDED_PARTIAL':
      return {
        label: status === 'REFUNDED' ? 'Refund Selesai' : 'Refund Sebagian',
        bg: 'bg-blue-50',
        text: 'text-[#426BC6]',
        border: 'border-[#426BC6]/20',
        dot: 'bg-[#426BC6]'
      };
    case 'CANCELLED':
      return {
        label: 'Dibatalkan',
        bg: 'bg-[#F6F5F2]',
        text: 'text-[#716B64]',
        border: 'border-[#E9E5DF]',
        dot: 'bg-[#716B64]'
      };
    default:
      return {
        label: status || 'Belum Bayar',
        bg: 'bg-[#F6F5F2]',
        text: 'text-[#716B64]',
        border: 'border-[#E9E5DF]',
        dot: 'bg-[#716B64]'
      };
  }
}

export function getFulfillmentStatusInfo(status: string) {
  switch (status) {
    case 'DELIVERED':
      return {
        label: 'Terkirim',
        bg: 'bg-[#E8F3EF]',
        text: 'text-[#26786C]',
        border: 'border-[#26786C]/20'
      };
    case 'SHIPPED':
      return {
        label: 'Dalam Pengiriman',
        bg: 'bg-blue-50',
        text: 'text-[#426BC6]',
        border: 'border-[#426BC6]/20'
      };
    case 'PACKED':
      return {
        label: 'Siap Dikemas',
        bg: 'bg-[#FEF7EA]',
        text: 'text-[#94691E]',
        border: 'border-[#94691E]/20'
      };
    case 'RETURN_REQUESTED':
      return {
        label: 'Pengajuan Retur',
        bg: 'bg-[#FAECEA]',
        text: 'text-[#B33D39]',
        border: 'border-[#B33D39]/20'
      };
    case 'RETURN_APPROVED':
      return {
        label: 'Retur Disetujui',
        bg: 'bg-purple-50',
        text: 'text-purple-700',
        border: 'border-purple-200'
      };
    case 'RETURN_COMPLETED':
      return {
        label: 'Retur Selesai',
        bg: 'bg-[#F6F5F2]',
        text: 'text-[#716B64]',
        border: 'border-[#E9E5DF]'
      };
    default:
      return {
        label: status || 'Menunggu Verifikasi',
        bg: 'bg-[#F6F5F2]',
        text: 'text-[#716B64]',
        border: 'border-[#E9E5DF]'
      };
  }
}
