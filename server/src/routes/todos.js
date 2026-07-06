import { Router } from 'express';
import db from '../db.js';
import { authMiddleware, checkRole } from '../auth.js';
import { hashPassword } from '../credentials.js';
import { logTodoAction, getHistory } from '../dailyLog.js';
import { parseFixedBonus, applyPercentDistribution, onTodoCompleted, onTodoReopened } from '../economy.js';
import { seedDemoTodos } from '../seedTodos.js';

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

function enrichTodo(todo, role) {
  const isParent = role === 'parent';
  return {
    ...todo,
    can_edit: role === 'admin' || (isParent && todo.status === 'pending'),
    can_delete: role === 'admin' || isParent,
    task_type: todo.task_type || 'normal',
  };
}

function parseDueAt(value) {
  if (value === null || value === '') return null;
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error('Date ou heure invalide');
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function buildTodoUpdates(body, allowStatus, canEditFields) {
  const {
    status, title, description, priority, duration, author, due_at,
    task_type, fixed_bonus,
  } = body;
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
  if (canEditFields && task_type !== undefined) {
    const type = task_type === 'special' ? 'special' : 'normal';
    updates.push('task_type = ?');
    params.push(type);
  }
  if (canEditFields && fixed_bonus !== undefined) {
    const bonus = parseFixedBonus(fixed_bonus);
    updates.push('fixed_bonus = ?');
    params.push(bonus);
  }

  return { updates, params };
}

router.get('/history', (req, res) => {
  const { days } = req.query;
  res.json({ history: getHistory(days) });
});

router.post('/demo-seed', checkRole('admin'), (_req, res) => {
  const inserted = seedDemoTodos();
  applyPercentDistribution();
  res.json({ inserted, ok: true });
});

router.post('/apply-percents', checkRole('parent'), (_req, res) => {
  const tasks = applyPercentDistribution();
  res.json({ ok: true, tasks });
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

  const todos = db.prepare(sql).all(...params).map((t) => enrichTodo(t, req.role));
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
    task_type = 'normal',
    fixed_bonus = 0,
  } = req.body;

  if (!title?.trim()) {
    return res.status(400).json({ error: 'Le titre est obligatoire' });
  }

  const prio = ['low', 'normal', 'high'].includes(priority) ? priority : 'normal';
  const dur = ['short', 'normal', 'long'].includes(duration) ? duration : 'normal';
  const type = task_type === 'special' ? 'special' : 'normal';

  let due = null;
  try {
    due = due_at ? parseDueAt(due_at) : null;
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  let bonus = 0;
  try {
    bonus = type === 'special' ? parseFixedBonus(fixed_bonus) : 0;
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const creatorHash = hashPassword(req.token);

  const result = db.prepare(`
    INSERT INTO todos (title, description, author, priority, duration, due_at, task_type, fixed_bonus, reward, creator_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(title.trim(), description.trim(), author.trim() || 'Parent', prio, dur, due, type, bonus, creatorHash);

  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(result.lastInsertRowid);
  logTodoAction(todo, 'created');

  if (type === 'normal') {
    applyPercentDistribution();
    const refreshed = db.prepare('SELECT * FROM todos WHERE id = ?').get(todo.id);
    return res.status(201).json({ todo: enrichTodo(refreshed, req.role) });
  }

  res.status(201).json({ todo: enrichTodo(todo, req.role) });
});

router.patch('/:id', (req, res) => {
  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
  if (!todo) return res.status(404).json({ error: 'Objectif introuvable' });

  const isAdmin = req.role === 'admin';
  const isParent = req.role === 'parent';
  const wantsStatusChange = req.body.status === 'done' || req.body.status === 'pending';
  const canEditContent = isAdmin || (isParent && todo.status === 'pending');

  if (wantsStatusChange && !isParent) {
    return res.status(403).json({ error: 'Seuls les parents peuvent valider une tâche' });
  }

  if (!wantsStatusChange && !canEditContent) {
    return res.status(403).json({ error: 'Vous ne pouvez pas modifier cet objectif' });
  }

  let updates, params;
  try {
    ({ updates, params } = buildTodoUpdates(req.body, isParent && wantsStatusChange, canEditContent));
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'Aucune modification' });
  }

  params.push(req.params.id);
  db.prepare(`UPDATE todos SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  let updated = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
  let economyResult = null;

  if (req.body.status === 'done' && todo.status !== 'done') {
    economyResult = onTodoCompleted(updated);
    updated = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
    logTodoAction(updated, 'completed');
  } else if (req.body.status === 'pending' && todo.status === 'done') {
    onTodoReopened(req.params.id);
    updated = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
    logTodoAction(updated, 'updated');
  } else {
    if (canEditContent && (updated.task_type || 'normal') === 'normal') {
      applyPercentDistribution();
      updated = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
    }
    logTodoAction(updated, 'updated');
  }

  res.json({ todo: enrichTodo(updated, req.role), economy: economyResult });
});

router.delete('/:id', (req, res) => {
  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
  if (!todo) return res.status(404).json({ error: 'Objectif introuvable' });

  const isAdmin = req.role === 'admin';
  const isParent = req.role === 'parent';

  if (!isAdmin && !isParent) {
    return res.status(403).json({ error: 'Vous ne pouvez pas supprimer cet objectif' });
  }

  db.prepare('DELETE FROM todos WHERE id = ?').run(req.params.id);
  if ((todo.task_type || 'normal') === 'normal' && todo.status === 'pending') {
    applyPercentDistribution();
  }

  res.json({ ok: true });
});

export default router;
