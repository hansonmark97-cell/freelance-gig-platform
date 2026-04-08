const express = require('express');
const db = require('../database');

const router = express.Router();

// POST /api/reviews
router.post('/', (req, res) => {
  const { rating, comment, reviewer_id, reviewee_id, gig_id, job_id } = req.body;
  if (rating === undefined || rating === null || !comment || !reviewer_id || !reviewee_id || (!gig_id && !job_id)) {
    return res.status(400).json({ error: 'rating, comment, reviewer_id, reviewee_id, and either gig_id or job_id are required' });
  }
  if (rating < 1 || rating > 5 || !Number.isInteger(Number(rating))) {
    return res.status(400).json({ error: 'rating must be an integer between 1 and 5' });
  }
  try {
    const result = db.prepare(
      'INSERT INTO reviews (rating, comment, reviewer_id, reviewee_id, gig_id, job_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(rating, comment, reviewer_id, reviewee_id, gig_id || null, job_id || null);
    const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(review);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Duplicate review: reviewer has already reviewed this gig or job' });
    }
    throw err;
  }
});

// GET /api/reviews
router.get('/', (req, res) => {
  const { reviewee_id, reviewer_id, gig_id, job_id } = req.query;
  let query = 'SELECT * FROM reviews WHERE 1=1';
  const params = [];
  if (reviewee_id) { query += ' AND reviewee_id = ?'; params.push(reviewee_id); }
  if (reviewer_id) { query += ' AND reviewer_id = ?'; params.push(reviewer_id); }
  if (gig_id) { query += ' AND gig_id = ?'; params.push(gig_id); }
  if (job_id) { query += ' AND job_id = ?'; params.push(job_id); }
  const reviews = db.prepare(query).all(...params);
  res.json(reviews);
});

// GET /api/reviews/:id
router.get('/:id', (req, res) => {
  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
  if (!review) return res.status(404).json({ error: 'Review not found' });
  res.json(review);
});

// PUT /api/reviews/:id
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Review not found' });

  const rating = req.body.rating !== undefined ? req.body.rating : existing.rating;
  const comment = req.body.comment !== undefined ? req.body.comment : existing.comment;

  db.prepare('UPDATE reviews SET rating = ?, comment = ? WHERE id = ?').run(rating, comment, req.params.id);
  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
  res.json(review);
});

// DELETE /api/reviews/:id
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM reviews WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Review not found' });
  db.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

module.exports = router;
