import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'todos.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    author TEXT NOT NULL DEFAULT 'Parent',
    priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'done')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    creator_hash TEXT
  )
`);

const columns = db.prepare('PRAGMA table_info(todos)').all().map((c) => c.name);
if (!columns.includes('creator_hash')) {
  db.exec('ALTER TABLE todos ADD COLUMN creator_hash TEXT');
}

export default db;
