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
    savings_rate_percent REAL NOT NULL DEFAULT 20,
    vouchers_balance INTEGER NOT NULL DEFAULT 0
  )
`);

const profileCols = db.prepare('PRAGMA table_info(child_profile)').all().map((c) => c.name);
if (!profileCols.includes('vouchers_balance')) {
  db.exec('ALTER TABLE child_profile ADD COLUMN vouchers_balance INTEGER NOT NULL DEFAULT 0');
}

db.exec(`
  CREATE TABLE IF NOT EXISTS voucher_redemptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_title TEXT NOT NULL,
    note TEXT DEFAULT '',
    level_at_redemption INTEGER NOT NULL,
    redeemed_by TEXT NOT NULL DEFAULT 'Parent',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
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

// ——— Migrations colonnes todos ———
const todoCols = db.prepare('PRAGMA table_info(todos)').all().map((c) => c.name);
if (!todoCols.includes('category')) {
  db.exec("ALTER TABLE todos ADD COLUMN category TEXT NOT NULL DEFAULT 'maison'");
}
if (!todoCols.includes('repeat_type')) {
  db.exec("ALTER TABLE todos ADD COLUMN repeat_type TEXT NOT NULL DEFAULT 'none'");
}
if (!todoCols.includes('refused_reason')) {
  db.exec("ALTER TABLE todos ADD COLUMN refused_reason TEXT DEFAULT ''");
}
if (!todoCols.includes('submitted_at')) {
  db.exec('ALTER TABLE todos ADD COLUMN submitted_at TEXT');
}

// Étendre les statuts : pending → awaiting_validation → done / refused
(function migrateTodoStatusCheck() {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='todos'").get();
  if (!row?.sql || row.sql.includes('awaiting_validation')) return;

  db.exec(`
    PRAGMA foreign_keys=OFF;
    CREATE TABLE todos_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      author TEXT NOT NULL DEFAULT 'Parent',
      priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high')),
      duration TEXT NOT NULL DEFAULT 'normal' CHECK(duration IN ('short', 'normal', 'long')),
      due_at TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'awaiting_validation', 'done', 'refused')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      creator_hash TEXT,
      reward REAL NOT NULL DEFAULT 0,
      task_type TEXT NOT NULL DEFAULT 'normal',
      reward_percent REAL NOT NULL DEFAULT 0,
      fixed_bonus REAL NOT NULL DEFAULT 0,
      earned_amount REAL,
      completed_percent REAL,
      category TEXT NOT NULL DEFAULT 'maison',
      repeat_type TEXT NOT NULL DEFAULT 'none',
      refused_reason TEXT DEFAULT '',
      submitted_at TEXT
    );
    INSERT INTO todos_new (
      id, title, description, author, priority, duration, due_at, status,
      created_at, completed_at, creator_hash, reward, task_type, reward_percent,
      fixed_bonus, earned_amount, completed_percent, category, repeat_type, refused_reason, submitted_at
    )
    SELECT
      id, title, description, author, priority, duration, due_at, status,
      created_at, completed_at, creator_hash, reward, task_type, reward_percent,
      fixed_bonus, earned_amount, completed_percent,
      COALESCE(category, 'maison'), COALESCE(repeat_type, 'none'),
      COALESCE(refused_reason, ''), submitted_at
    FROM todos;
    DROP TABLE todos;
    ALTER TABLE todos_new RENAME TO todos;
    CREATE INDEX IF NOT EXISTS idx_todos_created ON todos(created_at);
    CREATE INDEX IF NOT EXISTS idx_todos_due ON todos(due_at);
    PRAGMA foreign_keys=ON;
  `);
})();

db.exec(`
  CREATE TABLE IF NOT EXISTS savings_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    target_amount REAL NOT NULL,
    saved_amount REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS achievements (
    code TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '🏅'
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS child_achievements (
    achievement_code TEXT PRIMARY KEY,
    unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (achievement_code) REFERENCES achievements(code)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_role TEXT NOT NULL DEFAULT 'all',
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT DEFAULT '',
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_notifications_role ON notifications(target_role, read);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS persistent_archive (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section TEXT NOT NULL CHECK(section IN ('task', 'account')),
    category_key TEXT NOT NULL,
    action TEXT NOT NULL,
    title TEXT NOT NULL,
    amount REAL,
    snapshot TEXT NOT NULL DEFAULT '{}',
    note TEXT DEFAULT '',
    recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_persistent_archive_cat
  ON persistent_archive(section, category_key, recorded_at DESC);
`);

export default db;
