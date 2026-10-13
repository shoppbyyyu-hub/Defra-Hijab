import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './src/server/api.ts';
import { startOwnerNotificationWorker } from './src/server/ownerNotifications.ts';
import { startMaintenanceWorker } from './src/server/maintenance.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve public static assets
app.use('/public', express.static(path.join(__dirname, 'public')));

// Mount API router
app.use('/api', apiRouter);

// Serve built frontend assets in production
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback to index.html for client-side routing
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[Defra Hijab] Server running on port ${PORT}`);
  startOwnerNotificationWorker();
  startMaintenanceWorker();
});
