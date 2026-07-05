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
    duration TEXT NOT NULL DEFAULT 'normal' CHECK(duration IN ('short', 'normal', 'long')),
    due_at TEXT,
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
if (!columns.includes('duration')) {
  db.exec("ALTER TABLE todos ADD COLUMN duration TEXT NOT NULL DEFAULT 'normal'");
}
if (!columns.includes('due_at')) {
  db.exec('ALTER TABLE todos ADD COLUMN due_at TEXT');
}

db.exec(`
  CREATE TABLE IF NOT EXISTS daily_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    log_date TEXT NOT NULL,
    todo_id INTEGER NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('created', 'completed', 'updated')),
    snapshot TEXT NOT NULL,
    logged_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
  )
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_daily_log_date ON daily_log(log_date);
  CREATE INDEX IF NOT EXISTS idx_todos_created ON todos(created_at);
  CREATE INDEX IF NOT EXISTS idx_todos_due ON todos(due_at);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    author TEXT NOT NULL DEFAULT 'Parent',
    event_at TEXT NOT NULL,
    creator_hash TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_events_at ON events(event_at);
`);

export default db;
