import { Router } from 'express';
import { authMiddleware } from '../auth.js';
import { listAchievements } from '../achievements.js';

const router = Router();
router.use(authMiddleware);

router.get('/', (_req, res) => {
  res.json({ achievements: listAchievements() });
});

export default router;
