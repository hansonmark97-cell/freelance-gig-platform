'use strict';

const express = require('express');
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/users/:id
router.get('/:id', authenticate, (req, res, next) => {
  try {
    const db   = getDb();
    const user = db.prepare(
      'SELECT id, name, email, role, phone, company, created_at FROM users WHERE id = ?'
    ).get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) { next(err); }
});

// GET /api/users/:id/reviews
router.get('/:id/reviews', authenticate, (req, res, next) => {
  try {
    const db      = getDb();
    const reviews = db.prepare(`
      SELECT r.*, u.name AS reviewer_name
      FROM reviews r
      JOIN users u ON u.id = r.reviewer_id
      WHERE r.reviewee_id = ?
      ORDER BY r.created_at DESC
    `).all(req.params.id);
    res.json(reviews);
  } catch (err) { next(err); }
});

module.exports = router;
