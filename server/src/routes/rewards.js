import { Router } from 'express';
import { authMiddleware } from '../auth.js';
import { getSummary, getMonthDetail, currentMonthKey } from '../rewards.js';

const router = Router();

router.use(authMiddleware);

router.use((req, res, next) => {
  if (req.role !== 'admin') {
    return res.status(403).json({ error: 'Réservé à Aronne' });
  }
  next();
});

router.get('/summary', (req, res) => {
  res.json(getSummary());
});

router.get('/', (req, res) => {
  const month = req.query.month || currentMonthKey();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Mois invalide' });
  }
  res.json(getMonthDetail(month));
});

export default router;
