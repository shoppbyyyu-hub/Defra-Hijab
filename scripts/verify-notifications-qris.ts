import {
  DEFAULT_DEFRA_QRIS_STATIC_PAYLOAD,
  generateDynamicQRISPayload,
  validateBaseQRISPayload
} from '../src/utils/qris.ts';
import {
  runOwnerNotificationCycle,
  renderOwnerNotification,
  sendTelegramMessage,
  type TelegramOutboxJob,
  type TelegramQueueAdapter
} from '../src/server/ownerNotifications.ts';

const base=validateBaseQRISPayload(DEFAULT_DEFRA_QRIS_STATIC_PAYLOAD);
const generated=generateDynamicQRISPayload(DEFAULT_DEFRA_QRIS_STATIC_PAYLOAD,1_999_000);
if(base.merchantName!=="D'efra Hijab, Fashion"||base.amount!==null)throw new Error('Payload dasar QRIS berubah.');
if(generated.decoded.merchantName!==base.merchantName||generated.decoded.amount!==1_999_000||!generated.decoded.crc.isValid)throw new Error('QRIS dinamis tidak valid.');

type MemoryJob=TelegramOutboxJob&{event_key:string;status:'PENDING'|'PROCESSING'|'SENT'|'FAILED';available:number;leaseUntil:number;leasedBy:string|null;lastError:string|null};
class MemoryQueue implements TelegramQueueAdapter{
  jobs:MemoryJob[]=[];
  enqueue(job:Omit<MemoryJob,'status'|'available'|'leaseUntil'|'leasedBy'|'lastError'>){
    if(this.jobs.some(item=>item.event_key===job.event_key))return false;
    this.jobs.push({...job,status:'PENDING',available:0,leaseUntil:0,leasedBy:null,lastError:null});return true;
  }
  async claim(worker:string,limit:number,leaseSeconds:number){
    const now=Date.now();
    const rows=this.jobs.filter(job=>job.available<=now&&(job.status==='PENDING'||(job.status==='PROCESSING'&&job.leaseUntil<now))).slice(0,limit);
    for(const job of rows){job.status='PROCESSING';job.leasedBy=worker;job.leaseUntil=now+leaseSeconds*1000;job.attempts++;}
    return rows.map(job=>({...job}));
  }
  async sent(id:string,worker:string){const job=this.jobs.find(item=>item.id===id&&item.status==='PROCESSING'&&item.leasedBy===worker);if(!job)return false;job.status='SENT';job.leasedBy=null;return true;}
  async retry(id:string,worker:string,_attempts:number,error:string,terminal:boolean){const job=this.jobs.find(item=>item.id===id&&item.status==='PROCESSING'&&item.leasedBy===worker);if(!job)return false;job.status=terminal?'FAILED':'PENDING';job.available=Date.now()+30_000;job.leasedBy=null;job.lastError=error;return true;}
}

const okFetch:typeof fetch=async()=>new Response(JSON.stringify({ok:true,result:{message_id:1}}),{status:200,headers:{'Content-Type':'application/json'}});
const rejectedFetch:typeof fetch=async()=>new Response(JSON.stringify({ok:false,description:'mock rejection'}),{status:200,headers:{'Content-Type':'application/json'}});
const renderer=async(job:TelegramOutboxJob)=>`Mock ${job.event_type}`;

const queue=new MemoryQueue();
if(!queue.enqueue({id:'new',event_key:'order:1',event_type:'NEW_ORDER',payload:{},attempts:0}))throw new Error('Job baru gagal dibuat.');
if(queue.enqueue({id:'duplicate',event_key:'order:1',event_type:'NEW_ORDER',payload:{},attempts:0}))throw new Error('Deduplikasi event gagal.');
await runOwnerNotificationCycle({queue,fetcher:okFetch,renderer,bot:'mock-token',chat:'123',workerId:'worker-a'});
if(queue.jobs[0].status!=='SENT')throw new Error('Job baru tidak menjadi SENT.');

queue.enqueue({id:'retry',event_key:'return:1',event_type:'NEW_RETURN',payload:{},attempts:0});
await runOwnerNotificationCycle({queue,fetcher:rejectedFetch,renderer,bot:'mock-token',chat:'123',workerId:'worker-a'});
if(queue.jobs.find(job=>job.id==='retry')?.status!=='PENDING')throw new Error('Job gagal tidak dijadwalkan ulang.');

queue.enqueue({id:'locked',event_key:'stock:1',event_type:'LOW_STOCK',payload:{},attempts:0});
const locked=queue.jobs.find(job=>job.id==='locked')!;locked.status='PROCESSING';locked.leasedBy='worker-old';locked.leaseUntil=Date.now()+60_000;
await runOwnerNotificationCycle({queue,fetcher:okFetch,renderer,bot:'mock-token',chat:'123',workerId:'worker-new'});
if(locked.status!=='PROCESSING'||locked.leasedBy!=='worker-old')throw new Error('Lease aktif direbut worker lain.');
locked.leaseUntil=Date.now()-1;
await runOwnerNotificationCycle({queue,fetcher:okFetch,renderer,bot:'mock-token',chat:'123',workerId:'worker-new'});
if(queue.jobs.find(job=>job.id==='locked')?.status!=='SENT')throw new Error('Job tidak pulih setelah lease kedaluwarsa.');

const chats:string[]=[];
const chatFetch:typeof fetch=async(_url,init)=>{chats.push(String(JSON.parse(String(init?.body)).chat_id));return new Response(JSON.stringify({ok:true,result:{message_id:1}}),{status:200,headers:{'Content-Type':'application/json'}});};
for(const id of ['123456789','-123456789','-1001234567890'])await sendTelegramMessage('mock-token',id,'Tes mock',chatFetch);

const stockSnapshotText=await renderOwnerNotification({id:'stock-new',event_type:'LOW_STOCK',attempts:0,payload:{
  variantId:'variant-1',sku:'DFR-001',productName:'Hijab Sutra',color:'Rose',size:'M',available:1,state:'LOW',
  batches:[{batchCode:'BATCH-LAMA',remainingQty:2},{batchCode:'BATCH-BARU',remainingQty:3}]
}},async()=>{throw new Error('Snapshot baru tidak boleh melakukan lookup.');});
if(!stockSnapshotText.includes('Stok Tersedia : 1 pcs')||!stockSnapshotText.includes('Batch : BATCH-LAMA — 2 pcs fisik')||!stockSnapshotText.includes('BATCH-BARU — 3 pcs fisik'))throw new Error('Snapshot LOW_STOCK baru tidak dirender lengkap.');

let legacyLookupCount=0;
const legacyStockText=await renderOwnerNotification({id:'stock-old',event_type:'LOW_STOCK',attempts:0,payload:{variantId:'variant-old',sku:'DFR-OLD',available:0,state:'OUT'}},async()=>{
  legacyLookupCount++;
  return {sku:'DFR-OLD',productName:'Hijab Lama',color:'Hitam',size:'L',batches:[]};
});
if(legacyLookupCount!==1||!legacyStockText.includes('Hijab Lama')||!legacyStockText.includes('Tidak ada batch bersisa'))throw new Error('Fallback job LOW_STOCK lama gagal.');

const deletedVariantText=await renderOwnerNotification({id:'stock-deleted',event_type:'LOW_STOCK',attempts:0,payload:{variantId:'variant-deleted',sku:'DFR-DELETED',available:0,state:'OUT'}},async()=>null);
if(!deletedVariantText.includes('SKU: DFR-DELETED')||!deletedVariantText.includes('Tidak ada batch bersisa'))throw new Error('Fallback SKU variasi terhapus gagal.');

console.log(JSON.stringify({qris:{merchant:base.merchantName,amount:generated.decoded.amount,crc:generated.decoded.crc.isValid},telegram:{newMessage:true,retry:true,restartRecovery:true,lockedJob:true,deduplication:true,chatTypes:chats.length,lowStockSnapshot:true,legacyFallback:true,deletedVariantSku:true}}));
