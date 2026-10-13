-- Memperluas tabel existing tanpa menghapus konten YouTube lama.
alter table public.community_reels add column if not exists provider text;
alter table public.community_reels add column if not exists source_url text;
alter table public.community_reels add column if not exists external_id text;

update public.community_reels
   set provider=coalesce(provider,'YOUTUBE'),
       external_id=coalesce(external_id,youtube_video_id),
       source_url=coalesce(source_url,'https://www.youtube.com/watch?v='||youtube_video_id)
 where provider is null or external_id is null or source_url is null;

alter table public.community_reels alter column title drop not null;
alter table public.community_reels alter column youtube_video_id drop not null;
alter table public.community_reels alter column provider set not null;
alter table public.community_reels alter column source_url set not null;
alter table public.community_reels alter column external_id set not null;
do $$ begin
  if not exists(select 1 from pg_constraint where conname='community_reels_provider_check' and conrelid='public.community_reels'::regclass) then
    alter table public.community_reels add constraint community_reels_provider_check check(provider in ('YOUTUBE','INSTAGRAM','TIKTOK')) not valid;
  end if;
end $$;
alter table public.community_reels validate constraint community_reels_provider_check;
create unique index if not exists community_reels_provider_external_uidx on public.community_reels(provider,external_id);
create index if not exists campaign_gallery_public_order_idx on public.campaign_gallery(is_active,sort_order);
create index if not exists community_reels_public_order_idx on public.community_reels(is_active,sort_order);
