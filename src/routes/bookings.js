'use strict';

const express = require('express');
const { getDb } = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');
const { PLATFORM_FEE_RATE } = require('../constants');

const router = express.Router();

// GET /api/bookings/my  — all bookings for the logged-in user
router.get('/my', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const field = req.user.role === 'trucker' ? 'trucker_id' : 'shipper_id';
    const bookings = db.prepare(`
      SELECT b.*,
             l.origin, l.destination, l.freight_type, l.weight_lbs,
             ut.name AS trucker_name,
             us.name AS shipper_name
      FROM bookings b
      JOIN loads  l  ON l.id  = b.load_id
      JOIN users  ut ON ut.id = b.trucker_id
      JOIN users  us ON us.id = b.shipper_id
      WHERE b.${field} = ?
      ORDER BY b.created_at DESC
    `).all(req.user.id);
    res.json(bookings);
  } catch (err) { next(err); }
});

// GET /api/bookings/:id
router.get('/:id', authenticate, (req, res, next) => {
  try {
    const db      = getDb();
    const booking = db.prepare(`
      SELECT b.*,
             l.origin, l.destination, l.freight_type, l.weight_lbs,
             ut.name AS trucker_name,
             us.name AS shipper_name
      FROM bookings b
      JOIN loads  l  ON l.id  = b.load_id
      JOIN users  ut ON ut.id = b.trucker_id
      JOIN users  us ON us.id = b.shipper_id
      WHERE b.id = ?
    `).get(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.trucker_id !== req.user.id && booking.shipper_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(booking);
  } catch (err) { next(err); }
});

/**
 * POST /api/bookings
 * Truckers create a booking request against an open load + their active route.
 * Fee is stored at creation time for transparency, but only "earned" on completion.
 */
router.post('/', authenticate, requireRole('trucker'), (req, res, next) => {
  try {
    const { load_id, route_id } = req.body;
    if (!load_id || !route_id) {
      return res.status(400).json({ error: 'load_id and route_id are required' });
    }
    const db    = getDb();
    const load  = db.prepare('SELECT * FROM loads  WHERE id = ? AND status = ?').get(load_id,  'open');
    const route = db.prepare('SELECT * FROM routes WHERE id = ? AND status = ?').get(route_id, 'active');

    if (!load)  return res.status(404).json({ error: 'Open load not found' });
    if (!route) return res.status(404).json({ error: 'Active route not found' });
    if (route.trucker_id !== req.user.id) return res.status(403).json({ error: 'Route does not belong to you' });
    if (route.avail_weight_lbs < load.weight_lbs) {
      return res.status(409).json({ error: 'Route does not have enough available weight capacity' });
    }

    const platform_fee_usd   = parseFloat((load.pay_usd * PLATFORM_FEE_RATE).toFixed(2));
    const trucker_payout_usd = parseFloat((load.pay_usd - platform_fee_usd).toFixed(2));

    const result = db.prepare(`
      INSERT INTO bookings (load_id, route_id, trucker_id, shipper_id, pay_usd, platform_fee_usd, trucker_payout_usd)
      VALUES (?,?,?,?,?,?,?)
    `).run(load_id, route_id, req.user.id, load.shipper_id,
           load.pay_usd, platform_fee_usd, trucker_payout_usd);

    // Mark the load as booked so it stops appearing in open listings
    db.prepare("UPDATE loads SET status = 'booked' WHERE id = ?").run(load_id);

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(booking);
  } catch (err) { next(err); }
});

/**
 * PUT /api/bookings/:id
 * Status transitions:
 *   shipper  : pending  → accepted | cancelled
 *   trucker  : accepted → completed | cancelled
 *
 * The 9% platform fee is finalised when status moves to 'completed'.
 */
router.put('/:id', authenticate, (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required' });

    const db      = getDb();
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const isTrucker = req.user.role === 'trucker' && booking.trucker_id === req.user.id;
    const isShipper = req.user.role === 'shipper' && booking.shipper_id === req.user.id;
    if (!isTrucker && !isShipper) return res.status(403).json({ error: 'Forbidden' });

    // Validate allowed transitions
    if (isShipper) {
      if (booking.status !== 'pending') {
        return res.status(409).json({ error: 'Shipper can only act on pending bookings' });
      }
      if (!['accepted', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Shipper may set status to accepted or cancelled' });
      }
    }
    if (isTrucker) {
      if (booking.status !== 'accepted') {
        return res.status(409).json({ error: 'Trucker can only act on accepted bookings' });
      }
      if (!['completed', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Trucker may set status to completed or cancelled' });
      }
    }

    db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, booking.id);

    if (status === 'completed') {
      // Mark load and route as completed; 9% platform fee is now earned
      db.prepare("UPDATE loads  SET status = 'completed' WHERE id = ?").run(booking.load_id);
      db.prepare("UPDATE routes SET status = 'completed' WHERE id = ?").run(booking.route_id);
    }

    if (status === 'cancelled') {
      // Re-open the load so other truckers can bid
      db.prepare("UPDATE loads SET status = 'open' WHERE id = ?").run(booking.load_id);
    }

    const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(booking.id);
    res.json(updated);
  } catch (err) { next(err); }
});

module.exports = router;
