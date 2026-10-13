// @ts-nocheck -- File ini dijalankan oleh Supabase Edge Runtime (Deno), bukan Node/Vite.
const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '') || '';
const supabaseKey = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SB_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const chatId = Deno.env.get('TELEGRAM_CHAT_ID') || '';
const cronSecret = Deno.env.get('TELEGRAM_CRON_SECRET') || '';
const workerId = `edge-${crypto.randomUUID()}`;

const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' };
const rupiah = (value: unknown) => `Rp${Number(value || 0).toLocaleString('id-ID')}`;
const cleanError = (error: unknown) => String(error instanceof Error ? error.message : error || 'Kesalahan tidak diketahui')
  .replaceAll(botToken, '[TOKEN DISEMBUNYIKAN]').replace(/https?:\/\/\S+/gi, '[URL DISEMBUNYIKAN]').slice(0, 500);

async function db(path: string, init: RequestInit = {}) {
  const response = await fetch(`${supabaseUrl}${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Database ${response.status}: ${body?.message || body?.error || 'permintaan ditolak'}`);
  return body;
}

async function lowStockFallback(payload: Record<string, unknown>) {
  if (!payload.variantId) return null;
  const variants = await db(`/rest/v1/product_variants?id=eq.${encodeURIComponent(String(payload.variantId))}&select=sku,product_id,color_id,size_id&limit=1`);
  const variant = variants?.[0];
  if (!variant) return null;
  const [products, colors, sizes, batches] = await Promise.all([
    db(`/rest/v1/products?id=eq.${variant.product_id}&select=name&limit=1`),
    db(`/rest/v1/product_colors?id=eq.${variant.color_id}&select=name&limit=1`),
    db(`/rest/v1/product_sizes?id=eq.${variant.size_id}&select=name&limit=1`),
    db(`/rest/v1/inventory_batches?variant_id=eq.${encodeURIComponent(String(payload.variantId))}&remaining_qty=gt.0&select=batch_code,remaining_qty&order=arrival_date.asc,created_at.asc,id.asc`)
  ]);
  return { sku: variant.sku, productName: products?.[0]?.name, color: colors?.[0]?.name, size: sizes?.[0]?.name,
    batches: (batches || []).map((b: any) => ({ batchCode: b.batch_code, remainingQty: Number(b.remaining_qty) })) };
}

async function signedProof(payment: any) {
  if (!payment?.proof_bucket || !payment?.proof_path) return 'Tidak tersedia';
  const result = await db(`/storage/v1/object/sign/${encodeURIComponent(payment.proof_bucket)}/${payment.proof_path.split('/').map(encodeURIComponent).join('/')}`,
    { method: 'POST', body: JSON.stringify({ expiresIn: 3600 }) });
  return result?.signedURL ? `${supabaseUrl}/storage/v1${result.signedURL}` : 'Tidak tersedia';
}

async function signedReturnProof(proof:any){
  if(!proof?.storage_path)return null;
  const bucket=proof.bucket||'return-proofs';
  const result=await db(`/storage/v1/object/sign/${encodeURIComponent(bucket)}/${proof.storage_path.split('/').map(encodeURIComponent).join('/')}`,
    {method:'POST',body:JSON.stringify({expiresIn:3600})});
  return result?.signedURL?`${supabaseUrl}/storage/v1${result.signedURL}`:null;
}

async function renderReturn(payload:any){
  const rows=await db(`/rest/v1/return_requests?id=eq.${encodeURIComponent(String(payload.returnId))}&select=return_number,requested_resolution,reason_category,customer_notes,orders(order_number,customer_name,customer_email,customer_whatsapp,customer_birth_date,address_line,village,subdistrict,city,province,postal_code,voucher_code,subtotal,discount_amount,shipping_fee,total_amount,payment_method),return_items(quantity,order_items(product_name,color_name,size_name,unit_price)),return_proofs(bucket,storage_path)&limit=1`);
  const claim=rows?.[0];
  if(!claim)return `Pengajuan Retur Baru — Perlu Ditinjau\n\nNomor retur: ${payload.returnNumber||'-'}\nData pengajuan tidak lagi tersedia.`;
  const order=Array.isArray(claim.orders)?claim.orders[0]:claim.orders;
  if(!order)throw new Error('Pesanan retur tidak ditemukan.');
  const proofUrls=(await Promise.all((claim.return_proofs||[]).map(signedReturnProof))).filter(Boolean);
  const items=(claim.return_items||[]).map((item:any)=>{const ordered=Array.isArray(item.order_items)?item.order_items[0]:item.order_items;return `• ${ordered?.product_name||'-'} — ${ordered?.color_name||'-'} / ${ordered?.size_name||'-'} × ${Number(item.quantity)} (${rupiah(Number(ordered?.unit_price||0)*Number(item.quantity))})`;}).join('\n')||'• Tidak ada rincian barang';
  const reasons:any={WRONG_ITEM:'Barang yang diterima tidak sesuai',DAMAGED:'Barang rusak',DEFECTIVE:'Cacat jahitan atau kain'};
  const resolutions:any={REFUND:'Pengembalian dana',REPLACEMENT:'Penggantian produk'};
  const proofs=proofUrls.length?proofUrls.map((url:string,index:number)=>`${proofUrls.length>1?`${index+1}. `:''}${url}`).join('\n'):'Tidak dilampirkan';
  const address=[order.address_line,order.village,order.subdistrict,order.city,order.province,order.postal_code].filter(Boolean).join(', ');
  return `Pengajuan Retur Baru — Perlu Ditinjau\n\nNomor retur: ${claim.return_number}\nNomor pesanan: ${order.order_number}\nNama: ${order.customer_name}\nEmail: ${order.customer_email}\nWhatsApp: ${order.customer_whatsapp}\nTanggal lahir: ${order.customer_birth_date}\nAlamat: ${address}\n\n${items}\n\nVoucher: ${order.voucher_code||'-'}\nSubtotal: ${rupiah(order.subtotal)}\nDiskon: ${rupiah(order.discount_amount)}\nOngkir: ${rupiah(order.shipping_fee)}\nTotal: ${rupiah(order.total_amount)}\nMetode: ${order.payment_method}\n\nAlasan retur: ${reasons[claim.reason_category]||claim.reason_category}\nSolusi yang diminta: ${resolutions[claim.requested_resolution]||claim.requested_resolution}\nCatatan: ${claim.customer_notes}\nBukti retur (tautan sementara): ${proofs}`;
}

async function render(job: any) {
  const payload = job.payload || {};
  if (job.event_type === 'LOW_STOCK') {
    const complete = typeof payload.productName === 'string' && typeof payload.color === 'string'
      && typeof payload.size === 'string' && Array.isArray(payload.batches);
    const fallback = complete ? null : await lowStockFallback(payload);
    const productName = payload.productName ?? fallback?.productName;
    const sku = payload.sku ?? fallback?.sku;
    const batches = (Array.isArray(payload.batches) ? payload.batches : fallback?.batches || []).filter((b: any) => Number(b.remainingQty) > 0);
    const batchText = batches.length
      ? batches.map((b: any, i: number) => `${i ? '        ' : ''}${b.batchCode} — ${Number(b.remainingQty)} pcs fisik`).join('\n')
      : 'Tidak ada batch bersisa';
    return `${payload.state === 'OUT' ? 'Stok Habis' : 'Stok Menipis'}\n\nNama Produk : ${productName ?? '-'}${!productName && sku ? `\nSKU: ${sku}` : ''}\nWarna : ${payload.color ?? fallback?.color ?? '-'}\nUkuran : ${payload.size ?? fallback?.size ?? '-'}\nStok Tersedia : ${payload.available ?? '-'} pcs\nBatch : ${batchText}`;
  }
  if (job.event_type === 'NEW_RETURN') return renderReturn(payload);
  if (job.event_type === 'NET_PROFIT_NEGATIVE') return `Peringatan keuntungan bersih bulan berjalan negatif: ${rupiah(payload.netProfit)}`;
  if (job.event_type === 'NEW_ORDER') {
    const rows = await db(`/rest/v1/orders?id=eq.${encodeURIComponent(String(payload.orderId))}&select=*,order_items(*),payments(*)&limit=1`);
    const o = rows?.[0]; if (!o) throw new Error('Pesanan untuk notifikasi tidak ditemukan.');
    const proof = await signedProof(o.payments?.[0]);
    const items = (o.order_items || []).map((item: any) => `• ${item.product_name} — ${item.color_name} / ${item.size_name} × ${item.quantity} (${rupiah(item.line_total)})`).join('\n');
    return `Pesanan Baru — Perlu Verifikasi Pembayaran\n\nNomor: ${o.order_number}\nNama: ${o.customer_name}\nEmail: ${o.customer_email}\nWhatsApp: ${o.customer_whatsapp}\nTanggal lahir: ${o.customer_birth_date}\nAlamat: ${o.address_line}, ${o.village}, ${o.subdistrict}, ${o.city}, ${o.province} ${o.postal_code}\n\n${items}\n\nVoucher: ${o.voucher_code || '-'}\nSubtotal: ${rupiah(o.subtotal)}\nDiskon: ${rupiah(o.discount_amount)}\nOngkir: ${rupiah(o.shipping_fee)}\nTotal: ${rupiah(o.total_amount)}\nMetode: ${o.payment_method}\nBukti (tautan sementara): ${proof}`;
  }
  throw new Error(`Jenis notifikasi ${job.event_type} tidak dikenal.`);
}

async function updateJob(job: any, values: Record<string, unknown>) {
  return db(`/rest/v1/telegram_outbox?id=eq.${job.id}&status=eq.PROCESSING&leased_by=eq.${encodeURIComponent(workerId)}&select=id`,
    { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(values) });
}

async function cycle() {
  const jobs = await db('/rest/v1/rpc/claim_telegram_jobs', { method: 'POST', body: JSON.stringify({ p_worker: workerId, p_limit: 5, p_lease_seconds: 90 }) });
  let sent = 0, retried = 0, failed = 0;
  for (const job of jobs || []) {
    if (job.event_type === 'TEST') {
      await updateJob(job, { status: 'FAILED', lease_until: null, leased_by: null, last_error: 'Pesan tes lama tidak dikirim otomatis.' }); failed++; continue;
    }
    try {
      const text = await render(job);
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }), signal: AbortSignal.timeout(15000) });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok !== true) throw new Error(`Telegram HTTP ${response.status}: ${result?.description || 'pesan ditolak'}`);
      await updateJob(job, { status: 'SENT', sent_at: new Date().toISOString(), lease_until: null, leased_by: null, last_error: null }); sent++;
    } catch (error) {
      const terminal = Number(job.attempts) >= 5;
      const delay = Math.min(3_600_000, 30_000 * 2 ** Math.max(0, Number(job.attempts) - 1));
      await updateJob(job, { status: terminal ? 'FAILED' : 'PENDING', available_at: new Date(Date.now() + delay).toISOString(), lease_until: null, leased_by: null, last_error: cleanError(error) });
      terminal ? failed++ : retried++;
    }
  }
  return { claimed: jobs?.length || 0, sent, retried, failed };
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  if (!cronSecret || request.headers.get('x-defra-cron-secret') !== cronSecret) return new Response('Unauthorized', { status: 401 });
  if (!supabaseUrl || !supabaseKey || !botToken || !chatId) return Response.json({ error: 'Konfigurasi worker belum lengkap.' }, { status: 503 });
  try { return Response.json(await cycle()); }
  catch (error) { return Response.json({ error: cleanError(error) }, { status: 500 }); }
});
