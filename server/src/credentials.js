import crypto from 'crypto';
import db from './db.js';

const SALT = 'talkeo-objectifs-v1';

export function hashPassword(password) {
  return crypto.scryptSync(password, SALT, 64).toString('hex');
}

export function verifyPassword(password, hash) {
  try {
    const a = Buffer.from(hashPassword(password), 'hex');
    const b = Buffer.from(hash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function initCredentials() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS credentials (
      role TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const defaults = {
    parent: process.env.PARENT_TOKEN || 'parents2026',
    admin: process.env.ADMIN_TOKEN || 'admin2026',
  };

  for (const [role, token] of Object.entries(defaults)) {
    const row = db.prepare('SELECT role FROM credentials WHERE role = ?').get(role);
    if (!row) {
      db.prepare('INSERT INTO credentials (role, password_hash) VALUES (?, ?)').run(
        role,
        hashPassword(token),
      );
    }
  }
}

export function verifyLogin(token) {
  for (const role of ['admin', 'parent']) {
    const row = db.prepare('SELECT password_hash FROM credentials WHERE role = ?').get(role);
    if (row && verifyPassword(token, row.password_hash)) return role;
  }
  return null;
}

export function changePassword(role, currentToken, newToken) {
  if (!newToken?.trim() || newToken.trim().length < 4) {
    throw new Error('Le nouveau code doit contenir au moins 4 caractères');
  }

  const row = db.prepare('SELECT password_hash FROM credentials WHERE role = ?').get(role);
  if (!row || !verifyPassword(currentToken, row.password_hash)) {
    throw new Error('Code actuel incorrect');
  }

  db.prepare(`
    UPDATE credentials SET password_hash = ?, updated_at = datetime('now') WHERE role = ?
  `).run(hashPassword(newToken.trim()), role);
}

initCredentials();
