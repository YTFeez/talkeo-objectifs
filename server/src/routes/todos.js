import { Router } from 'express';
import db from '../db.js';
import { authMiddleware, checkRole } from '../auth.js';
import { hashPassword } from '../credentials.js';
import { logTodoAction, getHistory } from '../dailyLog.js';
import { parseFixedBonus, applyPercentDistribution, onTodoCompleted, onTodoReopened } from '../economy.js';
import { seedDemoTodos } from '../seedTodos.js';
import { createNotification } from '../notifications.js';
import { checkAchievements } from '../achievements.js';
import { logTaskArchive } from '../archive.js';

const router = Router();

router.use(authMiddleware);

const CATEGORIES = ['maison', 'ecole', 'hygiene', 'animaux', 'cuisine', 'autre'];
const REPEAT_TYPES = ['none', 'daily', 'weekly', 'monthly'];
const ACTIVE_STATUSES = ['pending', 'awaiting_validation', 'refused'];

const SORT_ORDER = `
  ORDER BY
    CASE status WHEN 'awaiting_validation' THEN 0 WHEN 'pending' THEN 1 WHEN 'refused' THEN 2 ELSE 3 END,
    CASE WHEN due_at IS NULL THEN 1 ELSE 0 END,
    due_at ASC,
    CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
    created_at DESC
`;

function enrichTodo(todo, role) {
  const isParent = role === 'parent';
  const isChild = role === 'admin';
  return {
    ...todo,
    can_edit: isChild || (isParent && ACTIVE_STATUSES.includes(todo.status)),
    can_delete: isChild || isParent,
    can_submit: isChild && ACTIVE_STATUSES.includes(todo.status),
    can_validate: isParent && todo.status === 'awaiting_validation',
    can_reject: isParent && todo.status === 'awaiting_validation',
    task_type: todo.task_type || 'normal',
    category: todo.category || 'maison',
    repeat_type: todo.repeat_type || 'none',
  };
}

function parseDueAt(value) {
  if (value === null || value === '') return null;
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error('Date ou heure invalide');
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function buildTodoUpdates(body, canEditFields) {
  const {
    title, description, priority, duration, author, due_at,
    task_type, fixed_bonus, category, repeat_type,
  } = body;
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
  if (canEditFields && category && CATEGORIES.includes(category)) {
    updates.push('category = ?');
    params.push(category);
  }
  if (canEditFields && repeat_type && REPEAT_TYPES.includes(repeat_type)) {
    updates.push('repeat_type = ?');
    params.push(repeat_type);
  }

  return { updates, params };
}

function nextDueDate(dueAt, repeatType) {
  const base = dueAt ? new Date(dueAt.replace(' ', 'T')) : new Date();
  if (repeatType === 'daily') base.setDate(base.getDate() + 1);
  else if (repeatType === 'weekly') base.setDate(base.getDate() + 7);
  else if (repeatType === 'monthly') base.setMonth(base.getMonth() + 1);
  return base.toISOString().slice(0, 19).replace('T', ' ');
}

function createRepeatTask(todo) {
  if (!todo.repeat_type || todo.repeat_type === 'none') return null;
  const due = todo.due_at ? nextDueDate(todo.due_at, todo.repeat_type) : null;
  const result = db.prepare(`
    INSERT INTO todos (
      title, description, author, priority, duration, due_at, task_type, fixed_bonus,
      reward, category, repeat_type, creator_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
  `).run(
    todo.title,
    todo.description || '',
    todo.author,
    todo.priority,
    todo.duration,
    due,
    todo.task_type || 'normal',
    todo.fixed_bonus || 0,
    todo.category || 'maison',
    todo.repeat_type,
    todo.creator_hash,
  );
  const newTodo = db.prepare('SELECT * FROM todos WHERE id = ?').get(result.lastInsertRowid);
  logTodoAction(newTodo, 'created');
  if ((newTodo.task_type || 'normal') === 'normal') applyPercentDistribution();
  return newTodo;
}

function validateTodo(todo) {
  db.prepare(`
    UPDATE todos SET status = 'done', completed_at = datetime('now'), refused_reason = '' WHERE id = ?
  `).run(todo.id);
  const updated = db.prepare('SELECT * FROM todos WHERE id = ?').get(todo.id);
  const economyResult = onTodoCompleted(updated);
  const achievements = checkAchievements();
  logTodoAction(updated, 'completed');
  logTaskArchive(updated, 'validated');
  createNotification({
    type: 'task_validated',
    title: 'Tâche validée ✓',
    body: updated.title,
    target_role: 'admin',
  });
  if (economyResult.xp?.vouchers_granted > 0) {
    const profile = economyResult.xp;
    createNotification({
      type: 'voucher_earned',
      title: 'Nouveau bon ! 🎟',
      body: `Niveau ${profile.level} atteint — +${economyResult.xp.vouchers_granted} bon`,
      target_role: 'admin',
    });
  }
  const repeated = createRepeatTask(todo);
  return { updated, economyResult, achievements, repeated };
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

  if (status === 'pending') {
    sql += " WHERE status IN ('pending', 'awaiting_validation', 'refused')";
  } else if (status === 'awaiting_validation') {
    sql += " WHERE status = 'awaiting_validation'";
  } else if (status === 'done') {
    sql += " WHERE status = 'done'";
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
    category = 'maison',
    repeat_type = 'none',
  } = req.body;

  if (!title?.trim()) {
    return res.status(400).json({ error: 'Le titre est obligatoire' });
  }

  const prio = ['low', 'normal', 'high'].includes(priority) ? priority : 'normal';
  const dur = ['short', 'normal', 'long'].includes(duration) ? duration : 'normal';
  const type = task_type === 'special' ? 'special' : 'normal';
  const cat = CATEGORIES.includes(category) ? category : 'maison';
  const repeat = REPEAT_TYPES.includes(repeat_type) ? repeat_type : 'none';

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
    INSERT INTO todos (
      title, description, author, priority, duration, due_at, task_type, fixed_bonus,
      reward, category, repeat_type, creator_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
  `).run(title.trim(), description.trim(), author.trim() || 'Parent', prio, dur, due, type, bonus, cat, repeat, creatorHash);

  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(result.lastInsertRowid);
  logTodoAction(todo, 'created');
  logTaskArchive(todo, 'created');
  createNotification({
    type: 'task_created',
    title: 'Nouvelle tâche',
    body: todo.title,
    target_role: 'admin',
  });

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
  const { action, refused_reason: refuseReason } = req.body;
  const canEditContent = isAdmin || (isParent && ACTIVE_STATUSES.includes(todo.status));

  // ——— Actions flux validation ———
  if (action === 'submit' && isAdmin) {
    if (!ACTIVE_STATUSES.includes(todo.status)) {
      return res.status(400).json({ error: 'Cette tâche ne peut pas être soumise' });
    }
    db.prepare(`
      UPDATE todos SET status = 'awaiting_validation', submitted_at = datetime('now'), refused_reason = '' WHERE id = ?
    `).run(todo.id);
    const updated = db.prepare('SELECT * FROM todos WHERE id = ?').get(todo.id);
    logTodoAction(updated, 'updated');
    logTaskArchive(updated, 'submitted');
    createNotification({
      type: 'task_submitted',
      title: 'Tâche à valider',
      body: updated.title,
      target_role: 'parent',
    });
    return res.json({ todo: enrichTodo(updated, req.role) });
  }

  if ((action === 'validate' || req.body.status === 'done') && isParent) {
    if (!['awaiting_validation', 'pending'].includes(todo.status)) {
      return res.status(400).json({ error: 'Rien à valider' });
    }
    const { updated, economyResult, achievements, repeated } = validateTodo(todo);
    return res.json({ todo: enrichTodo(updated, req.role), economy: economyResult, achievements, repeated });
  }

  if ((action === 'reject' || req.body.status === 'refused') && isParent) {
    if (todo.status !== 'awaiting_validation') {
      return res.status(400).json({ error: 'Rien à refuser' });
    }
    const reason = (refuseReason || req.body.reason || 'À refaire').trim();
    db.prepare(`
      UPDATE todos SET status = 'refused', refused_reason = ?, completed_at = NULL WHERE id = ?
    `).run(reason, todo.id);
    const updated = db.prepare('SELECT * FROM todos WHERE id = ?').get(todo.id);
    logTodoAction(updated, 'updated');
    logTaskArchive(updated, 'refused', reason);
    createNotification({
      type: 'task_refused',
      title: 'Tâche refusée',
      body: `${updated.title} — ${reason}`,
      target_role: 'admin',
    });
    return res.json({ todo: enrichTodo(updated, req.role) });
  }

  if ((action === 'reopen' || req.body.status === 'pending') && isParent && todo.status === 'done') {
    onTodoReopened(todo.id);
    db.prepare("UPDATE todos SET status = 'pending', refused_reason = '' WHERE id = ?").run(todo.id);
    const updated = db.prepare('SELECT * FROM todos WHERE id = ?').get(todo.id);
    logTodoAction(updated, 'updated');
    logTaskArchive(updated, 'reopened');
    applyPercentDistribution();
    return res.json({ todo: enrichTodo(updated, req.role) });
  }

  // ——— Édition contenu ———
  if (!canEditContent) {
    return res.status(403).json({ error: 'Vous ne pouvez pas modifier cet objectif' });
  }

  let updates;
  let params;
  try {
    ({ updates, params } = buildTodoUpdates(req.body, canEditContent));
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'Aucune modification' });
  }

  params.push(req.params.id);
  db.prepare(`UPDATE todos SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  let updated = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
  if ((updated.task_type || 'normal') === 'normal' && ACTIVE_STATUSES.includes(updated.status)) {
    applyPercentDistribution();
    updated = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
  }
  logTodoAction(updated, 'updated');
  logTaskArchive(updated, 'updated');
  res.json({ todo: enrichTodo(updated, req.role) });
});

router.delete('/:id', (req, res) => {
  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
  if (!todo) return res.status(404).json({ error: 'Objectif introuvable' });

  const isAdmin = req.role === 'admin';
  const isParent = req.role === 'parent';

  if (!isAdmin && !isParent) {
    return res.status(403).json({ error: 'Vous ne pouvez pas supprimer cet objectif' });
  }

  logTaskArchive(todo, 'deleted');
  db.prepare('DELETE FROM todos WHERE id = ?').run(req.params.id);
  if ((todo.task_type || 'normal') === 'normal' && ACTIVE_STATUSES.includes(todo.status)) {
    applyPercentDistribution();
  }

  res.json({ ok: true });
});

export default router;
