import { Router } from 'express';
import db from '../db.js';
import { authMiddleware, checkRole } from '../auth.js';
import { hashPassword } from '../credentials.js';

const router = Router();

router.use(authMiddleware);

const SORT_ORDER = `
  ORDER BY
    CASE WHEN datetime(event_at) < datetime('now', 'localtime') THEN 1 ELSE 0 END,
    event_at ASC
`;

function enrichEvent(event, role) {
  const isParent = role === 'parent';
  return {
    ...event,
    can_edit: role === 'admin' || isParent,
    can_delete: role === 'admin' || isParent,
  };
}

function parseEventAt(value) {
  if (!value) throw new Error('La date et l\'heure sont obligatoires');
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error('Date ou heure invalide');
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

router.get('/', (req, res) => {
  const { upcoming } = req.query;
  let sql = 'SELECT * FROM events';
  const params = [];

  if (upcoming === '1' || upcoming === 'true') {
    sql += " WHERE datetime(event_at) >= datetime('now', 'localtime')";
  }

  sql += SORT_ORDER;

  const events = db.prepare(sql).all(...params).map((e) => enrichEvent(e, req.role));
  res.json({ events, role: req.role });
});

router.post('/', checkRole('parent'), (req, res) => {
  const { title, description = '', author = 'Parent', event_at } = req.body;

  if (!title?.trim()) {
    return res.status(400).json({ error: 'Le titre est obligatoire' });
  }

  let at;
  try {
    at = parseEventAt(event_at);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const creatorHash = hashPassword(req.token);

  const result = db.prepare(`
    INSERT INTO events (title, description, author, event_at, creator_hash)
    VALUES (?, ?, ?, ?, ?)
  `).run(title.trim(), description.trim(), author.trim() || 'Parent', at, creatorHash);

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ event: enrichEvent(event, req.role) });
});

router.patch('/:id', (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Événement introuvable' });

  const isAdmin = req.role === 'admin';
  const isParent = req.role === 'parent';

  if (!isAdmin && !isParent) {
    return res.status(403).json({ error: 'Vous ne pouvez pas modifier cet événement' });
  }

  const { title, description, author, event_at } = req.body;
  const updates = [];
  const params = [];

  if (title?.trim()) {
    updates.push('title = ?');
    params.push(title.trim());
  }
  if (description !== undefined) {
    updates.push('description = ?');
    params.push(description.trim());
  }
  if (author?.trim()) {
    updates.push('author = ?');
    params.push(author.trim());
  }
  if (event_at !== undefined) {
    try {
      const parsed = parseEventAt(event_at);
      updates.push('event_at = ?');
      params.push(parsed);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'Aucune modification' });
  }

  params.push(req.params.id);
  db.prepare(`UPDATE events SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  const updated = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  res.json({ event: enrichEvent(updated, req.role) });
});

router.delete('/:id', (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Événement introuvable' });

  const isAdmin = req.role === 'admin';
  const isParent = req.role === 'parent';

  if (!isAdmin && !isParent) {
    return res.status(403).json({ error: 'Vous ne pouvez pas supprimer cet événement' });
  }

  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
