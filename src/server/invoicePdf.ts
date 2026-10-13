import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';

const rupiah = (value: unknown) => `Rp ${Math.round(Number(value || 0)).toLocaleString('id-ID')}`;
const clean = (value: unknown) => String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim();

function wrappedLines(text: string, font: PDFFont, size: number, width: number) {
  const words = clean(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) line = candidate;
    else { if (line) lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ['-'];
}

export async function createInvoicePdf(order: any) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const kopBytes = await readFile(path.join(process.cwd(), 'public', 'assets', 'invoice', 'KOP.PNG'));
  const isPng = kopBytes.length >= 8 && kopBytes.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  const isJpeg = kopBytes.length >= 3 && kopBytes[0] === 0xff && kopBytes[1] === 0xd8 && kopBytes[2] === 0xff;
  if (!isPng && !isJpeg) throw new Error('Format aset kop invoice harus PNG atau JPEG.');
  // Sebagian export Photoshop memakai ekstensi .PNG tetapi byte aslinya JPEG.
  // Deteksi magic bytes menjaga aset asli tetap dapat dipakai tanpa mengubah rasio.
  const kop = isPng ? await document.embedPng(kopBytes) : await document.embedJpg(kopBytes);
  const pageSize:[number,number] = [595.28, 841.89];
  const margin = 42;
  let page = document.addPage(pageSize);
  let y = 0;

  const addHeader = () => {
    const imageWidth = pageSize[0];
    const imageHeight = imageWidth * (kop.height / kop.width);
    y = pageSize[1];
    page.drawImage(kop, { x: 0, y: y - imageHeight, width: imageWidth, height: imageHeight });
    y -= imageHeight + 22;
  };
  const newPage = () => { page = document.addPage(pageSize); addHeader(); };
  const ensure = (height:number) => { if (y - height < 48) newPage(); };
  const text = (value:unknown, x:number, size=9, font=regular, color=rgb(.16,.14,.13)) => page.drawText(clean(value) || '-', {x,y,size,font,color});
  const row = (label:string, value:unknown) => { ensure(15); text(label,margin,9,bold); text(value,margin+115,9); y-=14; };

  addHeader();
  text('INVOICE', margin, 18, bold); y -= 25;
  const invoiceNumber = `INV-${clean(order.order_number)}`;
  row('Nomor Invoice', invoiceNumber);
  row('Tanggal Invoice', new Date(order.payments?.[0]?.verified_at || order.updated_at).toLocaleString('id-ID', { timeZone:'Asia/Jakarta' }));
  row('Nomor Pesanan', order.order_number);
  y -= 7;

  text('DATA PELANGGAN', margin, 10, bold); y -= 17;
  row('Nama', order.customer_name);
  row('Email', order.customer_email);
  row('WhatsApp', order.customer_whatsapp);
  row('Alamat', order.address_line);
  const area = [order.village, order.subdistrict, order.city, order.province, order.postal_code].filter(Boolean).join(', ');
  for (const [index,line] of wrappedLines(area, regular, 9, pageSize[0]-margin*2-115).entries()) {
    ensure(14); text(index === 0 ? 'Wilayah' : '', margin, 9, bold); text(line, margin+115, 9); y -= 14;
  }
  y -= 9;

  text('RINCIAN BARANG', margin, 10, bold); y -= 17;
  const widths=[210,62,55,40,76];
  const headers=['Barang / Variasi','Harga','Jumlah','', 'Total'];
  let x=margin;
  headers.forEach((header,index)=>{ text(header,x,8,bold); x+=widths[index]; });
  y-=12;
  page.drawLine({start:{x:margin,y},end:{x:pageSize[0]-margin,y},thickness:.7,color:rgb(.72,.53,.44)}); y-=12;
  for (const item of order.order_items || []) {
    const description=`${item.product_name} - ${item.color_name} / ${item.size_name}`;
    const lines=wrappedLines(description,regular,8.5,widths[0]-8);
    const height=Math.max(20,lines.length*11+6); ensure(height);
    const top=y;
    lines.forEach((line,index)=>page.drawText(line,{x:margin,y:top-index*11,size:8.5,font:regular,color:rgb(.16,.14,.13)}));
    page.drawText(rupiah(item.unit_price),{x:margin+widths[0],y:top,size:8.5,font:regular});
    page.drawText(String(item.quantity),{x:margin+widths[0]+widths[1]+14,y:top,size:8.5,font:regular});
    page.drawText(rupiah(item.line_total),{x:pageSize[0]-margin-widths[4],y:top,size:8.5,font:bold});
    y-=height;
  }
  page.drawLine({start:{x:margin,y},end:{x:pageSize[0]-margin,y},thickness:.5,color:rgb(.86,.83,.80)}); y-=18;
  const totalRow=(label:string,value:unknown,strong=false)=>{ensure(16);page.drawText(label,{x:330,y,size:strong?10:9,font:strong?bold:regular});page.drawText(rupiah(value),{x:445,y,size:strong?10:9,font:strong?bold:regular});y-=15;};
  totalRow('Subtotal',order.subtotal);
  totalRow('Diskon',-Number(order.discount_amount||0));
  totalRow('Ongkir',order.shipping_fee);
  totalRow('TOTAL',order.total_amount,true);
  y-=8;
  row('Metode Pembayaran', order.payment_method === 'BANK_TRANSFER' ? 'Transfer Bank' : order.payment_method);
  row('Status Pembayaran', 'TERVERIFIKASI');
  row('Layanan Pengiriman', order.shipping_service_label);
  ensure(35); y-=8;
  text('Invoice ini dibuat setelah pembayaran diverifikasi secara manual oleh owner Defra Hijab.',margin,8,regular,rgb(.38,.35,.32));

  document.setTitle(invoiceNumber);
  document.setAuthor('Defra Hijab');
  return Buffer.from(await document.save());
}
