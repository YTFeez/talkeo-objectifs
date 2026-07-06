import db from './db.js';

export const TASK_CATEGORY_KEYS = ['maison', 'ecole', 'hygiene', 'animaux', 'cuisine', 'autre'];
export const ACCOUNT_CATEGORY_KEYS = [
  'monthly_allocation',
  'current_account',
  'savings',
  'total_earned',
  'goals',
];

const INSERT = db.prepare(`
  INSERT INTO persistent_archive (section, category_key, action, title, amount, snapshot, note)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

export function logArchive({
  section,
  categoryKey,
  action,
  title,
  amount = null,
  snapshot = {},
  note = '',
}) {
  if (!section || !categoryKey || !action || !title) return null;
  const result = INSERT.run(
    section,
    categoryKey,
    action,
    title,
    amount,
    JSON.stringify(snapshot),
    note || '',
  );
  return db.prepare('SELECT * FROM persistent_archive WHERE id = ?').get(result.lastInsertRowid);
}

export function logTaskArchive(todo, action, note = '') {
  const category = todo.category || 'maison';
  const key = TASK_CATEGORY_KEYS.includes(category) ? category : 'autre';
  return logArchive({
    section: 'task',
    categoryKey: key,
    action,
    title: todo.title,
    amount: todo.earned_amount ?? todo.fixed_bonus ?? null,
    snapshot: todo,
    note,
  });
}

export function logAccountArchive(categoryKey, action, title, amount = null, note = '', snapshot = {}) {
  if (!ACCOUNT_CATEGORY_KEYS.includes(categoryKey)) return null;
  return logArchive({
    section: 'account',
    categoryKey,
    action,
    title,
    amount,
    snapshot,
    note,
  });
}

export function getArchiveEntries({ section, categoryKey, limit = 200, offset = 0 }) {
  const lim = Math.min(500, Math.max(1, limit));
  const off = Math.max(0, offset);
  let sql = 'SELECT * FROM persistent_archive WHERE 1=1';
  const params = [];
  if (section) {
    sql += ' AND section = ?';
    params.push(section);
  }
  if (categoryKey) {
    sql += ' AND category_key = ?';
    params.push(categoryKey);
  }
  sql += ' ORDER BY recorded_at DESC, id DESC LIMIT ? OFFSET ?';
  params.push(lim, off);
  return db.prepare(sql).all(...params).map(parseRow);
}

export function getArchiveSummary() {
  const rows = db.prepare(`
    SELECT section, category_key, COUNT(*) AS count, MAX(recorded_at) AS last_at
    FROM persistent_archive
    GROUP BY section, category_key
  `).all();
  const map = {};
  for (const r of rows) {
    map[`${r.section}:${r.category_key}`] = { count: r.count, last_at: r.last_at };
  }
  return map;
}

function parseRow(row) {
  let snapshot = {};
  try {
    snapshot = JSON.parse(row.snapshot || '{}');
  } catch {
    snapshot = {};
  }
  return { ...row, snapshot };
}

function backfillIfEmpty() {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM persistent_archive').get();
  if (count > 0) return;

  const todos = db.prepare('SELECT * FROM todos ORDER BY created_at ASC').all();
  for (const todo of todos) {
    logTaskArchive(todo, 'created');
    if (todo.status === 'done' && todo.completed_at) {
      logTaskArchive(todo, 'validated', 'Import historique');
    }
  }

  const txs = db.prepare('SELECT * FROM wallet_transactions ORDER BY created_at ASC').all();
  for (const tx of txs) {
    const mapping = mapTxToAccounts(tx);
    for (const entry of mapping) {
      logAccountArchive(entry.key, entry.action, entry.title, entry.amount, tx.note || '', tx);
    }
  }
}

function mapTxToAccounts(tx) {
  const amt = Number(tx.amount) || 0;
  const entries = [];
  switch (tx.type) {
    case 'task_reward':
      entries.push({ key: 'current_account', action: 'credit', title: tx.note || 'Tâche validée', amount: amt });
      entries.push({ key: 'total_earned', action: 'credit', title: tx.note || 'Gain cumulé', amount: amt });
      break;
    case 'bonus':
      entries.push({ key: 'current_account', action: 'bonus', title: tx.note || 'Bonus', amount: amt });
      entries.push({ key: 'total_earned', action: 'bonus', title: tx.note || 'Bonus cumulé', amount: amt });
      break;
    case 'monthly_credit':
      entries.push({ key: 'monthly_allocation', action: 'credit', title: tx.note || 'Allocation mensuelle', amount: amt });
      entries.push({ key: 'total_earned', action: 'credit', title: 'Allocation cumulée', amount: amt });
      break;
    case 'to_savings':
      entries.push({ key: 'savings', action: 'transfer_in', title: tx.note || 'Vers épargne', amount: Math.abs(amt) });
      break;
    case 'to_goal':
      entries.push({ key: 'goals', action: 'transfer_in', title: tx.note || 'Vers objectif', amount: Math.abs(amt) });
      break;
    case 'penalty':
      entries.push({ key: 'current_account', action: 'penalty', title: tx.note || 'Pénalité', amount: amt });
      break;
    case 'withdrawal_request':
      entries.push({ key: 'current_account', action: 'withdraw_request', title: tx.note || 'Demande retrait', amount: Math.abs(amt) });
      break;
    default:
      entries.push({ key: 'current_account', action: tx.type, title: tx.note || tx.type, amount: amt });
  }
  return entries;
}

backfillIfEmpty();
