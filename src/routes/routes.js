'use strict';

const express = require('express');
const { getDb } = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/routes  — list active routes (anyone authenticated can browse)
router.get('/', authenticate, (req, res, next) => {
  try {
    const db     = getDb();
    const routes = db.prepare(`
      SELECT r.*, u.name AS trucker_name
      FROM routes r
      JOIN users u ON u.id = r.trucker_id
      WHERE r.status = 'active'
      ORDER BY r.departure_date ASC
    `).all();
    res.json(routes);
  } catch (err) { next(err); }
});

// GET /api/routes/my  — trucker's own routes
router.get('/my', authenticate, requireRole('trucker'), (req, res, next) => {
  try {
    const db     = getDb();
    const routes = db.prepare(
      'SELECT * FROM routes WHERE trucker_id = ? ORDER BY created_at DESC'
    ).all(req.user.id);
    res.json(routes);
  } catch (err) { next(err); }
});

// GET /api/routes/:id
router.get('/:id', authenticate, (req, res, next) => {
  try {
    const db    = getDb();
    const route = db.prepare(`
      SELECT r.*, u.name AS trucker_name
      FROM routes r
      JOIN users u ON u.id = r.trucker_id
      WHERE r.id = ?
    `).get(req.params.id);
    if (!route) return res.status(404).json({ error: 'Route not found' });
    res.json(route);
  } catch (err) { next(err); }
});

// POST /api/routes  — truckers only
router.post('/', authenticate, requireRole('trucker'), (req, res, next) => {
  try {
    const { origin, destination, departure_date, route_type, avail_weight_lbs, avail_length_ft, notes } = req.body;
    if (!origin || !destination || !departure_date || !route_type || !avail_weight_lbs) {
      return res.status(400).json({
        error: 'origin, destination, departure_date, route_type, and avail_weight_lbs are required'
      });
    }
    if (!['deadmiles', 'partial'].includes(route_type)) {
      return res.status(400).json({ error: 'route_type must be deadmiles or partial' });
    }
    const db     = getDb();
    const result = db.prepare(`
      INSERT INTO routes (trucker_id, origin, destination, departure_date, route_type, avail_weight_lbs, avail_length_ft, notes)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(req.user.id, origin, destination, departure_date, route_type,
           avail_weight_lbs, avail_length_ft || null, notes || null);
    const route = db.prepare('SELECT * FROM routes WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(route);
  } catch (err) { next(err); }
});

// PUT /api/routes/:id  — trucker can update or cancel their own active route
router.put('/:id', authenticate, requireRole('trucker'), (req, res, next) => {
  try {
    const db    = getDb();
    const route = db.prepare('SELECT * FROM routes WHERE id = ?').get(req.params.id);
    if (!route) return res.status(404).json({ error: 'Route not found' });
    if (route.trucker_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (route.status !== 'active') return res.status(409).json({ error: 'Only active routes can be updated' });

    const { origin, destination, departure_date, route_type, avail_weight_lbs, avail_length_ft, notes, status } = req.body;
    if (status && !['active', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Truckers may only set status to active or cancelled' });
    }
    db.prepare(`
      UPDATE routes SET
        origin           = COALESCE(?, origin),
        destination      = COALESCE(?, destination),
        departure_date   = COALESCE(?, departure_date),
        route_type       = COALESCE(?, route_type),
        avail_weight_lbs = COALESCE(?, avail_weight_lbs),
        avail_length_ft  = COALESCE(?, avail_length_ft),
        notes            = COALESCE(?, notes),
        status           = COALESCE(?, status)
      WHERE id = ?
    `).run(origin||null, destination||null, departure_date||null, route_type||null,
           avail_weight_lbs||null, avail_length_ft||null, notes||null, status||null, req.params.id);
    res.json(db.prepare('SELECT * FROM routes WHERE id = ?').get(req.params.id));
  } catch (err) { next(err); }
});

module.exports = router;
