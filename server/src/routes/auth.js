import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyToken } from '../auth.js';
import { authMiddleware } from '../auth.js';
import { changePassword } from '../credentials.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Trop de tentatives, réessayez dans 15 minutes' },
});

router.post('/login', loginLimiter, (req, res) => {
  const { token } = req.body;
  const role = verifyToken(token?.trim());

  if (!role) {
    return res.status(401).json({ error: 'Code incorrect' });
  }

  res.json({
    role,
    label: role === 'admin' ? 'Arron' : 'Parent',
  });
});

router.post('/change-password', authMiddleware, loginLimiter, (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    changePassword(req.role, currentPassword?.trim(), newPassword?.trim());
    res.json({ ok: true, token: newPassword?.trim() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
