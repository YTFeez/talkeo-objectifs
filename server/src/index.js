import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import todoRoutes from './routes/todos.js';

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

const clientDist = path.join(__dirname, '../../client/dist');
const indexHtml = path.join(clientDist, 'index.html');

if (!fs.existsSync(indexHtml)) {
  console.error('ERREUR: frontend manquant. Lancez "npm run build" dans client/ ou rebuild Docker.');
  app.get('/', (_req, res) => {
    res.status(503).send('Talkeo: frontend non compilé. Rebuild requis.');
  });
} else {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(indexHtml);
  });
}

app.listen(PORT, () => {
  console.log(`Talkeo → http://localhost:${PORT}`);
});
