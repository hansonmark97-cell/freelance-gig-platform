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

function jobCacheKey(params) {
  return `job:list:${JSON.stringify(params)}`;
}

// ── POST /api/jobs — create a job ────────────────────────────────────────────
router.post('/', (req, res, next) => {
  const { db, cache } = req.app.locals;
  const { client_id, title, description, category, budget } = req.body;

  if (!client_id || !title || !description || !category || !budget) {
    return res.status(400).json({ error: 'client_id, title, description, category, and budget are required' });
  }

  try {
    const client = db.prepare('SELECT id, role FROM users WHERE id = ?').get(client_id);
    if (!client) return notFound(res, 'Client');
    if (client.role !== 'client') {
      return res.status(403).json({ error: 'Only clients can post jobs' });
    }

    const result = db.prepare(`
      INSERT INTO jobs (client_id, title, description, category, budget)
      VALUES (@client_id, @title, @description, @category, @budget)
    `).run({ client_id, title, description, category, budget });

    cache.invalidatePrefix('job:list:');

    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json(job);
  } catch (err) {
    return next(err);
  }
});

// ── GET /api/jobs — list open jobs (paginated, cached) ───────────────────────
//
// Performance notes:
//  - JOIN fetches client info alongside each job in one query.
//  - Subquery COUNT aggregates bid counts per job at the DB layer, avoiding
//    N+1 per-row queries in application code.
//  - Results are cached per (category, status, limit, offset).
router.get('/', (req, res, next) => {
  const { db, cache } = req.app.locals;
  const { limit, offset } = parsePagination(req.query);
  const category = req.query.category || null;
  const status = req.query.status || null;

  const cacheKey = jobCacheKey({ category, status, limit, offset });
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const rows = db.prepare(`
      SELECT j.id, j.title, j.description, j.category, j.budget, j.status,
             j.created_at,
             u.id AS client_id, u.username AS client_username,
             (SELECT COUNT(*) FROM bids b WHERE b.job_id = j.id) AS bid_count
      FROM   jobs j
      JOIN   users u ON j.client_id = u.id
      WHERE  (:category IS NULL OR j.category = :category)
        AND  (:status IS NULL OR j.status = :status)
      ORDER  BY j.created_at DESC
      LIMIT  :limit OFFSET :offset
    `).all({ category, status, limit, offset });

    const { total } = db.prepare(`
      SELECT COUNT(*) AS total FROM jobs
      WHERE  (:category IS NULL OR category = :category)
        AND  (:status IS NULL OR status = :status)
    `).get({ category, status });

    const payload = { data: rows, total, limit, offset };
    cache.set(cacheKey, payload);
    return res.json(payload);
  } catch (err) {
    return next(err);
  }
});

// ── GET /api/jobs/:id — get a single job with bid summary ────────────────────
router.get('/:id', (req, res, next) => {
  const { db, cache } = req.app.locals;
  const id = parseInt(req.params.id, 10);
  const cacheKey = `job:${id}`;

  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const job = db.prepare(`
      SELECT j.*, u.username AS client_username,
             (SELECT COUNT(*) FROM bids b WHERE b.job_id = j.id) AS bid_count,
             (SELECT MIN(b.amount) FROM bids b WHERE b.job_id = j.id AND b.status = 'pending') AS lowest_bid
      FROM   jobs j
      JOIN   users u ON j.client_id = u.id
      WHERE  j.id = ?
    `).get(id);

    if (!job) return notFound(res, 'Job');
    cache.set(cacheKey, job);
    return res.json(job);
  } catch (err) {
    return next(err);
  }
});

// ── PATCH /api/jobs/:id — update job status ───────────────────────────────────
router.patch('/:id', (req, res, next) => {
  const { db, cache } = req.app.locals;
  const id = parseInt(req.params.id, 10);
  const { title, description, category, budget, status } = req.body;

  try {
    const existing = db.prepare('SELECT id FROM jobs WHERE id = ?').get(id);
    if (!existing) return notFound(res, 'Job');

    db.prepare(`
      UPDATE jobs
      SET    title       = COALESCE(@title, title),
             description = COALESCE(@description, description),
             category    = COALESCE(@category, category),
             budget      = COALESCE(@budget, budget),
             status      = COALESCE(@status, status),
             updated_at  = unixepoch()
      WHERE  id = @id
    `).run({ id, title: title ?? null, description: description ?? null, category: category ?? null, budget: budget ?? null, status: status ?? null });

    cache.invalidate(`job:${id}`);
    cache.invalidatePrefix('job:list:');

    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
    return res.json(job);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
