import db from './db.js';

export const MONTHLY_BASE = 40;
export const TIMEZONE = 'Europe/Paris';

const DURATION_WEIGHT = { short: 1, normal: 2, long: 3 };
const PRIORITY_WEIGHT = { low: 1, normal: 2, high: 3 };

const XP_STRIKE_BONUS = 5;
const LEVEL_STEP = 100;
const REWARD_LEVEL_INTERVAL = 5;
const STRIKE_BONUS_PER = 0.5;
const STRIKE_MAX_BONUS = 10;
const REACTIVE_HOURS = 48;

/** XP selon difficulté (durée × priorité). */
export function xpForTask(todo) {
  const w = taskDifficultyWeight(todo);
  if (w <= 2) return 10;
  if (w <= 4) return 30;
  if (w <= 6) return 75;
  return 150;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

export function currentMonthKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE }).slice(0, 7);
}

export function formatMonthLabel(monthKey) {
  const d = new Date(`${monthKey}-15T12:00:00`);
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: TIMEZONE });
}

export function taskDifficultyWeight(todo) {
  const d = DURATION_WEIGHT[todo.duration] || 2;
  const p = PRIORITY_WEIGHT[todo.priority] || 2;
  return d * p;
}

export function getPendingNormalTodos() {
  return db.prepare(`
    SELECT * FROM todos
    WHERE status IN ('pending', 'awaiting_validation')
      AND (task_type IS NULL OR task_type = 'normal')
    ORDER BY created_at ASC
  `).all();
}

/** Redistribute reward_percent across pending normal tasks (sum = 100). */
export function applyPercentDistribution() {
  const pending = getPendingNormalTodos();
  if (pending.length === 0) return [];

  const weights = pending.map((t) => taskDifficultyWeight(t));
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;

  let assigned = 0;
  const updates = pending.map((todo, i) => {
    let pct;
    if (i === pending.length - 1) {
      pct = round2(100 - assigned);
    } else {
      pct = round2((weights[i] / totalWeight) * 100);
      assigned += pct;
    }
    db.prepare('UPDATE todos SET reward_percent = ? WHERE id = ?').run(pct, todo.id);
    return { ...todo, reward_percent: pct };
  });

  return updates;
}

function parseDate(iso) {
  if (!iso) return null;
  const normalized = iso.includes('T') ? iso : iso.replace(' ', 'T');
  const withZone = /[Z+-]\d{2}/.test(normalized) ? normalized : `${normalized}Z`;
  const d = new Date(withZone);
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthKeyParis(iso) {
  const d = parseDate(iso);
  if (!d) return null;
  return d.toLocaleDateString('en-CA', { timeZone: TIMEZONE }).slice(0, 7);
}

export function getChildProfile() {
  let row = db.prepare('SELECT * FROM child_profile WHERE id = 1').get();
  if (!row) {
    db.prepare(`
      INSERT INTO child_profile (id, xp, level, current_strike, best_strike, current_balance, savings_balance, savings_rate_percent)
      VALUES (1, 0, 1, 0, 0, 0, 0, 20)
    `).run();
    row = db.prepare('SELECT * FROM child_profile WHERE id = 1').get();
  }
  return row;
}

export function xpToLevel(xp) {
  return Math.max(1, Math.floor(xp / LEVEL_STEP) + 1);
}

export function xpProgress(xp) {
  const inLevel = xp % LEVEL_STEP;
  return { current: inLevel, max: LEVEL_STEP, percent: round2((inLevel / LEVEL_STEP) * 100) };
}

function isReactiveCompletion(todo) {
  const completed = new Date();
  const created = parseDate(todo.created_at);
  if (!created) return false;

  if (todo.due_at) {
    const due = parseDate(todo.due_at);
    if (due && completed <= due) return true;
  }

  const hours = (completed - created) / (1000 * 60 * 60);
  return hours <= REACTIVE_HOURS;
}

export function updateStrikeOnComplete(todo) {
  const profile = getChildProfile();
  const reactive = isReactiveCompletion(todo);
  const newStrike = reactive ? profile.current_strike + 1 : 0;
  const best = Math.max(profile.best_strike, newStrike);

  db.prepare(`
    UPDATE child_profile SET current_strike = ?, best_strike = ? WHERE id = 1
  `).run(newStrike, best);

  return { current_strike: newStrike, best_strike: best, reactive };
}

export function resetStrikeOnReopen() {
  db.prepare('UPDATE child_profile SET current_strike = 0 WHERE id = 1').run();
}

export function strikeBonusAmount(strike) {
  const pct = Math.min(strike * STRIKE_BONUS_PER, STRIKE_MAX_BONUS);
  return round2((pct / 100) * MONTHLY_BASE);
}

export function awardXp(todo, strikeBonus = 0) {
  const baseXp = xpForTask(todo);
  const profile = getChildProfile();
  const gained = baseXp + strikeBonus;
  const newXp = profile.xp + gained;
  const newLevel = xpToLevel(newXp);
  db.prepare('UPDATE child_profile SET xp = ?, level = ? WHERE id = 1').run(newXp, newLevel);
  return { gained, base_xp: baseXp, xp: newXp, level: newLevel, leveled_up: newLevel > profile.level };
}

function creditEarnings(amount, note, type = 'task_reward') {
  if (amount <= 0) return;
  const profile = getChildProfile();
  const toSavings = round2((profile.savings_rate_percent / 100) * amount);
  const toCurrent = round2(amount - toSavings);
  db.prepare(`
    UPDATE child_profile SET current_balance = current_balance + ?, savings_balance = savings_balance + ? WHERE id = 1
  `).run(toCurrent, toSavings);
  db.prepare(`
    INSERT INTO wallet_transactions (type, amount, note) VALUES (?, ?, ?)
  `).run(type, amount, note);
}

export function onTodoCompleted(todo) {
  let earnedAmount = 0;
  let completedPercent = todo.reward_percent || 0;

  if (todo.task_type === 'special') {
    earnedAmount = round2(Number(todo.fixed_bonus) || 0);
  } else {
    earnedAmount = round2((completedPercent / 100) * MONTHLY_BASE);
    db.prepare(`
      UPDATE todos SET earned_amount = ?, completed_percent = ? WHERE id = ?
    `).run(earnedAmount, completedPercent, todo.id);
  }

  const strikeResult = updateStrikeOnComplete(todo);
  const strikeBonus = strikeResult.reactive ? XP_STRIKE_BONUS : 0;
  const xpResult = awardXp(todo, strikeBonus);

  creditEarnings(earnedAmount, `Tâche : ${todo.title}`);

  applyPercentDistribution();

  return {
    earned_amount: earnedAmount,
    strike: strikeResult,
    strike_bonus_eur: strikeResult.reactive ? strikeBonusAmount(strikeResult.current_strike) : 0,
    xp: xpResult,
  };
}

export function onTodoReopened(todoId) {
  db.prepare(`
    UPDATE todos SET earned_amount = NULL, completed_percent = NULL, completed_at = NULL WHERE id = ?
  `).run(todoId);
  resetStrikeOnReopen();
  applyPercentDistribution();
}

export function getMonthEconomy(monthKey = currentMonthKey()) {
  const doneNormal = db.prepare(`
    SELECT * FROM todos
    WHERE status = 'done'
      AND (task_type IS NULL OR task_type = 'normal')
      AND earned_amount IS NOT NULL
  `).all().filter((t) => monthKeyParis(t.completed_at) === monthKey);

  const doneSpecial = db.prepare(`
    SELECT * FROM todos
    WHERE status = 'done' AND task_type = 'special'
  `).all().filter((t) => monthKeyParis(t.completed_at) === monthKey);

  const pendingNormal = getPendingNormalTodos();

  const normalEarned = round2(doneNormal.reduce((s, t) => s + (t.earned_amount || 0), 0));
  const specialBonus = round2(doneSpecial.reduce((s, t) => s + (Number(t.fixed_bonus) || 0), 0));
  const pendingAtRisk = round2(
    pendingNormal.reduce((s, t) => s + ((t.reward_percent || 0) / 100) * MONTHLY_BASE, 0),
  );
  const pendingPercent = round2(pendingNormal.reduce((s, t) => s + (t.reward_percent || 0), 0));

  const profile = getChildProfile();
  const strikeBonus = strikeBonusAmount(profile.current_strike);

  const projectedTotal = round2(normalEarned + specialBonus + strikeBonus);
  const maxIfAllPending = round2(projectedTotal + pendingAtRisk);

  return {
    month: monthKey,
    label: formatMonthLabel(monthKey),
    monthly_base: MONTHLY_BASE,
    normal_earned: normalEarned,
    special_bonus: specialBonus,
    strike_bonus: strikeBonus,
    current_strike: profile.current_strike,
    best_strike: profile.best_strike,
    pending_at_risk: pendingAtRisk,
    pending_percent: pendingPercent,
    projected_total: projectedTotal,
    max_if_all_done: maxIfAllPending,
    pending_tasks: pendingNormal.map((t) => ({
      id: t.id,
      title: t.title,
      reward_percent: t.reward_percent,
      amount_at_risk: round2(((t.reward_percent || 0) / 100) * MONTHLY_BASE),
      difficulty_weight: taskDifficultyWeight(t),
    })),
    completed_tasks: [
      ...doneNormal.map((t) => ({
        id: t.id,
        title: t.title,
        type: 'normal',
        amount: t.earned_amount,
        percent: t.completed_percent,
        completed_at: t.completed_at,
      })),
      ...doneSpecial.map((t) => ({
        id: t.id,
        title: t.title,
        type: 'special',
        amount: Number(t.fixed_bonus) || 0,
        completed_at: t.completed_at,
      })),
    ],
  };
}

export function getWalletSummary() {
  const profile = getChildProfile();
  const economy = getMonthEconomy();
  const xpProg = xpProgress(profile.xp);
  const nextRewardLevel = Math.ceil(profile.level / REWARD_LEVEL_INTERVAL) * REWARD_LEVEL_INTERVAL;

  return {
    profile: {
      xp: profile.xp,
      level: profile.level,
      xp_progress: xpProg,
      current_strike: profile.current_strike,
      best_strike: profile.best_strike,
      current_balance: round2(profile.current_balance),
      savings_balance: round2(profile.savings_balance),
      savings_rate_percent: profile.savings_rate_percent,
      next_reward_level: nextRewardLevel,
      reward_level_interval: REWARD_LEVEL_INTERVAL,
    },
    economy,
    monthly_base: MONTHLY_BASE,
  };
}

export function setSavingsRate(percent) {
  const p = Math.min(100, Math.max(0, Number(percent) || 0));
  db.prepare('UPDATE child_profile SET savings_rate_percent = ? WHERE id = 1').run(p);
  return p;
}

export function transferToSavings(amount) {
  const profile = getChildProfile();
  const amt = round2(Math.min(amount, profile.current_balance));
  if (amt <= 0) throw new Error('Montant invalide');
  db.prepare(`
    UPDATE child_profile SET current_balance = current_balance - ?, savings_balance = savings_balance + ? WHERE id = 1
  `).run(amt, amt);
  db.prepare(`
    INSERT INTO wallet_transactions (type, amount, note) VALUES ('to_savings', ?, 'Transfert vers épargne')
  `).run(amt);
  return getChildProfile();
}

export function requestWithdrawal(amount) {
  const profile = getChildProfile();
  const amt = round2(amount);
  if (amt <= 0 || amt > profile.current_balance) {
    throw new Error('Montant indisponible');
  }
  db.prepare(`
    INSERT INTO wallet_transactions (type, amount, note, status) VALUES ('withdrawal_request', ?, 'Demande de retrait', 'pending')
  `).run(amt);
  return { amount: amt, status: 'pending' };
}

export function applyMonthlySavings() {
  const profile = getChildProfile();
  const economy = getMonthEconomy();
  const earned = economy.projected_total;
  const toSavings = round2((profile.savings_rate_percent / 100) * earned);
  const toCurrent = round2(earned - toSavings);

  db.prepare(`
    UPDATE child_profile
    SET current_balance = current_balance + ?,
        savings_balance = savings_balance + ?
    WHERE id = 1
  `).run(toCurrent, toSavings);

  db.prepare(`
    INSERT INTO wallet_transactions (type, amount, note) VALUES ('monthly_credit', ?, 'Crédit mensuel')
  `).run(earned);

  return getChildProfile();
}

export function parseFixedBonus(value) {
  if (value === null || value === '' || value === undefined) return 0;
  const n = parseFloat(String(value).trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) throw new Error('Bonus invalide');
  if (n > 9999) throw new Error('Montant trop élevé');
  return round2(n);
}

export function applyParentBonus({ amount, note = 'Bonus parent' }) {
  const amt = round2(amount);
  if (amt <= 0) throw new Error('Montant invalide');
  creditEarnings(amt, note, 'bonus');
  return getChildProfile();
}

export function applyPenalty({ amount = 0, xp = 0, note = 'Pénalité' }) {
  const profile = getChildProfile();
  const amt = round2(Math.min(amount, profile.current_balance));
  const xpLoss = Math.min(Math.max(0, Math.floor(xp)), profile.xp);

  if (amt > 0) {
    db.prepare('UPDATE child_profile SET current_balance = current_balance - ? WHERE id = 1').run(amt);
    db.prepare(`INSERT INTO wallet_transactions (type, amount, note) VALUES ('penalty', ?, ?)`).run(-amt, note);
  }
  if (xpLoss > 0) {
    const newXp = profile.xp - xpLoss;
    db.prepare('UPDATE child_profile SET xp = ?, level = ? WHERE id = 1').run(newXp, xpToLevel(newXp));
    db.prepare(`INSERT INTO wallet_transactions (type, amount, note) VALUES ('xp_penalty', ?, ?)`).run(-xpLoss, note);
  }
  return getChildProfile();
}

export function listGoals() {
  return db.prepare('SELECT * FROM savings_goals ORDER BY status ASC, created_at DESC').all();
}

export function createGoal({ title, target_amount }) {
  const target = round2(target_amount);
  if (!title?.trim() || target <= 0) throw new Error('Objectif invalide');
  const result = db.prepare(`
    INSERT INTO savings_goals (title, target_amount) VALUES (?, ?)
  `).run(title.trim(), target);
  return db.prepare('SELECT * FROM savings_goals WHERE id = ?').get(result.lastInsertRowid);
}

export function transferToGoal(goalId, amount) {
  const goal = db.prepare('SELECT * FROM savings_goals WHERE id = ?').get(goalId);
  if (!goal || goal.status !== 'active') throw new Error('Coffre introuvable');
  const profile = getChildProfile();
  const amt = round2(Math.min(amount, profile.current_balance));
  if (amt <= 0) throw new Error('Montant invalide');

  db.prepare('UPDATE child_profile SET current_balance = current_balance - ? WHERE id = 1').run(amt);
  const newSaved = round2(goal.saved_amount + amt);
  const completed = newSaved >= goal.target_amount;
  db.prepare(`
    UPDATE savings_goals SET saved_amount = ?, status = ?, completed_at = CASE WHEN ? THEN datetime('now') ELSE completed_at END
    WHERE id = ?
  `).run(newSaved, completed ? 'completed' : 'active', completed ? 1 : 0, goalId);

  db.prepare(`INSERT INTO wallet_transactions (type, amount, note) VALUES ('to_goal', ?, ?)`).run(amt, `Coffre : ${goal.title}`);
  return db.prepare('SELECT * FROM savings_goals WHERE id = ?').get(goalId);
}

export function getTransactionHistory(limit = 50) {
  return db.prepare('SELECT * FROM wallet_transactions ORDER BY created_at DESC LIMIT ?').all(limit);
}
