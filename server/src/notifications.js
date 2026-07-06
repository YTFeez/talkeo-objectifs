import db from './db.js';

export function createNotification({ type, title, body = '', target_role = 'all' }) {
  const result = db.prepare(`
    INSERT INTO notifications (target_role, type, title, body)
    VALUES (?, ?, ?, ?)
  `).run(target_role, type, title, body);
  return db.prepare('SELECT * FROM notifications WHERE id = ?').get(result.lastInsertRowid);
}

export function listNotifications(role, limit = 30) {
  return db.prepare(`
    SELECT * FROM notifications
    WHERE target_role IN ('all', ?)
    ORDER BY created_at DESC
    LIMIT ?
  `).all(role, limit);
}

export function unreadCount(role) {
  const row = db.prepare(`
    SELECT COUNT(*) AS count FROM notifications
    WHERE read = 0 AND target_role IN ('all', ?)
  `).get(role);
  return row?.count || 0;
}

export function markRead(id) {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(id);
}

export function markAllRead(role) {
  db.prepare(`
    UPDATE notifications SET read = 1
    WHERE read = 0 AND target_role IN ('all', ?)
  `).run(role);
}
