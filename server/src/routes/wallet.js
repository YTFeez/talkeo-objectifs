import { Router } from 'express';
import { authMiddleware } from '../auth.js';
import {
  getWalletSummary,
  getMonthEconomy,
  currentMonthKey,
  applyPercentDistribution,
  setSavingsRate,
  transferToSavings,
  requestWithdrawal,
  getChildProfile,
  applyParentBonus,
  applyPenalty,
  getTransactionHistory,
  listGoals,
} from '../economy.js';
import { checkAchievements } from '../achievements.js';
import { createNotification } from '../notifications.js';

const router = Router();

router.use(authMiddleware);

router.get('/summary', (req, res) => {
  res.json({ ...getWalletSummary(), goals: listGoals() });
});

router.get('/month', (req, res) => {
  const month = req.query.month || currentMonthKey();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Mois invalide' });
  }
  res.json(getMonthEconomy(month));
});

router.post('/apply', (req, res) => {
  if (req.role !== 'parent' && req.role !== 'admin') {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  const tasks = applyPercentDistribution();
  res.json({ ok: true, tasks, economy: getMonthEconomy() });
});

router.post('/savings-rate', (req, res) => {
  if (req.role !== 'admin') {
    return res.status(403).json({ error: 'Réservé à Aronne' });
  }
  try {
    const rate = setSavingsRate(req.body.rate);
    res.json({ savings_rate_percent: rate, profile: getChildProfile() });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/to-savings', (req, res) => {
  if (req.role !== 'admin') {
    return res.status(403).json({ error: 'Réservé à Aronne' });
  }
  try {
    transferToSavings(Number(req.body.amount));
    res.json({ profile: getChildProfile() });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/withdraw', (req, res) => {
  if (req.role !== 'admin') {
    return res.status(403).json({ error: 'Réservé à Aronne' });
  }
  try {
    const result = requestWithdrawal(Number(req.body.amount));
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/transactions', (req, res) => {
  const limit = Math.min(100, Number(req.query.limit) || 50);
  res.json({ transactions: getTransactionHistory(limit) });
});

router.post('/bonus', (req, res) => {
  if (req.role !== 'parent') return res.status(403).json({ error: 'Réservé aux parents' });
  try {
    const profile = applyParentBonus({ amount: req.body.amount, note: req.body.note || 'Bonus' });
    const achievements = checkAchievements();
    createNotification({
      type: 'bonus',
      title: 'Bonus reçu !',
      body: req.body.note || `+${req.body.amount} €`,
      target_role: 'admin',
    });
    res.json({ profile, achievements });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/penalty', (req, res) => {
  if (req.role !== 'parent') return res.status(403).json({ error: 'Réservé aux parents' });
  try {
    const profile = applyPenalty({
      amount: Number(req.body.amount) || 0,
      xp: Number(req.body.xp) || 0,
      note: req.body.note || 'Pénalité',
    });
    createNotification({
      type: 'penalty',
      title: 'Pénalité',
      body: req.body.note || 'Retrait appliqué',
      target_role: 'admin',
    });
    res.json({ profile });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
