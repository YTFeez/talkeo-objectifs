import { Router } from 'express';
import { authMiddleware } from '../auth.js';
import { getSummary, getMonthDetail, currentMonthKey } from '../rewards.js';
import { getWalletSummary, listGoals } from '../economy.js';

const router = Router();

router.use(authMiddleware);

router.get('/summary', (req, res) => {
  const wallet = getWalletSummary();
  const payload = { ...getSummary(), wallet, goals: listGoals() };
  res.json(payload);
});

router.get('/', (req, res) => {
  if (req.role !== 'admin') {
    return res.status(403).json({ error: 'Réservé à Aronne' });
  }
  const month = req.query.month || currentMonthKey();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Mois invalide' });
  }
  res.json(getMonthDetail(month));
});

export default router;
