import { Router } from 'express';
import { authMiddleware, checkRole } from '../auth.js';
import { parseReward } from '../rewards.js';
import { listSuggestions, createSuggestion, deleteSuggestion } from '../seedSuggestions.js';

const router = Router();

router.use(authMiddleware);

router.get('/', (_req, res) => {
  res.json({ suggestions: listSuggestions() });
});

router.post('/', checkRole('parent'), (req, res) => {
  const { title, reward = 0, priority = 'normal', duration = 'normal' } = req.body;

  if (!title?.trim()) {
    return res.status(400).json({ error: 'Le titre est obligatoire' });
  }

  const prio = ['low', 'normal', 'high'].includes(priority) ? priority : 'normal';
  const dur = ['short', 'normal', 'long'].includes(duration) ? duration : 'normal';

  let rewardAmount = 0;
  try {
    rewardAmount = parseReward(reward);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const existing = listSuggestions().find(
    (s) => s.title.toLowerCase() === title.trim().toLowerCase(),
  );
  if (existing) {
    return res.status(400).json({ error: 'Cette idée existe déjà' });
  }

  const suggestion = createSuggestion({
    title: title.trim(),
    reward: rewardAmount,
    priority: prio,
    duration: dur,
  });

  res.status(201).json({ suggestion });
});

router.delete('/:id', checkRole('parent'), (req, res) => {
  try {
    const removed = deleteSuggestion(req.params.id);
    if (!removed) {
      return res.status(404).json({ error: 'Idée introuvable' });
    }
    res.json({ ok: true });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message });
  }
});

export default router;
