import QRCode from 'qrcode';
import jsQR from 'jsqr';

export const DEFAULT_DEFRA_QRIS_STATIC_PAYLOAD =
  "00020101021126610014COM.GO-JEK.WWW01189360091439132450330210G9132450330303UMI51440014ID.CO.QRIS.WWW0215ID10266146652180303UMI5204569753033605802ID5921D'efra Hijab, Fashion6005DEPOK61051651262070703A0163045787";

export interface QRISTag {
  tag: string;
  len: number;
  val: string;
}

export interface QRISTLVMap {
  [tag: string]: QRISTag;
}

export interface QRISDecodeResult {
  raw: string;
  pointOfInitiation: '11' | '12' | string;
  pointOfInitiationLabel: string;
  merchantName: string;
  merchantCity: string;
  postalCode: string;
  amount: number | null;
  amountFormatted: string | null;
  currency: string;
  countryCode: string;
  mcc: string;
  crc: {
    expected: string;
    calculated: string;
    isValid: boolean;
  };
  tags: QRISTLVMap;
}

/**
 * Parsing struktur TLV (Tag-Length-Value) sesuai spesifikasi EMVCo / QRIS
 */
export function parseQRISTLV(dataStr: string): QRISTLVMap {
  const result: QRISTLVMap = {};
  let i = 0;
  while (i < dataStr.length) {
    if (i + 4 > dataStr.length) throw new Error('Struktur TLV QRIS tidak lengkap.');
    const tag = dataStr.slice(i, i + 2);
    const len = parseInt(dataStr.slice(i + 2, i + 4), 10);
    if (!/^\d{2}$/.test(tag) || isNaN(len)) throw new Error('Tag atau panjang TLV QRIS tidak valid.');
    if (i + 4 + len > dataStr.length) throw new Error(`Nilai tag QRIS ${tag} terpotong.`);
    const val = dataStr.slice(i + 4, i + 4 + len);
    result[tag] = { tag, len, val };
    i += 4 + len;
  }
  return result;
}

export function validateBaseQRISPayload(payload: string): QRISDecodeResult {
  const decoded = decodeQRISPayload(payload);
  const required = ['00', '01', '26', '52', '53', '58', '59', '60', '61', '63'];
  const missing = required.filter((tag) => !decoded.tags[tag]);
  if (missing.length) throw new Error(`Payload dasar QRIS tidak lengkap (tag ${missing.join(', ')}).`);
  if (!decoded.crc.isValid) throw new Error('CRC payload dasar QRIS tidak valid.');
  if (decoded.amount !== null) throw new Error('Payload dasar QRIS harus statis tanpa nominal.');
  if (decoded.pointOfInitiation !== '11') throw new Error('Payload dasar QRIS harus menggunakan mode statis 11.');
  return decoded;
}

/**
 * Hitung checksum CRC-16/CCITT-FALSE (Polynomial: 0x1021, Init: 0xFFFF)
 */
export function calculateCRC16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Validasi checksum CRC-16 pada payload QRIS
 */
export function validateQRISCRC(payload: string): {
  isValid: boolean;
  expected: string;
  calculated: string;
} {
  const crcIndex = payload.lastIndexOf('6304');
  if (crcIndex === -1 || crcIndex + 8 !== payload.length) {
    return { isValid: false, expected: '', calculated: '' };
  }
  const dataForCrc = payload.slice(0, crcIndex + 4);
  const expected = payload.slice(crcIndex + 4, crcIndex + 8).toUpperCase();
  const calculated = calculateCRC16(dataForCrc);
  return {
    isValid: expected === calculated,
    expected,
    calculated
  };
}

/**
 * Decode dan ekstrak informasi dari payload string QRIS
 */
export function decodeQRISPayload(payload: string): QRISDecodeResult {
  const tags = parseQRISTLV(payload);
  const crcCheck = validateQRISCRC(payload);

  const poi = tags['01']?.val || '11';
  const amountVal = tags['54']?.val ? parseFloat(tags['54'].val) : null;

  return {
    raw: payload,
    pointOfInitiation: poi,
    pointOfInitiationLabel:
      poi === '12'
        ? 'Dinamis (12) - Nominal Tercantum'
        : poi === '11'
        ? 'Statis (11)'
        : `Lainnya (${poi})`,
    merchantName: tags['59']?.val || "D'efra Hijab, Fashion",
    merchantCity: tags['60']?.val || 'DEPOK',
    postalCode: tags['61']?.val || '16512',
    amount: amountVal,
    amountFormatted:
      amountVal !== null ? `Rp${Math.round(amountVal).toLocaleString('id-ID')}` : null,
    currency: tags['53']?.val === '360' ? 'IDR (360)' : tags['53']?.val || '360',
    countryCode: tags['58']?.val || 'ID',
    mcc: tags['52']?.val || '5697',
    crc: {
      expected: crcCheck.expected,
      calculated: crcCheck.calculated,
      isValid: crcCheck.isValid
    },
    tags
  };
}

export interface DynamicQRISOptions {
  pointOfInitiation?: '11' | '12';
}

/**
 * Generate payload QRIS bernominal baru secara lokal dari QRIS dasar
 * Mempertahankan seluruh identitas merchant (Tag 26, 51, 52, 53, 58, 59, 60, 61, 62)
 * dan menginjeksi nominal (Tag 54) serta menghitung ulang checksum Tag 63.
 */
export function generateDynamicQRISPayload(
  staticPayload: string,
  amount: number,
  options: DynamicQRISOptions = {}
): {
  payload: string;
  amount: number;
  crc: string;
  decoded: QRISDecodeResult;
} {
  if (amount <= 0 || isNaN(amount)) {
    throw new Error('Nominal transaksi harus lebih besar dari 0.');
  }

  validateBaseQRISPayload(staticPayload);

  const tlv = parseQRISTLV(staticPayload);

  // Mode Initiation: Default '12' (Dinamis), bisa '11' untuk perbandingan kompatibilitas
  const poi = options.pointOfInitiation || '12';
  tlv['01'] = { tag: '01', len: 2, val: poi };

  // Tag 54: Transaction Amount (integer format untuk IDR)
  const amountStr = Math.round(amount).toString();
  tlv['54'] = { tag: '54', len: amountStr.length, val: amountStr };

  // Hapus Tag 63 lama
  delete tlv['63'];

  // Urutkan tags secara ascending sesuai standar EMVCo
  const sortedTagKeys = Object.keys(tlv).sort(
    (a, b) => parseInt(a, 10) - parseInt(b, 10)
  );

  let payloadWithoutCRC = '';
  for (const tag of sortedTagKeys) {
    const item = tlv[tag];
    const lenStr = item.val.length.toString().padStart(2, '0');
    payloadWithoutCRC += `${tag}${lenStr}${item.val}`;
  }

  // Tambahkan tag 6304
  const dataForCRC = payloadWithoutCRC + '6304';
  const crc = calculateCRC16(dataForCRC);
  const finalPayload = dataForCRC + crc;

  // Lakukan decode balik untuk verifikasi integritas
  const decoded = decodeQRISPayload(finalPayload);

  return {
    payload: finalPayload,
    amount: Math.round(amount),
    crc,
    decoded
  };
}

/**
 * Generate gambar QR Data URL (PNG base64) beresolusi tinggi secara lokal
 */
export async function generateQRDataURL(
  text: string,
  width: number = 360
): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width,
    color: {
      dark: '#141210',
      light: '#FFFFFF'
    }
  });
}
