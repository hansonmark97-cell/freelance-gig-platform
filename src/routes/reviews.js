'use strict';

const express = require('express');
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/reviews  — only on completed bookings
router.post('/', authenticate, (req, res, next) => {
  try {
    const { booking_id, reviewee_id, rating, comment } = req.body;
    if (!booking_id || !reviewee_id || !rating) {
      return res.status(400).json({ error: 'booking_id, reviewee_id, and rating are required' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'rating must be between 1 and 5' });
    }
    const db      = getDb();
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(booking_id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status !== 'completed') {
      return res.status(409).json({ error: 'Reviews can only be left on completed bookings' });
    }
    if (booking.trucker_id !== req.user.id && booking.shipper_id !== req.user.id) {
      return res.status(403).json({ error: 'You were not part of this booking' });
    }
    if (Number(reviewee_id) === req.user.id) {
      return res.status(400).json({ error: 'You cannot review yourself' });
    }
    if (reviewee_id !== booking.trucker_id && reviewee_id !== booking.shipper_id) {
      return res.status(400).json({ error: 'Reviewee was not part of this booking' });
    }

    let result;
    try {
      result = db.prepare(
        'INSERT INTO reviews (booking_id, reviewer_id, reviewee_id, rating, comment) VALUES (?,?,?,?,?)'
      ).run(booking_id, req.user.id, reviewee_id, rating, comment || null);
    } catch (e) {
      if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'You already reviewed this booking' });
      throw e;
    }
    const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(review);
  } catch (err) { next(err); }
});

// GET /api/reviews/booking/:booking_id
router.get('/booking/:booking_id', authenticate, (req, res, next) => {
  try {
    const db      = getDb();
    const reviews = db.prepare(`
      SELECT r.*, u.name AS reviewer_name
      FROM reviews r
      JOIN users u ON u.id = r.reviewer_id
      WHERE r.booking_id = ?
    `).all(req.params.booking_id);
    res.json(reviews);
  } catch (err) { next(err); }
});

module.exports = router;
