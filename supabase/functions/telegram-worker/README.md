# Telegram worker production

Deploy dari root project:

```powershell
supabase functions deploy telegram-worker --no-verify-jwt
supabase secrets set TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... TELEGRAM_CRON_SECRET=... SB_SECRET_KEY=...
```

Gunakan nilai acak yang sama untuk `TELEGRAM_CRON_SECRET` dan Vault secret
`telegram_worker_cron_secret`. Buat Vault secret `telegram_worker_url` dengan nilai:

```text
https://PROJECT_REF.supabase.co/functions/v1/telegram-worker
```

Jalankan migration `20261014_011_telegram_edge_cron.sql` setelah kedua Vault secret
tersedia. Di Vercel, set `TELEGRAM_WORKER_DISABLED=true`; localhost tetap memakai
worker Node existing. Jangan commit nilai secret.
