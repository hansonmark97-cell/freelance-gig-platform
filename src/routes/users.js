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

// ── POST /api/users — create a user ──────────────────────────────────────────
router.post('/', (req, res, next) => {
  const { db } = req.app.locals;
  const { username, email, role, bio, skills, hourly_rate } = req.body;

  if (!username || !email || !role) {
    return res.status(400).json({ error: 'username, email, and role are required' });
  }

  if (!['freelancer', 'client'].includes(role)) {
    return res.status(400).json({ error: "role must be 'freelancer' or 'client'" });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO users (username, email, role, bio, skills, hourly_rate)
      VALUES (@username, @email, @role, @bio, @skills, @hourly_rate)
    `);
    const result = stmt.run({ username, email, role, bio: bio || null, skills: skills || null, hourly_rate: hourly_rate || null });
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json(user);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'username or email already exists' });
    }
    return next(err);
  }
});

// ── GET /api/users — list users (paginated) ───────────────────────────────────
router.get('/', (req, res, next) => {
  const { db } = req.app.locals;
  const { limit, offset } = parsePagination(req.query);
  const { role } = req.query;

  try {
    const rows = db.prepare(`
      SELECT id, username, email, role, bio, skills, hourly_rate, created_at
      FROM   users
      WHERE  (:role IS NULL OR role = :role)
      ORDER  BY created_at DESC
      LIMIT  :limit OFFSET :offset
    `).all({ role: role || null, limit, offset });

    const { total } = db.prepare(`
      SELECT COUNT(*) AS total FROM users
      WHERE (:role IS NULL OR role = :role)
    `).get({ role: role || null });

    return res.json({ data: rows, total, limit, offset });
  } catch (err) {
    return next(err);
  }
});

// ── GET /api/users/:id — get user profile with aggregated stats ───────────────
router.get('/:id', (req, res, next) => {
  const { db } = req.app.locals;
  const id = parseInt(req.params.id, 10);

  try {
    // Fetch user and aggregate review stats in a single query to avoid N+1.
    const user = db.prepare(`
      SELECT u.id, u.username, u.email, u.role, u.bio, u.skills, u.hourly_rate,
             u.created_at,
             COUNT(r.id)    AS review_count,
             AVG(r.rating)  AS avg_rating
      FROM   users u
      LEFT JOIN reviews r ON r.reviewee_id = u.id
      WHERE  u.id = ?
      GROUP  BY u.id
    `).get(id);

    if (!user) return notFound(res, 'User');
    return res.json(user);
  } catch (err) {
    return next(err);
  }
});

// ── PATCH /api/users/:id — update a user ─────────────────────────────────────
router.patch('/:id', (req, res, next) => {
  const { db } = req.app.locals;
  const id = parseInt(req.params.id, 10);
  const { bio, skills, hourly_rate } = req.body;

  try {
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!existing) return notFound(res, 'User');

    db.prepare(`
      UPDATE users
      SET    bio         = COALESCE(@bio, bio),
             skills      = COALESCE(@skills, skills),
             hourly_rate = COALESCE(@hourly_rate, hourly_rate),
             updated_at  = unixepoch()
      WHERE  id = @id
    `).run({ id, bio: bio ?? null, skills: skills ?? null, hourly_rate: hourly_rate ?? null });

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    return res.json(user);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
