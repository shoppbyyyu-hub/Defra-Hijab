import express from 'express';
import { apiRouter } from '../src/server/api.ts';

const app = express();
app.set('trust proxy', 1);

// Vercel mengarahkan /api/:path* ke satu Function ini. Pulihkan path asli
// sebelum menyerahkannya ke router bisnis yang juga dipakai localhost.
app.use((req, _res, next) => {
  const routedPath = req.query.__path;
  if (typeof routedPath === 'string') {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (key === '__path') continue;
      if (Array.isArray(value)) value.forEach((item) => query.append(key, String(item)));
      else if (value != null) query.set(key, String(value));
    }
    req.url = `/${routedPath}${query.size ? `?${query}` : ''}`;
  }
  next();
});

app.use(apiRouter);
app.use((_req, res) => res.status(404).json({ error: 'Endpoint API tidak ditemukan.' }));

export default app;
