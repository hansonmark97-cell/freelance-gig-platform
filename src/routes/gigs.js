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

function gigCacheKey(params) {
  return `gig:list:${JSON.stringify(params)}`;
}

// ── POST /api/gigs — create a gig ────────────────────────────────────────────
router.post('/', (req, res, next) => {
  const { db, cache } = req.app.locals;
  const { user_id, title, description, category, price, delivery_days } = req.body;

  if (!user_id || !title || !description || !category || !price || !delivery_days) {
    return res.status(400).json({ error: 'user_id, title, description, category, price, and delivery_days are required' });
  }

  try {
    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(user_id);
    if (!user) return notFound(res, 'User');
    if (user.role !== 'freelancer') {
      return res.status(403).json({ error: 'Only freelancers can create gigs' });
    }

    const stmt = db.prepare(`
      INSERT INTO gigs (user_id, title, description, category, price, delivery_days)
      VALUES (@user_id, @title, @description, @category, @price, @delivery_days)
    `);
    const result = stmt.run({ user_id, title, description, category, price, delivery_days });

    // Invalidate all cached gig lists so the new gig is visible immediately.
    cache.invalidatePrefix('gig:list:');

    const gig = db.prepare('SELECT * FROM gigs WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json(gig);
  } catch (err) {
    return next(err);
  }
});

// ── GET /api/gigs — list active gigs (paginated, cached) ─────────────────────
//
// Performance notes:
//  - JOIN fetches owner info in the same query; no per-row follow-up needed.
//  - Results are cached per unique (category, limit, offset) combination.
//  - Composite index idx_gigs_category_status + idx_gigs_created_at are used
//    by the WHERE and ORDER BY clauses.
router.get('/', (req, res, next) => {
  const { db, cache } = req.app.locals;
  const { limit, offset } = parsePagination(req.query);
  const category = req.query.category || null;

  const cacheKey = gigCacheKey({ category, limit, offset });
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const rows = db.prepare(`
      SELECT g.id, g.title, g.description, g.category, g.price, g.delivery_days,
             g.status, g.created_at,
             u.id AS user_id, u.username, u.hourly_rate
      FROM   gigs g
      JOIN   users u ON g.user_id = u.id
      WHERE  g.status = 'active'
        AND  (:category IS NULL OR g.category = :category)
      ORDER  BY g.created_at DESC
      LIMIT  :limit OFFSET :offset
    `).all({ category, limit, offset });

    const { total } = db.prepare(`
      SELECT COUNT(*) AS total FROM gigs
      WHERE  status = 'active'
        AND  (:category IS NULL OR category = :category)
    `).get({ category });

    const payload = { data: rows, total, limit, offset };
    cache.set(cacheKey, payload);
    return res.json(payload);
  } catch (err) {
    return next(err);
  }
});

// ── GET /api/gigs/:id — get a single gig ─────────────────────────────────────
router.get('/:id', (req, res, next) => {
  const { db, cache } = req.app.locals;
  const id = parseInt(req.params.id, 10);
  const cacheKey = `gig:${id}`;

  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const gig = db.prepare(`
      SELECT g.*, u.username, u.hourly_rate
      FROM   gigs g
      JOIN   users u ON g.user_id = u.id
      WHERE  g.id = ? AND g.status != 'deleted'
    `).get(id);

    if (!gig) return notFound(res, 'Gig');
    cache.set(cacheKey, gig);
    return res.json(gig);
  } catch (err) {
    return next(err);
  }
});

// ── PATCH /api/gigs/:id — update a gig ───────────────────────────────────────
router.patch('/:id', (req, res, next) => {
  const { db, cache } = req.app.locals;
  const id = parseInt(req.params.id, 10);
  const { title, description, category, price, delivery_days, status } = req.body;

  try {
    const existing = db.prepare('SELECT id FROM gigs WHERE id = ? AND status != ?').get(id, 'deleted');
    if (!existing) return notFound(res, 'Gig');

    db.prepare(`
      UPDATE gigs
      SET    title         = COALESCE(@title, title),
             description   = COALESCE(@description, description),
             category      = COALESCE(@category, category),
             price         = COALESCE(@price, price),
             delivery_days = COALESCE(@delivery_days, delivery_days),
             status        = COALESCE(@status, status),
             updated_at    = unixepoch()
      WHERE  id = @id
    `).run({ id, title: title ?? null, description: description ?? null, category: category ?? null, price: price ?? null, delivery_days: delivery_days ?? null, status: status ?? null });

    // Invalidate individual and list caches.
    cache.invalidate(`gig:${id}`);
    cache.invalidatePrefix('gig:list:');

    const gig = db.prepare('SELECT * FROM gigs WHERE id = ?').get(id);
    return res.json(gig);
  } catch (err) {
    return next(err);
  }
});

// ── DELETE /api/gigs/:id — soft-delete a gig ─────────────────────────────────
router.delete('/:id', (req, res, next) => {
  const { db, cache } = req.app.locals;
  const id = parseInt(req.params.id, 10);

  try {
    const existing = db.prepare('SELECT id FROM gigs WHERE id = ? AND status != ?').get(id, 'deleted');
    if (!existing) return notFound(res, 'Gig');

    db.prepare(`UPDATE gigs SET status = 'deleted', updated_at = unixepoch() WHERE id = ?`).run(id);

    cache.invalidate(`gig:${id}`);
    cache.invalidatePrefix('gig:list:');

    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
