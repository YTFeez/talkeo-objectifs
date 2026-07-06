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
if (!columns.includes('reward')) {
  db.exec('ALTER TABLE todos ADD COLUMN reward REAL NOT NULL DEFAULT 0');
}
if (!columns.includes('task_type')) {
  db.exec("ALTER TABLE todos ADD COLUMN task_type TEXT NOT NULL DEFAULT 'normal'");
}
if (!columns.includes('reward_percent')) {
  db.exec('ALTER TABLE todos ADD COLUMN reward_percent REAL NOT NULL DEFAULT 0');
}
if (!columns.includes('fixed_bonus')) {
  db.exec('ALTER TABLE todos ADD COLUMN fixed_bonus REAL NOT NULL DEFAULT 0');
}
if (!columns.includes('earned_amount')) {
  db.exec('ALTER TABLE todos ADD COLUMN earned_amount REAL');
}
if (!columns.includes('completed_percent')) {
  db.exec('ALTER TABLE todos ADD COLUMN completed_percent REAL');
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

db.exec(`
  CREATE TABLE IF NOT EXISTS task_suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    reward REAL NOT NULL DEFAULT 0,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high')),
    duration TEXT NOT NULL DEFAULT 'normal' CHECK(duration IN ('short', 'normal', 'long')),
    is_builtin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS child_profile (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    xp INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    current_strike INTEGER NOT NULL DEFAULT 0,
    best_strike INTEGER NOT NULL DEFAULT 0,
    current_balance REAL NOT NULL DEFAULT 0,
    savings_balance REAL NOT NULL DEFAULT 0,
    savings_rate_percent REAL NOT NULL DEFAULT 20
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS wallet_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    note TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS reward_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected')),
    level_at_request INTEGER NOT NULL,
    parent_response TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT
  )
`);

export default db;
