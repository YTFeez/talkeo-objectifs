import { Router } from 'express';
import { authMiddleware } from '../auth.js';
import { getChildProfile } from '../economy.js';
import { getVoucherSummary, redeemVoucher } from '../vouchers.js';
import { createNotification } from '../notifications.js';

const router = Router();

router.use(authMiddleware);

router.get('/', (req, res) => {
  res.json(getVoucherSummary());
});

router.post('/redeem', (req, res) => {
  if (req.role !== 'parent') {
    return res.status(403).json({ error: 'Réservé aux parents' });
  }
  try {
    const { item, note = '' } = req.body;
    const { balance, redemption } = redeemVoucher({
      item,
      note,
      redeemedBy: req.label || 'Parent',
    });
    createNotification({
      type: 'voucher_redeemed',
      title: 'Bon utilisé',
      body: `${redemption.item_title} — il reste ${balance} bon${balance !== 1 ? 's' : ''}`,
      target_role: 'admin',
    });
    res.json({ balance, redemption, profile: getChildProfile() });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
