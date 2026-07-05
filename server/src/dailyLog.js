import db from './db.js';

function todayParis() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
}

export function logTodoAction(todo, action) {
  const logDate = todayParis();
  const snapshot = JSON.stringify({
    id: todo.id,
    title: todo.title,
    description: todo.description,
    author: todo.author,
    priority: todo.priority,
    duration: todo.duration,
    due_at: todo.due_at,
    status: todo.status,
  });

  db.prepare(`
    INSERT INTO daily_log (log_date, todo_id, action, snapshot)
    VALUES (?, ?, ?, ?)
  `).run(logDate, todo.id, action, snapshot);
}

export function getHistory(days = 30) {
  const limit = Math.min(Math.max(parseInt(days, 10) || 30, 1), 90);

  const added = db.prepare(`
    SELECT date(created_at) AS day, COUNT(*) AS count
    FROM todos
    WHERE date(created_at) >= date('now', '-' || ? || ' days')
    GROUP BY day
    ORDER BY day DESC
  `).all(limit);

  const completed = db.prepare(`
    SELECT date(completed_at) AS day, COUNT(*) AS count
    FROM todos
    WHERE completed_at IS NOT NULL
      AND date(completed_at) >= date('now', '-' || ? || ' days')
    GROUP BY day
    ORDER BY day DESC
  `).all(limit);

  const daySet = new Set([
    ...added.map((r) => r.day),
    ...completed.map((r) => r.day),
  ]);

  const daysList = [...daySet].sort((a, b) => b.localeCompare(a));

  return daysList.map((day) => {
    const todosAdded = db.prepare(`
      SELECT * FROM todos WHERE date(created_at) = ? ORDER BY created_at DESC
    `).all(day);

    const todosCompleted = db.prepare(`
      SELECT * FROM todos WHERE date(completed_at) = ? ORDER BY completed_at DESC
    `).all(day);

    const events = db.prepare(`
      SELECT * FROM daily_log WHERE log_date = ? ORDER BY logged_at DESC
    `).all(day);

    return {
      date: day,
      added_count: todosAdded.length,
      completed_count: todosCompleted.length,
      added: todosAdded,
      completed: todosCompleted,
      events,
    };
  });
}
