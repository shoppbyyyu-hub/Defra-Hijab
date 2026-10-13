# Setup Supabase Defra Hijab

1. Buat project Supabase khusus untuk lingkungan yang dituju. Untuk tes integrasi, gunakan project terpisah dari produksi.
2. Buka SQL Editor dan jalankan berurutan:
   - `migrations/20261013_001_core_schema.sql`
   - `migrations/20261013_002_security.sql`
   - `migrations/20261013_003_transactions.sql`
   - Migration berikutnya sesuai urutan nama file sampai `20261014_011_telegram_edge_cron.sql`.
3. Di Authentication, matikan pendaftaran publik. Buat satu user owner melalui Dashboard Authentication menggunakan email resmi dan password kuat.
4. Salin UUID user tersebut, lalu jalankan sekali melalui SQL Editor:

   ```sql
   insert into public.owner_profiles(user_id, role)
   values ('UUID-USER-DARI-AUTH', 'OWNER');
   ```

5. Salin `.env.example` menjadi `.env`. Isi `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_`) dan `SUPABASE_SECRET_KEY` (`sb_secret_`). Secret hanya boleh berada di server dan tidak boleh memakai awalan `VITE_`. Legacy `SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` masih diterima sebagai fallback, tetapi tidak diwajibkan.
6. Bucket `catalog-media`, `payment-proofs`, `return-proofs`, dan `expense-documents` dibuat oleh migrasi. Hanya katalog yang publik; bukti memakai signed URL singkat.
7. Masuk melalui `/Entrance`, lalu isi alamat asal resmi, pembayaran, kategori, produk, stok, dan konten. Database kosong sengaja tidak membuat data demo.

## Worker Telegram production (Vercel)

1. Deploy `functions/telegram-worker` sebagai Supabase Edge Function dengan JWT gateway dimatikan; endpoint tetap dilindungi `TELEGRAM_CRON_SECRET`.
2. Pasang Edge secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_CRON_SECRET`, dan `SB_SECRET_KEY` berisi key backend `sb_secret_`.
3. Di Supabase Vault, buat `telegram_worker_url` berisi URL Edge Function dan `telegram_worker_cron_secret` berisi nilai yang sama dengan `TELEGRAM_CRON_SECRET`.
4. Jalankan migration `20261014_011_telegram_edge_cron.sql`. Cron akan memanggil worker setiap 10 detik.
5. Set `TELEGRAM_WORKER_DISABLED=true` pada Vercel agar timer Node lokal tidak dipakai oleh Function serverless.

Nilai secret tidak boleh dimasukkan ke migration, source, atau repository Git.

Jangan menjalankan migrasi ini pada database berisi tabel lama bernama sama tanpa review skema. Migrasi tidak memakai `DROP` atau `TRUNCATE`, sehingga konflik nama berhenti dengan aman dan perlu dimigrasikan secara eksplisit.
