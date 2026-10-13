import crypto from 'crypto';
import { getSupabaseAdmin } from './supabase.ts';

export interface TelegramOutboxJob {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  attempts: number;
}

export interface TelegramQueueAdapter {
  claim(worker: string, limit: number, leaseSeconds: number): Promise<TelegramOutboxJob[]>;
  sent(id: string, worker: string): Promise<boolean>;
  retry(id: string, worker: string, attempts: number, error: string, terminal: boolean): Promise<boolean>;
}

const runtime = globalThis as typeof globalThis & {
  __defraTelegramWorker?: NodeJS.Timeout;
  __defraTelegramWorkerId?: string;
  __defraTelegramWorkerBusy?: boolean;
  __defraTelegramWorkerError?: string | null;
};
const rupiah = (value: unknown) => `Rp${Number(value || 0).toLocaleString('id-ID')}`;

interface LowStockBatchSnapshot { batchCode: string; remainingQty: number; }
interface LowStockSnapshot {
  sku?: string;
  productName?: string;
  color?: string;
  size?: string;
  batches: LowStockBatchSnapshot[];
}

interface ReturnNotificationSnapshot {
  returnNumber:string; orderNumber:string; customerName:string; customerEmail:string;
  customerWhatsapp:string; customerBirthDate:string; address:string;
  items:Array<{productName:string;color:string;size:string;quantity:number;lineTotal:number}>;
  voucherCode?:string|null; subtotal:number; discount:number; shippingFee:number; total:number;
  paymentMethod:string; reason:string; resolution:string; notes:string; proofUrls:string[];
}

function sanitizeError(error: unknown, bot = '') {
  let message = String((error as Error)?.message || error || 'Kesalahan tidak diketahui');
  if (bot) message = message.replaceAll(bot, '[TOKEN DISEMBUNYIKAN]');
  return message.replace(/https?:\/\/\S+/gi, '[URL DISEMBUNYIKAN]').slice(0, 500);
}

async function lookupLowStockSnapshot(variantId: unknown): Promise<LowStockSnapshot | null> {
  if (typeof variantId !== 'string' || !variantId) return null;
  const db = getSupabaseAdmin();
  const { data: variant, error } = await db.from('product_variants').select('sku,product_id,color_id,size_id').eq('id', variantId).maybeSingle();
  if (error) throw error;
  if (!variant) return null;
  const [product, color, size, batches] = await Promise.all([
    db.from('products').select('name').eq('id', variant.product_id).maybeSingle(),
    db.from('product_colors').select('name').eq('id', variant.color_id).maybeSingle(),
    db.from('product_sizes').select('name').eq('id', variant.size_id).maybeSingle(),
    db.from('inventory_batches').select('batch_code,remaining_qty,arrival_date,created_at')
      .eq('variant_id', variantId).gt('remaining_qty', 0)
      .order('arrival_date', { ascending: true }).order('created_at', { ascending: true })
  ]);
  const lookupError = product.error || color.error || size.error || batches.error;
  if (lookupError) throw lookupError;
  return {
    sku: variant.sku,
    productName: product.data?.name,
    color: color.data?.name,
    size: size.data?.name,
    batches: (batches.data || []).map((batch: any) => ({ batchCode: batch.batch_code, remainingQty: Number(batch.remaining_qty) }))
  };
}

async function lookupReturnSnapshot(returnId:unknown):Promise<ReturnNotificationSnapshot|null>{
  if(typeof returnId!=='string'||!returnId)return null;
  const db=getSupabaseAdmin();
  const {data:r,error}=await db.from('return_requests').select('return_number,requested_resolution,reason_category,customer_notes,orders(order_number,customer_name,customer_email,customer_whatsapp,customer_birth_date,address_line,village,subdistrict,city,province,postal_code,voucher_code,subtotal,discount_amount,shipping_fee,total_amount,payment_method),return_items(quantity,order_items(product_name,color_name,size_name,unit_price)),return_proofs(bucket,storage_path)').eq('id',returnId).maybeSingle();
  if(error)throw error;
  if(!r||!r.orders)return null;
  const order:any=Array.isArray(r.orders)?r.orders[0]:r.orders;
  const proofUrls=(await Promise.all((r.return_proofs||[]).map(async(proof:any)=>{
    const {data,error:signedError}=await db.storage.from(proof.bucket||'return-proofs').createSignedUrl(proof.storage_path,3600);
    return signedError?null:data?.signedUrl||null;
  }))).filter((url:any):url is string=>Boolean(url));
  return {returnNumber:r.return_number,orderNumber:order.order_number,customerName:order.customer_name,customerEmail:order.customer_email,customerWhatsapp:order.customer_whatsapp,customerBirthDate:order.customer_birth_date,address:[order.address_line,order.village,order.subdistrict,order.city,order.province,order.postal_code].filter(Boolean).join(', '),items:(r.return_items||[]).map((item:any)=>{const ordered=Array.isArray(item.order_items)?item.order_items[0]:item.order_items;return {productName:ordered?.product_name||'-',color:ordered?.color_name||'-',size:ordered?.size_name||'-',quantity:Number(item.quantity),lineTotal:Number(ordered?.unit_price||0)*Number(item.quantity)};}),voucherCode:order.voucher_code,subtotal:Number(order.subtotal),discount:Number(order.discount_amount),shippingFee:Number(order.shipping_fee),total:Number(order.total_amount),paymentMethod:order.payment_method,reason:r.reason_category,resolution:r.requested_resolution,notes:r.customer_notes,proofUrls};
}

export function formatReturnNotification(snapshot:ReturnNotificationSnapshot){
  const reasons:Record<string,string>={WRONG_ITEM:'Barang yang diterima tidak sesuai',DAMAGED:'Barang rusak',DEFECTIVE:'Cacat jahitan atau kain'};
  const resolutions:Record<string,string>={REFUND:'Pengembalian dana',REPLACEMENT:'Penggantian produk'};
  const items=snapshot.items.map(item=>`• ${item.productName} — ${item.color} / ${item.size} × ${item.quantity} (${rupiah(item.lineTotal)})`).join('\n')||'• Tidak ada rincian barang';
  const proofs=snapshot.proofUrls.length?snapshot.proofUrls.map((url,index)=>`${snapshot.proofUrls.length>1?`${index+1}. `:''}${url}`).join('\n'):'Tidak dilampirkan';
  return `Pengajuan Retur Baru — Perlu Ditinjau\n\nNomor retur: ${snapshot.returnNumber}\nNomor pesanan: ${snapshot.orderNumber}\nNama: ${snapshot.customerName}\nEmail: ${snapshot.customerEmail}\nWhatsApp: ${snapshot.customerWhatsapp}\nTanggal lahir: ${snapshot.customerBirthDate}\nAlamat: ${snapshot.address}\n\n${items}\n\nVoucher: ${snapshot.voucherCode||'-'}\nSubtotal: ${rupiah(snapshot.subtotal)}\nDiskon: ${rupiah(snapshot.discount)}\nOngkir: ${rupiah(snapshot.shippingFee)}\nTotal: ${rupiah(snapshot.total)}\nMetode: ${snapshot.paymentMethod}\n\nAlasan retur: ${reasons[snapshot.reason]||snapshot.reason}\nSolusi yang diminta: ${resolutions[snapshot.resolution]||snapshot.resolution}\nCatatan: ${snapshot.notes}\nBukti retur (tautan sementara): ${proofs}`;
}

export async function renderOwnerNotification(
  job: TelegramOutboxJob,
  stockLookup: (variantId: unknown) => Promise<LowStockSnapshot | null> = lookupLowStockSnapshot
): Promise<string> {
  if (job.event_type === 'NEW_ORDER') {
    const { data: o, error } = await getSupabaseAdmin().from('orders').select('*,order_items(*),payments(*)').eq('id', job.payload.orderId).single();
    if (error) throw error;
    const payment = o.payments?.[0]; let proof = 'Tidak tersedia';
    if (payment) { const { data } = await getSupabaseAdmin().storage.from(payment.proof_bucket).createSignedUrl(payment.proof_path, 3600); proof = data?.signedUrl || proof; }
    const items = (o.order_items || []).map((item: any) => `• ${item.product_name} — ${item.color_name} / ${item.size_name} × ${item.quantity} (${rupiah(item.line_total)})`).join('\n');
    return `Pesanan Baru — Perlu Verifikasi Pembayaran\n\nNomor: ${o.order_number}\nNama: ${o.customer_name}\nEmail: ${o.customer_email}\nWhatsApp: ${o.customer_whatsapp}\nTanggal lahir: ${o.customer_birth_date}\nAlamat: ${o.address_line}, ${o.village}, ${o.subdistrict}, ${o.city}, ${o.province} ${o.postal_code}\n\n${items}\n\nVoucher: ${o.voucher_code || '-'}\nSubtotal: ${rupiah(o.subtotal)}\nDiskon: ${rupiah(o.discount_amount)}\nOngkir: ${rupiah(o.shipping_fee)}\nTotal: ${rupiah(o.total_amount)}\nMetode: ${o.payment_method}\nBukti (tautan sementara): ${proof}`;
  }
  if (job.event_type === 'NEW_RETURN') {
    const snapshot=await lookupReturnSnapshot(job.payload.returnId);
    if(!snapshot)return `Pengajuan Retur Baru — Perlu Ditinjau\n\nNomor retur: ${job.payload.returnNumber||'-'}\nData pengajuan tidak lagi tersedia.`;
    return formatReturnNotification(snapshot);
  }
  if (job.event_type === 'LOW_STOCK') {
    const p = job.payload;
    const snapshotComplete = typeof p.productName === 'string' && typeof p.color === 'string'
      && typeof p.size === 'string' && Array.isArray(p.batches);
    const fallback = snapshotComplete ? null : await stockLookup(p.variantId);
    const productName = typeof p.productName === 'string' ? p.productName : fallback?.productName;
    const color = typeof p.color === 'string' ? p.color : fallback?.color;
    const size = typeof p.size === 'string' ? p.size : fallback?.size;
    const sku = typeof p.sku === 'string' ? p.sku : fallback?.sku;
    const batches = (Array.isArray(p.batches) ? p.batches : fallback?.batches || [])
      .filter((batch: any) => batch && Number(batch.remainingQty) > 0);
    const batchText = batches.length
      ? batches.map((batch: any, index: number) => `${index ? '        ' : ''}${String(batch.batchCode)} — ${Number(batch.remainingQty)} pcs fisik`).join('\n')
      : 'Tidak ada batch bersisa';
    const skuFallback = !productName && sku ? `\nSKU: ${sku}` : '';

    return `${p.state === 'OUT' ? 'Stok Habis' : 'Stok Menipis'}

Nama Produk : ${productName ?? '-'}${skuFallback}
Warna : ${color ?? '-'}
Ukuran : ${size ?? '-'}
Stok Tersedia : ${p.available} pcs
Batch : ${batchText}`;
  }
  if (job.event_type === 'NET_PROFIT_NEGATIVE') return `Peringatan keuntungan bersih bulan berjalan negatif: ${rupiah(job.payload.netProfit)}`;
  throw new Error(`Jenis notifikasi ${job.event_type} tidak dikenal.`);
}

export async function sendTelegramMessage(bot: string, chat: string, text: string, fetcher: typeof fetch = fetch) {
  const response = await fetcher(`https://api.telegram.org/bot${bot}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }), signal: AbortSignal.timeout(15000) });
  let body: any = null;
  try { body = await response.json(); } catch { }
  if (!response.ok || body?.ok !== true) {
    const description = typeof body?.description === 'string' ? `: ${body.description}` : '';
    throw new Error(`Telegram HTTP ${response.status}${description}`);
  }
  return body.result;
}

const databaseQueue: TelegramQueueAdapter = {
  async claim(worker, limit, leaseSeconds) {
    const { data, error } = await getSupabaseAdmin().rpc('claim_telegram_jobs', { p_worker: worker, p_limit: limit, p_lease_seconds: leaseSeconds });
    if (error) throw new Error(`Antrean Telegram tidak dapat diklaim: ${error.message}`);
    return (data || []) as TelegramOutboxJob[];
  },
  async sent(id, worker) {
    const { data, error } = await getSupabaseAdmin().from('telegram_outbox').update({ status: 'SENT', sent_at: new Date().toISOString(), lease_until: null, leased_by: null, last_error: null }).eq('id', id).eq('status', 'PROCESSING').eq('leased_by', worker).select('id').maybeSingle();
    if (error) throw error;
    return Boolean(data);
  },
  async retry(id, worker, attempts, errorMessage, terminal) {
    const delay = Math.min(3_600_000, 30_000 * 2 ** Math.max(0, attempts - 1));
    const { data, error } = await getSupabaseAdmin().from('telegram_outbox').update({ status: terminal ? 'FAILED' : 'PENDING', available_at: new Date(Date.now() + delay).toISOString(), lease_until: null, leased_by: null, last_error: errorMessage }).eq('id', id).eq('status', 'PROCESSING').eq('leased_by', worker).select('id').maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }
};

export async function runOwnerNotificationCycle(options: {
  queue?: TelegramQueueAdapter;
  fetcher?: typeof fetch;
  renderer?: (job: TelegramOutboxJob) => Promise<string>;
  bot?: string;
  chat?: string;
  workerId?: string;
} = {}) {
  const bot = options.bot ?? process.env.TELEGRAM_BOT_TOKEN?.trim() ?? '';
  const chat = options.chat ?? process.env.TELEGRAM_CHAT_ID?.trim() ?? '';
  if (!bot || !chat) return { claimed: 0, sent: 0, retried: 0, failed: 0, skipped: true };
  const queue = options.queue || databaseQueue;
  const worker = options.workerId || runtime.__defraTelegramWorkerId || `${process.pid}-${crypto.randomUUID()}`;
  const jobs = await queue.claim(worker, 5, 90);
  let sent = 0, retried = 0, failed = 0;
  for (const job of jobs) {
    // Versi lama tombol tes memasukkan TEST ke outbox. Jangan kirim backlog tes
    // ketika worker baru aktif; tombol terbaru mengirim langsung secara manual.
    if (job.event_type === 'TEST') {
      if (await queue.retry(job.id, worker, Math.max(job.attempts, 5), 'Pesan tes lama tidak dikirim otomatis. Jalankan tes manual dari pengaturan.', true)) failed++;
      continue;
    }
    try {
      const text = await (options.renderer || renderOwnerNotification)(job);
      await sendTelegramMessage(bot, chat, text, options.fetcher || fetch);
      if (await queue.sent(job.id, worker)) sent++;
    } catch (error) {
      const terminal = Number(job.attempts) >= 5;
      if (await queue.retry(job.id, worker, Number(job.attempts) || 1, sanitizeError(error, bot), terminal)) terminal ? failed++ : retried++;
    }
  }
  return { claimed: jobs.length, sent, retried, failed, skipped: false };
}

async function tick() {
  if (runtime.__defraTelegramWorkerBusy) return;
  runtime.__defraTelegramWorkerBusy = true;
  try {
    await runOwnerNotificationCycle();
    runtime.__defraTelegramWorkerError = null;
  } catch (error) { runtime.__defraTelegramWorkerError = sanitizeError(error, process.env.TELEGRAM_BOT_TOKEN?.trim()); }
  finally { runtime.__defraTelegramWorkerBusy = false; }
}

export async function getOwnerNotificationStatus() {
  const configured = Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim() && process.env.TELEGRAM_CHAT_ID?.trim());
  const db = getSupabaseAdmin();
  const statuses = ['PENDING', 'PROCESSING', 'FAILED'] as const;
  const counts = await Promise.all(statuses.map(async status => { const { count, error } = await db.from('telegram_outbox').select('*', { count: 'exact', head: true }).eq('status', status).neq('event_type', 'TEST'); if (error) throw error; return count || 0; }));
  const { data, error } = await db.from('telegram_outbox').select('last_error').eq('status', 'FAILED').neq('event_type', 'TEST').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  const pending = counts[0] + counts[1], lastError = data?.last_error || runtime.__defraTelegramWorkerError || null;
  const active = configured && Boolean(runtime.__defraTelegramWorker) && !lastError;
  return { configured, workerRunning: Boolean(runtime.__defraTelegramWorker), pending, failed: counts[2], lastError, state: !configured || lastError ? 'PROBLEM' : pending ? 'WAITING' : active ? 'ACTIVE' : 'PROBLEM' };
}

export function startOwnerNotificationWorker() {
  if (process.env.TELEGRAM_WORKER_DISABLED === 'true' || runtime.__defraTelegramWorker) return;
  runtime.__defraTelegramWorkerId = runtime.__defraTelegramWorkerId || `${process.pid}-${crypto.randomUUID()}`;
  runtime.__defraTelegramWorker = setInterval(() => void tick(), 5_000);
  runtime.__defraTelegramWorker.unref();
  void tick();
}

export function stopOwnerNotificationWorker() {
  if (runtime.__defraTelegramWorker) clearInterval(runtime.__defraTelegramWorker);
  delete runtime.__defraTelegramWorker;
  delete runtime.__defraTelegramWorkerId;
  runtime.__defraTelegramWorkerBusy = false;
}
