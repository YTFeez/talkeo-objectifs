import { Router } from 'express';
import { authMiddleware } from '../auth.js';
import db from '../db.js';
import { getChildProfile, xpToLevel } from '../economy.js';

const router = Router();

router.use(authMiddleware);

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM reward_requests ORDER BY created_at DESC LIMIT 50
  `).all();
  res.json({ requests: rows });
});

router.post('/', (req, res) => {
  if (req.role !== 'admin') {
    return res.status(403).json({ error: 'Réservé à Aronne' });
  }
  const { title, description = '' } = req.body;
  if (!title?.trim()) {
    return res.status(400).json({ error: 'Le titre est obligatoire' });
  }
  const profile = getChildProfile();
  const result = db.prepare(`
    INSERT INTO reward_requests (title, description, level_at_request)
    VALUES (?, ?, ?)
  `).run(title.trim(), description.trim(), profile.level);

  const row = db.prepare('SELECT * FROM reward_requests WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ request: row });
});

router.patch('/:id', (req, res) => {
  if (req.role !== 'parent') {
    return res.status(403).json({ error: 'Réservé aux parents' });
  }
  const row = db.prepare('SELECT * FROM reward_requests WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Demande introuvable' });

  const { status, parent_response = '' } = req.body;
  if (!['accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Statut invalide' });
  }

  db.prepare(`
    UPDATE reward_requests
    SET status = ?, parent_response = ?, resolved_at = datetime('now')
    WHERE id = ?
  `).run(status, parent_response.trim(), req.params.id);

  const updated = db.prepare('SELECT * FROM reward_requests WHERE id = ?').get(req.params.id);
  res.json({ request: updated });
});

export default router;
