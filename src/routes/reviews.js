'use strict';

const { Router } = require('express');

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

function parsePagination(query) {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const offset = Math.max(parseInt(query.offset, 10) || 0, 0);
  return { limit, offset };
}

function notFound(res, resource = 'Resource') {
  return res.status(404).json({ error: `${resource} not found` });
}

// ── POST /api/reviews — submit a review ──────────────────────────────────────
//
// Performance note: the UNIQUE(reviewer_id, job_id) constraint eliminates a
// separate existence-check query — the INSERT will fail atomically if the
// reviewer has already reviewed this job.
router.post('/', (req, res, next) => {
  const { db } = req.app.locals;
  const { reviewer_id, reviewee_id, job_id, rating, comment } = req.body;

  if (!reviewer_id || !reviewee_id || !job_id || !rating) {
    return res.status(400).json({ error: 'reviewer_id, reviewee_id, job_id, and rating are required' });
  }

  if (!Number.isInteger(Number(rating)) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'rating must be an integer between 1 and 5' });
  }

  try {
    const job = db.prepare('SELECT id FROM jobs WHERE id = ?').get(job_id);
    if (!job) return notFound(res, 'Job');

    const result = db.prepare(`
      INSERT INTO reviews (reviewer_id, reviewee_id, job_id, rating, comment)
      VALUES (@reviewer_id, @reviewee_id, @job_id, @rating, @comment)
    `).run({ reviewer_id, reviewee_id, job_id, rating, comment: comment || null });

    const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json(review);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'You have already reviewed this job' });
    }
    return next(err);
  }
});

// ── GET /api/reviews — list reviews (paginated) ───────────────────────────────
//
// Performance note: reviewer and reviewee usernames are fetched via JOINs in
// one query, avoiding per-row lookups.
router.get('/', (req, res, next) => {
  const { db } = req.app.locals;
  const { limit, offset } = parsePagination(req.query);
  const reviewee_id = req.query.reviewee_id ? parseInt(req.query.reviewee_id, 10) : null;

  try {
    const rows = db.prepare(`
      SELECT rv.id, rv.job_id, rv.rating, rv.comment, rv.created_at,
             ru.id AS reviewer_id, ru.username AS reviewer_username,
             re.id AS reviewee_id, re.username AS reviewee_username
      FROM   reviews rv
      JOIN   users ru ON rv.reviewer_id = ru.id
      JOIN   users re ON rv.reviewee_id = re.id
      WHERE  (:reviewee_id IS NULL OR rv.reviewee_id = :reviewee_id)
      ORDER  BY rv.created_at DESC
      LIMIT  :limit OFFSET :offset
    `).all({ reviewee_id, limit, offset });

    const { total } = db.prepare(`
      SELECT COUNT(*) AS total FROM reviews
      WHERE  (:reviewee_id IS NULL OR reviewee_id = :reviewee_id)
    `).get({ reviewee_id });

    return res.json({ data: rows, total, limit, offset });
  } catch (err) {
    return next(err);
  }
});

// ── GET /api/reviews/summary/:userId — aggregated rating summary ──────────────
//
// Performance note: AVG and COUNT are computed in a single DB aggregate query
// rather than fetching all rows and computing in JS.  The idx_reviews_reviewee_id
// index makes this O(log n) + one pass over the matching rows.
router.get('/summary/:userId', (req, res, next) => {
  const { db } = req.app.locals;
  const userId = parseInt(req.params.userId, 10);

  try {
    const summary = db.prepare(`
      SELECT reviewee_id,
             COUNT(*)       AS review_count,
             AVG(rating)    AS avg_rating,
             MIN(rating)    AS min_rating,
             MAX(rating)    AS max_rating
      FROM   reviews
      WHERE  reviewee_id = ?
    `).get(userId);

    if (!summary || summary.review_count === 0) {
      return res.json({ reviewee_id: userId, review_count: 0, avg_rating: null, min_rating: null, max_rating: null });
    }

    return res.json(summary);
  } catch (err) {
    return next(err);
  }
});

// ── GET /api/reviews/:id — get a single review ───────────────────────────────
router.get('/:id', (req, res, next) => {
  const { db } = req.app.locals;
  const id = parseInt(req.params.id, 10);

  try {
    const review = db.prepare(`
      SELECT rv.*, ru.username AS reviewer_username, re.username AS reviewee_username
      FROM   reviews rv
      JOIN   users ru ON rv.reviewer_id = ru.id
      JOIN   users re ON rv.reviewee_id = re.id
      WHERE  rv.id = ?
    `).get(id);

    if (!review) return notFound(res, 'Review');
    return res.json(review);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
