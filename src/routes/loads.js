'use strict';

const express = require('express');
const { getDb } = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/loads  — list open loads (anyone authenticated can browse)
router.get('/', authenticate, (req, res, next) => {
  try {
    const db    = getDb();
    const loads = db.prepare(`
      SELECT l.*, u.name AS shipper_name
      FROM loads l
      JOIN users u ON u.id = l.shipper_id
      WHERE l.status = 'open'
      ORDER BY l.created_at DESC
    `).all();
    res.json(loads);
  } catch (err) { next(err); }
});

// GET /api/loads/my  — shipper's own loads
router.get('/my', authenticate, requireRole('shipper'), (req, res, next) => {
  try {
    const db    = getDb();
    const loads = db.prepare(
      'SELECT * FROM loads WHERE shipper_id = ? ORDER BY created_at DESC'
    ).all(req.user.id);
    res.json(loads);
  } catch (err) { next(err); }
});

// GET /api/loads/:id
router.get('/:id', authenticate, (req, res, next) => {
  try {
    const db   = getDb();
    const load = db.prepare(`
      SELECT l.*, u.name AS shipper_name
      FROM loads l
      JOIN users u ON u.id = l.shipper_id
      WHERE l.id = ?
    `).get(req.params.id);
    if (!load) return res.status(404).json({ error: 'Load not found' });
    res.json(load);
  } catch (err) { next(err); }
});

// POST /api/loads  — shippers only
router.post('/', authenticate, requireRole('shipper'), (req, res, next) => {
  try {
    const { origin, destination, freight_type, weight_lbs, length_ft, pay_usd, notes } = req.body;
    if (!origin || !destination || !freight_type || !weight_lbs || !pay_usd) {
      return res.status(400).json({ error: 'origin, destination, freight_type, weight_lbs, and pay_usd are required' });
    }
    const db     = getDb();
    const result = db.prepare(`
      INSERT INTO loads (shipper_id, origin, destination, freight_type, weight_lbs, length_ft, pay_usd, notes)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(req.user.id, origin, destination, freight_type, weight_lbs, length_ft || null, pay_usd, notes || null);
    const load = db.prepare('SELECT * FROM loads WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(load);
  } catch (err) { next(err); }
});

// PUT /api/loads/:id  — shipper can update or cancel their own open load
router.put('/:id', authenticate, requireRole('shipper'), (req, res, next) => {
  try {
    const db   = getDb();
    const load = db.prepare('SELECT * FROM loads WHERE id = ?').get(req.params.id);
    if (!load) return res.status(404).json({ error: 'Load not found' });
    if (load.shipper_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (load.status !== 'open') return res.status(409).json({ error: 'Only open loads can be updated' });

    const { origin, destination, freight_type, weight_lbs, length_ft, pay_usd, notes, status } = req.body;
    if (status && !['open', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Shippers may only set status to open or cancelled' });
    }
    db.prepare(`
      UPDATE loads SET
        origin        = COALESCE(?, origin),
        destination   = COALESCE(?, destination),
        freight_type  = COALESCE(?, freight_type),
        weight_lbs    = COALESCE(?, weight_lbs),
        length_ft     = COALESCE(?, length_ft),
        pay_usd       = COALESCE(?, pay_usd),
        notes         = COALESCE(?, notes),
        status        = COALESCE(?, status)
      WHERE id = ?
    `).run(origin||null, destination||null, freight_type||null, weight_lbs||null,
           length_ft||null, pay_usd||null, notes||null, status||null, req.params.id);
    res.json(db.prepare('SELECT * FROM loads WHERE id = ?').get(req.params.id));
  } catch (err) { next(err); }
});

module.exports = router;
