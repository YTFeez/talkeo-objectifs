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
} from '../economy.js';
import db from '../db.js';

const router = Router();

router.use(authMiddleware);

router.get('/summary', (req, res) => {
  res.json(getWalletSummary());
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
  const txs = db.prepare(`
    SELECT * FROM wallet_transactions ORDER BY created_at DESC LIMIT 50
  `).all();
  res.json({ transactions: txs });
});

export default router;
