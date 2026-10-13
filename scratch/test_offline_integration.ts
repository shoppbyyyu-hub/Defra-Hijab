import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { calculateShippingCost, resetRajaOngkirCache, setMockFetch } from '../src/server/rajaongkirService.ts';
import { generateDynamicQRISPayload } from '../src/utils/qris.ts';

const baseQris='0002010102115204569753033605802ID5905DEFRA6005DEPOK6304B6AC';
const generated=generateDynamicQRISPayload(baseQris,1_999_999);
assert.equal(generated.decoded.amount,1_999_999);
assert.equal(generated.decoded.crc.isValid,true);

resetRajaOngkirCache();
let calls=0;
setMockFetch(async()=>{calls++;return {ok:true,status:200,json:async()=>({data:[
  {name:'JNE',costs:[
    {service:'REG',description:'Reguler',cost:[{value:12000,etd:'2-3'}]},
    {service:'YES',description:'Yakin Esok Sampai',cost:[{value:22000,etd:'1'}]},
    {service:'JTR',description:'Trucking',cost:[{value:30000,etd:'3-4'}]}
  ]}
]})};});
const [a,b]=await Promise.all([
  calculateShippingCost('origin','destination',1000,'mock-key'),
  calculateShippingCost('origin','destination',1000,'mock-key')
]);
assert.equal(calls,1,'request identik harus single-flight');
assert.deepEqual(a.services?.map(x=>x.service),['REG','YES']);
assert.deepEqual(b.services?.map(x=>x.service),['REG','YES']);
setMockFetch(null);

const sql=await Promise.all(['001_core_schema','002_security','003_transactions'].map(x=>readFile(new URL(`../supabase/migrations/20261013_${x}.sql`,import.meta.url),'utf8')));
const joined=sql.join('\n');
for(const required of ['shipping_origin_id','row level security','upsert_checkout_reservation','finalize_checkout_order','claim_telegram_jobs','for update skip locked'])assert.ok(joined.toLowerCase().includes(required));
assert.ok(!/DefraOwnerSecure|RAJAONGKIR_ORIGIN_CITY_ID|\b153\b/.test(joined));
console.log('Offline checks passed: QRIS amount/CRC, mocked JNE filter/single-flight, migration invariants.');
