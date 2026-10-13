import { createClient } from '@supabase/supabase-js';

const need = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} belum tersedia.`);
  return value;
};
let ref = need('SUPABASE_PROJECT_REF');
if (/^https?:/i.test(ref)) ref = new URL(ref).hostname.split('.')[0];
const token = need('SUPABASE_ACCESS_TOKEN');
const sql = `select status,return_message from cron.job_run_details
  where jobid=(select jobid from cron.job where jobname='defra-telegram-worker')
  order by start_time desc limit 1`;
const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql })
});
const runs = await response.json().catch(() => null);
if (!response.ok) throw new Error(`Cron verification HTTP ${response.status}.`);
const db = createClient(need('SUPABASE_URL'), need('SUPABASE_SECRET_KEY'), { auth: { persistSession: false } });
const { count, error } = await db.from('telegram_outbox').select('*', { count: 'exact', head: true }).in('status', ['PENDING', 'PROCESSING']);
if (error) throw error;
console.log(JSON.stringify({ cronRunStatus: runs?.[0]?.status || null, cronReturned: Boolean(runs?.[0]?.return_message), pendingOrProcessing: count || 0 }));
