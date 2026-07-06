import db from './db.js';

export const BUILTIN_SUGGESTIONS = [
  { title: 'Ranger la chambre', duration: 'normal', priority: 'normal' },
  { title: 'Faire la vaisselle', duration: 'short', priority: 'normal' },
  { title: 'Sortir le chien', duration: 'short', priority: 'high' },
  { title: 'Devoirs du soir', duration: 'normal', priority: 'high' },
  { title: 'Vider le lave-vaisselle', duration: 'short', priority: 'low' },
  { title: 'Arroser les plantes', duration: 'short', priority: 'low' },
];

export function seedSuggestionsIfEmpty() {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM task_suggestions').get();
  if (count > 0) return;

  const insert = db.prepare(`
    INSERT INTO task_suggestions (title, reward, priority, duration, is_builtin)
    VALUES (?, ?, ?, ?, 1)
  `);

  for (const s of BUILTIN_SUGGESTIONS) {
    insert.run(s.title, 0, s.priority, s.duration);
  }
}

export function listSuggestions() {
  return db.prepare(`
    SELECT id, title, reward, priority, duration, is_builtin, created_at
    FROM task_suggestions
    ORDER BY is_builtin DESC, created_at ASC, id ASC
  `).all();
}

export function createSuggestion({ title, reward = 0, priority, duration }) {
  const result = db.prepare(`
    INSERT INTO task_suggestions (title, reward, priority, duration, is_builtin)
    VALUES (?, ?, ?, ?, 0)
  `).run(title, reward || 0, priority || 'normal', duration || 'normal');

  return db.prepare('SELECT * FROM task_suggestions WHERE id = ?').get(result.lastInsertRowid);
}

export function deleteSuggestion(id) {
  const row = db.prepare('SELECT * FROM task_suggestions WHERE id = ?').get(id);
  if (!row) return null;
  if (row.is_builtin) {
    const err = new Error('Les idées par défaut ne peuvent pas être supprimées');
    err.status = 403;
    throw err;
  }
  db.prepare('DELETE FROM task_suggestions WHERE id = ?').run(id);
  return row;
}

seedSuggestionsIfEmpty();
