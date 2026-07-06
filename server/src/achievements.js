import db from './db.js';
import { getChildProfile } from './economy.js';

export const ACHIEVEMENT_DEFS = [
  { code: 'first_euro', title: 'Premier euro', description: 'Gagner ton premier euro', icon: '💶' },
  { code: 'tasks_10', title: '10 tâches', description: 'Valider 10 tâches', icon: '✅' },
  { code: 'tasks_100', title: '100 tâches', description: 'Valider 100 tâches', icon: '🏆' },
  { code: 'euro_100', title: '100 €', description: 'Cumuler 100 € de gains', icon: '💰' },
  { code: 'euro_500', title: '500 €', description: 'Cumuler 500 € de gains', icon: '🤑' },
  { code: 'streak_30', title: '30 jours de suite', description: 'Atteindre 30 de strike', icon: '🔥' },
  { code: 'first_goal', title: 'Premier objectif', description: 'Atteindre un coffre', icon: '🎯' },
  { code: 'level_5', title: 'Niveau 5', description: 'Atteindre le niveau 5', icon: '⭐' },
];

export function seedAchievements() {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO achievements (code, title, description, icon) VALUES (?, ?, ?, ?)
  `);
  for (const a of ACHIEVEMENT_DEFS) {
    insert.run(a.code, a.title, a.description, a.icon);
  }
}

seedAchievements();

function getStats() {
  const tasksDone = db.prepare("SELECT COUNT(*) AS c FROM todos WHERE status = 'done'").get().c;
  const totalEarned = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS s FROM wallet_transactions
    WHERE type IN ('task_reward', 'bonus', 'monthly_credit') AND amount > 0
  `).get().s;
  const goalsDone = db.prepare("SELECT COUNT(*) AS c FROM savings_goals WHERE status = 'completed'").get().c;
  const profile = getChildProfile();
  return { tasksDone, totalEarned, goalsDone, level: profile.level, bestStrike: profile.best_strike };
}

export function listAchievements() {
  const unlocked = db.prepare(`
    SELECT a.*, ca.unlocked_at
    FROM achievements a
    LEFT JOIN child_achievements ca ON ca.achievement_code = a.code
    ORDER BY a.title ASC
  `).all();
  return unlocked.map((a) => ({ ...a, unlocked: Boolean(a.unlocked_at) }));
}

function unlock(code) {
  const exists = db.prepare('SELECT 1 FROM child_achievements WHERE achievement_code = ?').get(code);
  if (exists) return null;
  db.prepare('INSERT INTO child_achievements (achievement_code) VALUES (?)').run(code);
  const def = ACHIEVEMENT_DEFS.find((a) => a.code === code);
  return def;
}

export function checkAchievements() {
  const stats = getStats();
  const toCheck = [
    { code: 'first_euro', ok: stats.totalEarned >= 1 },
    { code: 'tasks_10', ok: stats.tasksDone >= 10 },
    { code: 'tasks_100', ok: stats.tasksDone >= 100 },
    { code: 'euro_100', ok: stats.totalEarned >= 100 },
    { code: 'euro_500', ok: stats.totalEarned >= 500 },
    { code: 'streak_30', ok: stats.bestStrike >= 30 },
    { code: 'first_goal', ok: stats.goalsDone >= 1 },
    { code: 'level_5', ok: stats.level >= 5 },
  ];

  const newlyUnlocked = [];
  for (const { code, ok } of toCheck) {
    if (!ok) continue;
    const def = unlock(code);
    if (def) newlyUnlocked.push(def);
  }
  return newlyUnlocked;
}
