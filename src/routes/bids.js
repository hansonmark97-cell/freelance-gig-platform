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

// ── POST /api/bids — submit a bid ────────────────────────────────────────────
//
// Performance note: the UNIQUE(job_id, freelancer_id) constraint in the schema
// eliminates the need for a SELECT-before-INSERT duplicate check.  The DB
// enforces uniqueness atomically and returns SQLITE_CONSTRAINT_UNIQUE if the
// freelancer has already bid on this job.
router.post('/', (req, res, next) => {
  const { db, cache } = req.app.locals;
  const { job_id, freelancer_id, amount, proposal, delivery_days } = req.body;

  if (!job_id || !freelancer_id || !amount || !proposal || !delivery_days) {
    return res.status(400).json({ error: 'job_id, freelancer_id, amount, proposal, and delivery_days are required' });
  }

  try {
    const job = db.prepare('SELECT id, status FROM jobs WHERE id = ?').get(job_id);
    if (!job) return notFound(res, 'Job');
    if (job.status !== 'open') {
      return res.status(409).json({ error: 'Job is not open for bids' });
    }

    const freelancer = db.prepare('SELECT id, role FROM users WHERE id = ?').get(freelancer_id);
    if (!freelancer) return notFound(res, 'Freelancer');
    if (freelancer.role !== 'freelancer') {
      return res.status(403).json({ error: 'Only freelancers can submit bids' });
    }

    const result = db.prepare(`
      INSERT INTO bids (job_id, freelancer_id, amount, proposal, delivery_days)
      VALUES (@job_id, @freelancer_id, @amount, @proposal, @delivery_days)
    `).run({ job_id, freelancer_id, amount, proposal, delivery_days });

    // Invalidate cached job detail (bid_count changes).
    cache.invalidate(`job:${job_id}`);
    cache.invalidatePrefix('job:list:');

    const bid = db.prepare('SELECT * FROM bids WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json(bid);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'You have already bid on this job' });
    }
    return next(err);
  }
});

// ── GET /api/bids — list bids (paginated) ────────────────────────────────────
//
// Supports filtering by job_id or freelancer_id.
// Single JOIN fetches freelancer username in the same query.
router.get('/', (req, res, next) => {
  const { db } = req.app.locals;
  const { limit, offset } = parsePagination(req.query);
  const job_id = req.query.job_id ? parseInt(req.query.job_id, 10) : null;
  const freelancer_id = req.query.freelancer_id ? parseInt(req.query.freelancer_id, 10) : null;

  try {
    const rows = db.prepare(`
      SELECT b.id, b.job_id, b.amount, b.proposal, b.delivery_days, b.status,
             b.created_at,
             u.id AS freelancer_id, u.username AS freelancer_username,
             u.hourly_rate
      FROM   bids b
      JOIN   users u ON b.freelancer_id = u.id
      WHERE  (:job_id IS NULL OR b.job_id = :job_id)
        AND  (:freelancer_id IS NULL OR b.freelancer_id = :freelancer_id)
      ORDER  BY b.created_at DESC
      LIMIT  :limit OFFSET :offset
    `).all({ job_id, freelancer_id, limit, offset });

    const { total } = db.prepare(`
      SELECT COUNT(*) AS total FROM bids
      WHERE  (:job_id IS NULL OR job_id = :job_id)
        AND  (:freelancer_id IS NULL OR freelancer_id = :freelancer_id)
    `).get({ job_id, freelancer_id });

    return res.json({ data: rows, total, limit, offset });
  } catch (err) {
    return next(err);
  }
});

// ── GET /api/bids/:id — get a single bid ─────────────────────────────────────
router.get('/:id', (req, res, next) => {
  const { db } = req.app.locals;
  const id = parseInt(req.params.id, 10);

  try {
    const bid = db.prepare(`
      SELECT b.*, u.username AS freelancer_username
      FROM   bids b
      JOIN   users u ON b.freelancer_id = u.id
      WHERE  b.id = ?
    `).get(id);

    if (!bid) return notFound(res, 'Bid');
    return res.json(bid);
  } catch (err) {
    return next(err);
  }
});

// ── PATCH /api/bids/:id — update bid status ───────────────────────────────────
router.patch('/:id', (req, res, next) => {
  const { db, cache } = req.app.locals;
  const id = parseInt(req.params.id, 10);
  const { status } = req.body;

  const allowed = ['pending', 'accepted', 'rejected', 'withdrawn'];
  if (!status || !allowed.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
  }

  try {
    const existing = db.prepare('SELECT id, job_id FROM bids WHERE id = ?').get(id);
    if (!existing) return notFound(res, 'Bid');

    db.prepare(`UPDATE bids SET status = ?, updated_at = unixepoch() WHERE id = ?`).run(status, id);

    cache.invalidate(`job:${existing.job_id}`);
    cache.invalidatePrefix('job:list:');

    const bid = db.prepare('SELECT * FROM bids WHERE id = ?').get(id);
    return res.json(bid);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
