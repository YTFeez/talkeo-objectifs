import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import todoRoutes from './routes/todos.js';
import eventRoutes from './routes/events.js';
import rewardRoutes from './routes/rewards.js';
import './seedTodos.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3002;

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '64kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'talkeo' });
});

app.use('/api/auth', authRoutes);
app.use('/api/todos', todoRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/rewards', rewardRoutes);

function resolveClientDist() {
  const candidates = [
    path.join(__dirname, '../client/dist'),      // Docker: /app/src → /app/client/dist
    path.join(__dirname, '../../client/dist'),   // Dev local: server/src → client/dist
  ];
  return candidates.find((dir) => fs.existsSync(path.join(dir, 'index.html'))) ?? candidates[1];
}

const clientDist = resolveClientDist();
const indexHtml = path.join(clientDist, 'index.html');

if (!fs.existsSync(indexHtml)) {
  console.error('ERREUR: frontend manquant à', clientDist);
  app.get('/', (_req, res) => {
    res.status(503).send('Talkeo: frontend non compilé. Rebuild requis.');
  });
} else {
  console.log('Frontend servi depuis', clientDist);
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(indexHtml);
  });
}

app.listen(PORT, () => {
  console.log(`Talkeo → http://localhost:${PORT}`);
});
