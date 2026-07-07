import db from './db.js';
import { REWARD_LEVEL_INTERVAL, getChildProfile } from './economy.js';

export function getVoucherSummary() {
  const profile = getChildProfile();
  const totalRedeemed = db.prepare('SELECT COUNT(*) AS c FROM voucher_redemptions').get().c;
  return {
    balance: profile.vouchers_balance || 0,
    total_redeemed: totalRedeemed,
    next_voucher_level: nextVoucherLevel(profile.level),
    interval: REWARD_LEVEL_INTERVAL,
    redemptions: listVoucherRedemptions(30),
  };
}

export function nextVoucherLevel(currentLevel) {
  if (currentLevel % REWARD_LEVEL_INTERVAL === 0) {
    return currentLevel + REWARD_LEVEL_INTERVAL;
  }
  return Math.ceil(currentLevel / REWARD_LEVEL_INTERVAL) * REWARD_LEVEL_INTERVAL;
}

export function listVoucherRedemptions(limit = 50) {
  const lim = Math.min(100, Math.max(1, limit));
  return db.prepare(`
    SELECT * FROM voucher_redemptions ORDER BY created_at DESC LIMIT ?
  `).all(lim);
}

export function redeemVoucher({ item, note = '', redeemedBy = 'Parent' }) {
  const title = item?.trim();
  if (!title) throw new Error('Indiquez ce qui a été pris');

  const profile = getChildProfile();
  const balance = profile.vouchers_balance || 0;
  if (balance <= 0) throw new Error('Aucun bon disponible');

  db.prepare('UPDATE child_profile SET vouchers_balance = vouchers_balance - 1 WHERE id = 1').run();

  const result = db.prepare(`
    INSERT INTO voucher_redemptions (item_title, note, level_at_redemption, redeemed_by)
    VALUES (?, ?, ?, ?)
  `).run(title, note.trim(), profile.level, redeemedBy);

  return {
    balance: balance - 1,
    redemption: db.prepare('SELECT * FROM voucher_redemptions WHERE id = ?').get(result.lastInsertRowid),
  };
}

export function backfillVouchers() {
  const profile = getChildProfile();
  const balance = profile.vouchers_balance || 0;
  const redeemed = db.prepare('SELECT COUNT(*) AS c FROM voucher_redemptions').get().c;
  if (balance > 0 || redeemed > 0) return;

  const earned = Math.floor(profile.level / REWARD_LEVEL_INTERVAL);
  if (earned > 0) {
    db.prepare('UPDATE child_profile SET vouchers_balance = ? WHERE id = 1').run(earned);
  }
}

backfillVouchers();
