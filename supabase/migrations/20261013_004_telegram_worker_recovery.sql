-- Memastikan job yang ditinggalkan worker dapat pulih setelah lease habis,
-- dan job yang sudah mencapai batas retry tidak tertahan selamanya.
create or replace function public.claim_telegram_jobs(
  p_worker text,
  p_limit integer default 10,
  p_lease_seconds integer default 90
)
returns setof public.telegram_outbox
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.telegram_outbox
     set status='FAILED',
         lease_until=null,
         leased_by=null,
         last_error=coalesce(last_error,'Batas percobaan pengiriman tercapai.')
   where attempts>=5
     and available_at<=now()
     and (status='PENDING' or (status='PROCESSING' and lease_until<now()));

  return query
  update public.telegram_outbox o
     set status='PROCESSING',
         leased_by=p_worker,
         lease_until=now()+make_interval(secs=>greatest(15,p_lease_seconds)),
         attempts=attempts+1
   where o.id in (
     select id
       from public.telegram_outbox
      where available_at<=now()
        and attempts<5
        and (status='PENDING' or (status='PROCESSING' and lease_until<now()))
      order by created_at
      for update skip locked
      limit greatest(1,least(p_limit,50))
   )
  returning o.*;
end $$;

revoke all on function public.claim_telegram_jobs(text,integer,integer) from public;
