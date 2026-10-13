<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Defra Hijab

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/24b25965-b2d6-4c7b-923a-5dee4272d40b

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Salin nama konfigurasi dari `.env.example` ke `.env` dan isi nilainya di server.
3. Jalankan backend dan frontend development:
   `npm run dev`

Worker Telegram ikut dimulai oleh backend yang sama dan memeriksa outbox Supabase setiap 5 detik. Jangan menjalankan proses worker terpisah bersamaan dengan backend ini. `TELEGRAM_WORKER_DISABLED=true` hanya digunakan untuk pengujian yang tidak boleh mengirim pesan live.

## Deployment

1. Jalankan `npm run build`.
2. Jalankan satu atau beberapa proses `npm run start` dengan ENV server yang sama.
3. Setiap proses boleh menjalankan worker; fungsi klaim Supabase menggunakan row locking, lease 90 detik, dan `skip locked`, sehingga satu job hanya diklaim satu worker pada satu waktu.
4. Pastikan migration Supabase, termasuk `telegram_outbox` dan RPC `claim_telegram_jobs`, sudah diterapkan.
5. Jangan menjalankan `vite preview` sebagai backend produksi karena perintah itu hanya menyajikan hasil build dan tidak menjalankan API/worker.

Pesan yang gagal dicoba ulang dengan jeda bertahap sampai lima percobaan. Job berstatus `PROCESSING` dapat diklaim kembali setelah lease habis jika proses berhenti mendadak.
