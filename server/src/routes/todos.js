import { Router } from 'express';
import db from '../db.js';
import { authMiddleware, checkRole } from '../auth.js';
import { hashPassword, verifyPassword } from '../credentials.js';
import { logTodoAction, getHistory } from '../dailyLog.js';

const router = Router();

router.use(authMiddleware);

const SORT_ORDER = `
  ORDER BY
    CASE WHEN due_at IS NULL THEN 1 ELSE 0 END,
    due_at ASC,
    CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
    CASE duration WHEN 'long' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
    created_at DESC
`;

function canParentEdit(todo, token) {
  if (!todo.creator_hash) return false;
  return verifyPassword(token, todo.creator_hash) && todo.status === 'pending';
}

function enrichTodo(todo, role, token) {
  return {
    ...todo,
    can_edit: role === 'admin' || canParentEdit(todo, token),
  };
}

function parseDueAt(value) {
  if (value === null || value === '') return null;
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error('Date ou heure invalide');
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function buildTodoUpdates(body, allowStatus) {
  const { status, title, description, priority, duration, author, due_at } = body;
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
  if (['short', 'normal', 'long'].includes(duration)) {
    updates.push('duration = ?');
    params.push(duration);
  }
  if (author?.trim()) {
    updates.push('author = ?');
    params.push(author.trim());
  }
  if (due_at !== undefined) {
    const parsed = parseDueAt(due_at);
    updates.push('due_at = ?');
    params.push(parsed);
  }

  return { updates, params };
}

router.get('/history', (req, res) => {
  const { days } = req.query;
  res.json({ history: getHistory(days) });
});

router.get('/', (req, res) => {
  const { status } = req.query;
  let sql = 'SELECT * FROM todos';
  const params = [];

  if (status === 'pending' || status === 'done') {
    sql += ' WHERE status = ?';
    params.push(status);
  }

  sql += SORT_ORDER;

  const todos = db.prepare(sql).all(...params).map((t) => enrichTodo(t, req.role, req.token));
  res.json({ todos, role: req.role });
});

router.post('/', checkRole('parent'), (req, res) => {
  const {
    title,
    description = '',
    author = 'Parent',
    priority = 'normal',
    duration = 'normal',
    due_at,
  } = req.body;

  if (!title?.trim()) {
    return res.status(400).json({ error: 'Le titre est obligatoire' });
  }

  const prio = ['low', 'normal', 'high'].includes(priority) ? priority : 'normal';
  const dur = ['short', 'normal', 'long'].includes(duration) ? duration : 'normal';
  let due = null;
  try {
    due = due_at ? parseDueAt(due_at) : null;
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const creatorHash = hashPassword(req.token);

  const result = db.prepare(`
    INSERT INTO todos (title, description, author, priority, duration, due_at, creator_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(title.trim(), description.trim(), author.trim() || 'Parent', prio, dur, due, creatorHash);

  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(result.lastInsertRowid);
  logTodoAction(todo, 'created');

  res.status(201).json({ todo: enrichTodo(todo, req.role, req.token) });
});

router.patch('/:id', (req, res) => {
  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
  if (!todo) return res.status(404).json({ error: 'Objectif introuvable' });

  const isAdmin = req.role === 'admin';
  const isOwner = canParentEdit(todo, req.token);

  if (!isAdmin && !isOwner) {
    return res.status(403).json({ error: 'Vous ne pouvez pas modifier cet objectif' });
  }

  let updates, params;
  try {
    ({ updates, params } = buildTodoUpdates(req.body, isAdmin));
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'Aucune modification' });
  }

  params.push(req.params.id);
  db.prepare(`UPDATE todos SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  const updated = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
  const action = req.body.status === 'done' ? 'completed' : 'updated';
  logTodoAction(updated, action);

  res.json({ todo: enrichTodo(updated, req.role, req.token) });
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
