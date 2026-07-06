import { Router } from 'express';
import { authMiddleware, checkRole } from '../auth.js';
import { createGoal, listGoals, transferToGoal } from '../economy.js';
import { checkAchievements } from '../achievements.js';
import { createNotification } from '../notifications.js';

const router = Router();
router.use(authMiddleware);

router.get('/', (_req, res) => {
  res.json({ goals: listGoals() });
});

router.post('/', checkRole('admin'), (req, res) => {
  try {
    const goal = createGoal(req.body);
    createNotification({
      type: 'goal_created',
      title: 'Nouveau coffre',
      body: goal.title,
      target_role: 'parent',
    });
    res.status(201).json({ goal });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/:id/fund', checkRole('admin'), (req, res) => {
  try {
    const goal = transferToGoal(Number(req.params.id), Number(req.body.amount));
    const unlocked = checkAchievements();
    if (goal.status === 'completed') {
      createNotification({
        type: 'goal_reached',
        title: 'Objectif atteint !',
        body: goal.title,
        target_role: 'all',
      });
    }
    res.json({ goal, achievements: unlocked });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
