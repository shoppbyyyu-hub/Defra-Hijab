import { getSupabaseAdmin } from './supabase.ts';

const runtime=globalThis as typeof globalThis&{__defraMaintenanceWorker?:NodeJS.Timeout};

async function runMaintenance(){
  const db=getSupabaseAdmin();
  await db.rpc('release_expired_reservations',{p_limit:100});
  await db.rpc('check_monthly_negative_profit');
}

export function startMaintenanceWorker(){
  if(runtime.__defraMaintenanceWorker)return;
  runtime.__defraMaintenanceWorker=setInterval(()=>void runMaintenance().catch(()=>{}),60_000);
  runtime.__defraMaintenanceWorker.unref();
  void runMaintenance().catch(()=>{});
}

export function stopMaintenanceWorker(){
  if(!runtime.__defraMaintenanceWorker)return;
  clearInterval(runtime.__defraMaintenanceWorker);
  delete runtime.__defraMaintenanceWorker;
}
