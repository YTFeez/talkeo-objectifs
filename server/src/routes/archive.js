import { Router } from 'express';
import { authMiddleware } from '../auth.js';
import { getArchiveEntries, getArchiveSummary } from '../archive.js';

const router = Router();
router.use(authMiddleware);

/** Lecture seule — aucune suppression possible. */
router.get('/', (req, res) => {
  const { section, category, limit, offset } = req.query;
  res.json({
    summary: getArchiveSummary(),
    entries: getArchiveEntries({
      section: section || undefined,
      categoryKey: category || undefined,
      limit: limit ? Number(limit) : 200,
      offset: offset ? Number(offset) : 0,
    }),
  });
});

router.get('/:category', (req, res) => {
  const section = req.query.section === 'account' ? 'account' : 'task';
  res.json({
    section,
    category: req.params.category,
    entries: getArchiveEntries({
      section,
      categoryKey: req.params.category,
      limit: req.query.limit ? Number(req.query.limit) : 300,
    }),
  });
});

export default router;
