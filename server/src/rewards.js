import { getWalletSummary, getMonthEconomy, currentMonthKey, formatMonthLabel } from '../economy.js';

export { currentMonthKey, formatMonthLabel, getMonthEconomy };

export function getSummary() {
  const wallet = getWalletSummary();
  const currentKey = currentMonthKey();
  const economy = wallet.economy;

  return {
    current: {
      month: currentKey,
      label: economy.label,
      total: economy.projected_total,
      task_count: economy.completed_tasks.length,
      tasks: economy.completed_tasks,
      economy,
    },
    months: [{
      month: currentKey,
      label: economy.label,
      total: economy.projected_total,
      task_count: economy.completed_tasks.length,
      is_current: true,
    }],
    wallet: wallet.profile,
  };
}

export function getMonthDetail(monthKey) {
  const economy = getMonthEconomy(monthKey);
  return {
    month: monthKey,
    label: economy.label,
    total: economy.projected_total,
    task_count: economy.completed_tasks.length,
    tasks: economy.completed_tasks,
    economy,
  };
}

export function parseReward(value) {
  if (value === null || value === '' || value === undefined) return 0;
  const normalized = String(value).trim().replace(',', '.');
  const n = parseFloat(normalized);
  if (!Number.isFinite(n) || n < 0) throw new Error('Rémunération invalide');
  if (n > 9999) throw new Error('Montant trop élevé');
  return Math.round(n * 100) / 100;
}
