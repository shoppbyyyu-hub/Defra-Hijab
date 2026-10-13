-- Jadwal worker Telegram production. Secret dan URL tidak disimpan di migration.
-- Sebelum aktif, buat Vault secrets: telegram_worker_url dan telegram_worker_cron_secret.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.invoke_telegram_edge_worker()
returns bigint
language plpgsql
security definer
set search_path=public,vault,net
as $$
declare
  worker_url text;
  worker_secret text;
  request_id bigint;
begin
  select decrypted_secret into worker_url from vault.decrypted_secrets where name='telegram_worker_url' limit 1;
  select decrypted_secret into worker_secret from vault.decrypted_secrets where name='telegram_worker_cron_secret' limit 1;
  if nullif(worker_url,'') is null or nullif(worker_secret,'') is null then
    raise warning 'Telegram worker belum dijadwalkan: Vault secret belum lengkap.';
    return null;
  end if;
  select net.http_post(
    url:=worker_url,
    headers:=jsonb_build_object('Content-Type','application/json','x-defra-cron-secret',worker_secret),
    body:='{}'::jsonb,
    timeout_milliseconds:=20000
  ) into request_id;
  return request_id;
end $$;

revoke all on function public.invoke_telegram_edge_worker() from public;

select cron.schedule(
  'defra-telegram-worker',
  '10 seconds',
  $cron$select public.invoke_telegram_edge_worker();$cron$
);
