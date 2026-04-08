const express = require('express');
const db = require('../database');

const router = express.Router();

// POST /api/gigs
router.post('/', (req, res) => {
  const { title, description, category, budget, client_id } = req.body;
  if (!title || !description || !category || budget === undefined || budget === null || !client_id) {
    return res.status(400).json({ error: 'title, description, category, budget, and client_id are required' });
  }
  const result = db.prepare(
    'INSERT INTO gigs (title, description, category, budget, client_id) VALUES (?, ?, ?, ?, ?)'
  ).run(title, description, category, budget, client_id);
  const gig = db.prepare('SELECT * FROM gigs WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(gig);
});

// GET /api/gigs
router.get('/', (req, res) => {
  const { status, category, client_id } = req.query;
  let query = 'SELECT * FROM gigs WHERE 1=1';
  const params = [];
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (category) { query += ' AND category = ?'; params.push(category); }
  if (client_id) { query += ' AND client_id = ?'; params.push(client_id); }
  const gigs = db.prepare(query).all(...params);
  res.json(gigs);
});

// GET /api/gigs/:id
router.get('/:id', (req, res) => {
  const gig = db.prepare('SELECT * FROM gigs WHERE id = ?').get(req.params.id);
  if (!gig) return res.status(404).json({ error: 'Gig not found' });
  res.json(gig);
});

// PUT /api/gigs/:id
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM gigs WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Gig not found' });

  const title = req.body.title !== undefined ? req.body.title : existing.title;
  const description = req.body.description !== undefined ? req.body.description : existing.description;
  const category = req.body.category !== undefined ? req.body.category : existing.category;
  const budget = req.body.budget !== undefined ? req.body.budget : existing.budget;
  const status = req.body.status !== undefined ? req.body.status : existing.status;

  db.prepare(
    'UPDATE gigs SET title = ?, description = ?, category = ?, budget = ?, status = ? WHERE id = ?'
  ).run(title, description, category, budget, status, req.params.id);
  const gig = db.prepare('SELECT * FROM gigs WHERE id = ?').get(req.params.id);
  res.json(gig);
});

// DELETE /api/gigs/:id
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM gigs WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Gig not found' });
  db.prepare('DELETE FROM gigs WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

module.exports = router;
