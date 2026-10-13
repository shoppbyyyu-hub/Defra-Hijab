import crypto from 'crypto';
import { getSupabaseAdmin, publicStorageUrl } from './supabase.ts';

const fail = (error: { message: string } | null) => { if (error) throw new Error(error.message); };
const num = (v: unknown) => Number(v || 0);

function mapSettings(row: any) {
  return {
    whatsappNumber: row?.whatsapp_number || '', originProvince: row?.origin_province || '',
    originCity: row?.origin_city || '', originCityId: row?.origin_destination_id || '', originLabel: row?.origin_label || '',
    originSubdistrict: row?.origin_subdistrict || '', originPostalCode: row?.origin_postal_code || '',
    originAddress: row?.origin_address || '', qrisEnabled: Boolean(row?.qris_enabled),
    bankTransferEnabled: Boolean(row?.bank_transfer_enabled), bankName: row?.bank_name || '',
    bankAccountNumber: row?.bank_account_number || '', bankAccountHolder: row?.bank_account_holder || '',
    lowStockThreshold: num(row?.low_stock_threshold), telegramEnabled: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    telegramChatId: '', allowVoucherOnDiscountedProducts: row?.allow_voucher_on_discounted_products !== false,
    packagingWeightGrams: num(row?.packaging_weight_grams), packagingCost: num(row?.packaging_cost)
  };
}

function mapProduct(row: any, stock: Map<string,{physical:number;reserved:number}>=new Map(), exposeCosts=false) {
  const variants = (row.product_variants || []).filter((v:any)=>v.is_active!==false).map((v: any) => ({
    id:v.id,productId:row.id,color:v.product_colors?.name || '',colorHex:v.product_colors?.hex || '#000000',
    size:v.product_sizes?.name || '',sku:v.sku,isActive:v.is_active,batches:exposeCosts?(v.inventory_batches || []).map((b:any)=>({
      id:b.id,batchCode:b.batch_code,initialQty:b.initial_qty,remainingQty:b.remaining_qty,costPerUnit:num(b.cost_per_unit),arrivalDate:b.arrival_date
    })):[],physicalStock:stock.get(v.id)?.physical??(v.inventory_batches||[]).reduce((n:number,b:any)=>n+Number(b.remaining_qty),0),activeReservations:stock.get(v.id)?.reserved||0,orderAllocations:0,availableStock:Math.max(0,(stock.get(v.id)?.physical??(v.inventory_batches||[]).reduce((n:number,b:any)=>n+Number(b.remaining_qty),0))-(stock.get(v.id)?.reserved||0))
  }));
  const colors=(row.product_colors || []).filter((c:any)=>c.is_active!==false).sort((a:any,b:any)=>a.sort_order-b.sort_order);
  const galleries=colors.map((c:any)=>({color:c.name,colorHex:c.hex,images:(c.product_color_images||[]).sort((a:any,b:any)=>a.sort_order-b.sort_order).map((i:any)=>publicStorageUrl(i.storage_path))}));
  return {id:row.id,categoryId:row.category_id,categoryName:row.categories?.name,name:row.name,slug:row.slug,description:row.description,
    basePrice:num(row.base_price),discountPrice:row.discount_price==null?undefined:num(row.discount_price),weightGrams:row.weight_grams,
    imageUrl:galleries[0]?.images[0]||'',images:galleries.flatMap((g:any)=>g.images),sizes:(row.product_sizes||[]).filter((s:any)=>s.is_active!==false).sort((a:any,b:any)=>a.sort_order-b.sort_order).map((s:any)=>s.name),
    colors:colors.map((c:any)=>({color:c.name,colorHex:c.hex})),colorGalleries:galleries,variants,isActive:row.is_active,isArchived:row.is_archived,
    totalSoldUnits:num(row.total_sold_units),createdAt:row.created_at,updatedAt:row.updated_at};
}

const productFields='id,category_id,name,slug,description,base_price,discount_price,weight_grams,is_active,is_archived,created_at,updated_at';
const publicProductSelect=`${productFields},categories(name),product_sizes(id,name,sort_order,is_active),product_colors(id,name,hex,sort_order,is_active,product_color_images(storage_path,sort_order)),product_variants(id,product_id,color_id,size_id,sku,is_active,product_colors(name,hex),product_sizes(name))`;
const adminProductSelect=`${productFields},categories(name),product_sizes(id,name,sort_order,is_active),product_colors(id,name,hex,sort_order,is_active,product_color_images(id,storage_path,sort_order)),product_variants(id,product_id,color_id,size_id,sku,is_active,product_colors(name,hex),product_sizes(name),inventory_batches(id,batch_code,initial_qty,remaining_qty,cost_per_unit,arrival_date))`;

async function stockForProducts(rows:any[]){
  const variantIds=rows.flatMap((row:any)=>(row.product_variants||[]).map((variant:any)=>variant.id));
  if(!variantIds.length)return new Map<string,{physical:number;reserved:number}>();
  const {data,error}=await getSupabaseAdmin().from('variant_stock').select('variant_id,physical_stock,active_reservations').in('variant_id',variantIds);
  fail(error);
  return new Map((data||[]).map((x:any)=>[x.variant_id,{physical:Number(x.physical_stock),reserved:Number(x.active_reservations)}]));
}

export const repository = {
  async settings(raw=false) { const {data,error}=await getSupabaseAdmin().from('store_settings').select('*').eq('id',true).maybeSingle(); fail(error); return raw?data:mapSettings(data); },
  async publicSettings() { const {data,error}=await getSupabaseAdmin().from('store_settings').select('whatsapp_number,qris_enabled,bank_transfer_enabled,bank_name,bank_account_number,bank_account_holder').eq('id',true).maybeSingle();fail(error);return {whatsappNumber:data?.whatsapp_number||'',qrisEnabled:Boolean(data?.qris_enabled),bankTransferEnabled:Boolean(data?.bank_transfer_enabled),bankName:data?.bank_name||'',bankAccountNumber:data?.bank_account_number||'',bankAccountHolder:data?.bank_account_holder||''}; },
  async categories(admin=false) { let q=getSupabaseAdmin().from('categories').select('*').order('sort_order'); if(!admin) q=q.eq('is_active',true); const {data,error}=await q; fail(error); return (data||[]).map((x:any)=>({id:x.id,name:x.name,slug:x.slug,imageUrl:publicStorageUrl(x.image_path),sortOrder:x.sort_order,isActive:x.is_active})); },
  async products(admin=false,includeStock=true) { let q=getSupabaseAdmin().from('products').select(admin?adminProductSelect:publicProductSelect).order('created_at',{ascending:false}); if(!admin) q=q.eq('is_active',true).eq('is_archived',false); const {data,error}=await q; fail(error);const rows=data||[],sm=includeStock?await stockForProducts(rows):new Map();return rows.map(x=>mapProduct(x,sm,admin)); },
  async product(id:string,admin=false) { let q=getSupabaseAdmin().from('products').select(admin?adminProductSelect:publicProductSelect).or(`id.eq.${id},slug.eq.${id}`);if(!admin)q=q.eq('is_active',true).eq('is_archived',false);const {data,error}=await q.maybeSingle();fail(error);if(!data)return null;const sm=await stockForProducts([data]);return mapProduct(data,sm,admin); },
  async content(admin=false) { const db=getSupabaseAdmin(); let hq=db.from('hero_banners').select('*');let gq=db.from('campaign_gallery').select('*').order('sort_order');let rq=db.from('community_reels').select('*').order('sort_order');if(!admin){hq=hq.eq('is_active',true);gq=gq.eq('is_active',true);rq=rq.eq('is_active',true);}const [h,g,r]=await Promise.all([hq,gq,rq]);
    fail(h.error);fail(g.error);fail(r.error);return {heroBanners:(h.data||[]).map((x:any)=>({id:x.id,desktopImageUrl:publicStorageUrl(x.desktop_path),mobileImageUrl:publicStorageUrl(x.mobile_path),focalX:num(x.focal_x),focalY:num(x.focal_y),mobileFocalX:num(x.mobile_focal_x),mobileFocalY:num(x.mobile_focal_y),isActive:x.is_active,createdAt:x.created_at})),campaignGallery:(g.data||[]).map((x:any)=>({id:x.id,imageUrl:publicStorageUrl(x.storage_path),aspectRatio:x.aspect_ratio,sortOrder:x.sort_order,isActive:x.is_active})),communityReels:(r.data||[]).map((x:any)=>({id:x.id,provider:x.provider||'YOUTUBE',sourceUrl:x.source_url||`https://www.youtube.com/watch?v=${x.youtube_video_id}`,externalId:x.external_id||x.youtube_video_id,title:x.title||undefined,youtubeVideoId:x.youtube_video_id||undefined,posterImageUrl:x.poster_path?publicStorageUrl(x.poster_path):undefined,sortOrder:x.sort_order,isActive:x.is_active}))}; },
  async reservation(id:string,token:string) { const hash=crypto.createHash('sha256').update(token).digest('hex'); const {data,error}=await getSupabaseAdmin().from('checkout_reservations').select('*,reservation_items(*)').eq('id',id).eq('session_token_hash',hash).maybeSingle(); fail(error); return data; },
  async reserve(args:any) { const {data,error}=await getSupabaseAdmin().rpc('upsert_checkout_reservation',args); fail(error); return data; },
  async finalize(args:any) { const {data,error}=await getSupabaseAdmin().rpc('finalize_checkout_order',args); fail(error); return data; },
  async audit(action:string,entityType:string,entityId:string,actorId?:string,details:any={}) { await getSupabaseAdmin().from('audit_logs').insert({actor_type:'ADMIN',actor_id:actorId,action,entity_type:entityType,entity_id:entityId,details}); }
};
