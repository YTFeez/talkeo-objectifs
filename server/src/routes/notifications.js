import { Router } from 'express';
import { authMiddleware } from '../auth.js';
import { listNotifications, unreadCount, markRead, markAllRead } from '../notifications.js';

const router = Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  res.json({
    notifications: listNotifications(req.role),
    unread: unreadCount(req.role),
  });
});

router.post('/read-all', (req, res) => {
  markAllRead(req.role);
  res.json({ ok: true, unread: 0 });
});

router.patch('/:id/read', (req, res) => {
  markRead(Number(req.params.id));
  res.json({ ok: true, unread: unreadCount(req.role) });
});

export default router;
