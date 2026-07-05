import { Router } from 'express';
import db from '../db.js';
import { authMiddleware, checkRole } from '../auth.js';
import { hashPassword, verifyPassword } from '../credentials.js';

const router = Router();

router.use(authMiddleware);

function canParentEdit(todo, token) {
  if (!todo.creator_hash) return false;
  return verifyPassword(token, todo.creator_hash) && todo.status === 'pending';
}

function buildTodoUpdates(body, allowStatus) {
  const { status, title, description, priority, author } = body;
  const updates = [];
  const params = [];

  if (allowStatus && (status === 'done' || status === 'pending')) {
    updates.push('status = ?');
    params.push(status);
    updates.push(status === 'done' ? "completed_at = datetime('now')" : 'completed_at = NULL');
  }
  if (title?.trim()) {
    updates.push('title = ?');
    params.push(title.trim());
  }
  if (description !== undefined) {
    updates.push('description = ?');
    params.push(description.trim());
  }
  if (['low', 'normal', 'high'].includes(priority)) {
    updates.push('priority = ?');
    params.push(priority);
  }
  if (author?.trim()) {
    updates.push('author = ?');
    params.push(author.trim());
  }

  return { updates, params };
}

router.get('/', (req, res) => {
  const { status } = req.query;
  let sql = 'SELECT * FROM todos';
  const params = [];

  if (status === 'pending' || status === 'done') {
    sql += ' WHERE status = ?';
    params.push(status);
  }

  sql += " ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, created_at DESC";

  const todos = db.prepare(sql).all(...params).map((todo) => ({
    ...todo,
    can_edit: req.role === 'admin' || canParentEdit(todo, req.token),
  }));

  res.json({ todos, role: req.role });
});

router.post('/', checkRole('parent'), (req, res) => {
  const { title, description = '', author = 'Parent', priority = 'normal' } = req.body;

  if (!title?.trim()) {
    return res.status(400).json({ error: 'Le titre est obligatoire' });
  }

  const validPriorities = ['low', 'normal', 'high'];
  const prio = validPriorities.includes(priority) ? priority : 'normal';
  const creatorHash = hashPassword(req.token);

  const result = db.prepare(`
    INSERT INTO todos (title, description, author, priority, creator_hash)
    VALUES (?, ?, ?, ?, ?)
  `).run(title.trim(), description.trim(), author.trim() || 'Parent', prio, creatorHash);

  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ todo: { ...todo, can_edit: true } });
});

router.patch('/:id', (req, res) => {
  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
  if (!todo) return res.status(404).json({ error: 'Objectif introuvable' });

  const isAdmin = req.role === 'admin';
  const isOwner = canParentEdit(todo, req.token);

  if (!isAdmin && !isOwner) {
    return res.status(403).json({ error: 'Vous ne pouvez pas modifier cet objectif' });
  }

  const { updates, params } = buildTodoUpdates(req.body, isAdmin);

  if (updates.length === 0) {
    return res.status(400).json({ error: 'Aucune modification' });
  }

  params.push(req.params.id);
  db.prepare(`UPDATE todos SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  const updated = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
  res.json({
    todo: {
      ...updated,
      can_edit: isAdmin || canParentEdit(updated, req.token),
    },
  });
});

router.delete('/:id', (req, res) => {
  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
  if (!todo) return res.status(404).json({ error: 'Objectif introuvable' });

  const isAdmin = req.role === 'admin';
  const isOwner = canParentEdit(todo, req.token);

  if (!isAdmin && !isOwner) {
    return res.status(403).json({ error: 'Vous ne pouvez pas supprimer cet objectif' });
  }

  db.prepare('DELETE FROM todos WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
