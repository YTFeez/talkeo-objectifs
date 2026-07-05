import db from './db.js';

const TIMEZONE = 'Europe/Paris';

function round2(n) {
  return Math.round(n * 100) / 100;
}

export function currentMonthKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE }).slice(0, 7);
}

export function formatMonthLabel(monthKey) {
  const d = new Date(`${monthKey}-15T12:00:00`);
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: TIMEZONE });
}

function parseCompletedAt(iso) {
  if (!iso) return null;
  const normalized = iso.includes('T') ? iso : iso.replace(' ', 'T');
  const withZone = /[Z+-]\d{2}/.test(normalized) ? normalized : `${normalized}Z`;
  const d = new Date(withZone);
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthKeyParis(iso) {
  const d = parseCompletedAt(iso);
  if (!d) return null;
  return d.toLocaleDateString('en-CA', { timeZone: TIMEZONE }).slice(0, 7);
}

function getCompletedPaidTodos() {
  return db.prepare(`
    SELECT id, title, author, reward, completed_at
    FROM todos
    WHERE status = 'done' AND reward > 0 AND completed_at IS NOT NULL
  `).all();
}

export function getMonthDetail(monthKey) {
  const tasks = getCompletedPaidTodos()
    .filter((t) => monthKeyParis(t.completed_at) === monthKey)
    .sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)));

  const total = tasks.reduce((sum, t) => sum + (t.reward || 0), 0);

  return {
    month: monthKey,
    label: formatMonthLabel(monthKey),
    total: round2(total),
    task_count: tasks.length,
    tasks,
  };
}

export function getMonthlyHistory() {
  const byMonth = new Map();

  for (const todo of getCompletedPaidTodos()) {
    const key = monthKeyParis(todo.completed_at);
    if (!key) continue;
    const entry = byMonth.get(key) || { month: key, total: 0, task_count: 0 };
    entry.total += todo.reward || 0;
    entry.task_count += 1;
    byMonth.set(key, entry);
  }

  return [...byMonth.values()]
    .map((row) => ({
      month: row.month,
      label: formatMonthLabel(row.month),
      total: round2(row.total),
      task_count: row.task_count,
      is_current: row.month === currentMonthKey(),
    }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

export function getSummary() {
  const currentKey = currentMonthKey();
  const current = getMonthDetail(currentKey);
  const months = getMonthlyHistory();
  return {
    current: { ...current, is_current: true },
    months,
  };
}

export function parseReward(value) {
  if (value === null || value === '' || value === undefined) return 0;
  const normalized = String(value).trim().replace(',', '.');
  const n = parseFloat(normalized);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error('Rémunération invalide');
  }
  if (n > 9999) {
    throw new Error('Montant trop élevé');
  }
  return round2(n);
}
