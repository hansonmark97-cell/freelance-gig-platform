const express = require('express');
const db = require('../database');

const router = express.Router();

// POST /api/bids
router.post('/', (req, res) => {
  const { amount, proposal, freelancer_id, gig_id, job_id } = req.body;
  if (!amount || !proposal || !freelancer_id || (!gig_id && !job_id)) {
    return res.status(400).json({ error: 'amount, proposal, freelancer_id, and either gig_id or job_id are required' });
  }
  try {
    const result = db.prepare(
      'INSERT INTO bids (amount, proposal, freelancer_id, gig_id, job_id) VALUES (?, ?, ?, ?, ?)'
    ).run(amount, proposal, freelancer_id, gig_id || null, job_id || null);
    const bid = db.prepare('SELECT * FROM bids WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(bid);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Duplicate bid: freelancer has already bid on this gig or job' });
    }
    throw err;
  }
});

// GET /api/bids
router.get('/', (req, res) => {
  const { gig_id, job_id, freelancer_id, status } = req.query;
  let query = 'SELECT * FROM bids WHERE 1=1';
  const params = [];
  if (gig_id) { query += ' AND gig_id = ?'; params.push(gig_id); }
  if (job_id) { query += ' AND job_id = ?'; params.push(job_id); }
  if (freelancer_id) { query += ' AND freelancer_id = ?'; params.push(freelancer_id); }
  if (status) { query += ' AND status = ?'; params.push(status); }
  const bids = db.prepare(query).all(...params);
  res.json(bids);
});

// GET /api/bids/:id
router.get('/:id', (req, res) => {
  const bid = db.prepare('SELECT * FROM bids WHERE id = ?').get(req.params.id);
  if (!bid) return res.status(404).json({ error: 'Bid not found' });
  res.json(bid);
});

// PUT /api/bids/:id
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM bids WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Bid not found' });

  const status = req.body.status !== undefined ? req.body.status : existing.status;
  db.prepare('UPDATE bids SET status = ? WHERE id = ?').run(status, req.params.id);
  const bid = db.prepare('SELECT * FROM bids WHERE id = ?').get(req.params.id);
  res.json(bid);
});

// DELETE /api/bids/:id
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM bids WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Bid not found' });
  db.prepare('DELETE FROM bids WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

module.exports = router;
