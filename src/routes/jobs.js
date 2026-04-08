const express = require('express');
const db = require('../database');

const router = express.Router();

// POST /api/jobs
router.post('/', (req, res) => {
  const { title, description, skills_required, budget_min, budget_max, client_id } = req.body;
  if (!title || !description || !skills_required || budget_min === undefined || budget_min === null ||
      budget_max === undefined || budget_max === null || !client_id) {
    return res.status(400).json({ error: 'title, description, skills_required, budget_min, budget_max, and client_id are required' });
  }
  const result = db.prepare(
    'INSERT INTO jobs (title, description, skills_required, budget_min, budget_max, client_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(title, description, skills_required, budget_min, budget_max, client_id);
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(job);
});

// GET /api/jobs
router.get('/', (req, res) => {
  const { status, client_id } = req.query;
  let query = 'SELECT * FROM jobs WHERE 1=1';
  const params = [];
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (client_id) { query += ' AND client_id = ?'; params.push(client_id); }
  const jobs = db.prepare(query).all(...params);
  res.json(jobs);
});

// GET /api/jobs/:id
router.get('/:id', (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

// PUT /api/jobs/:id
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Job not found' });

  const title = req.body.title !== undefined ? req.body.title : existing.title;
  const description = req.body.description !== undefined ? req.body.description : existing.description;
  const skills_required = req.body.skills_required !== undefined ? req.body.skills_required : existing.skills_required;
  const budget_min = req.body.budget_min !== undefined ? req.body.budget_min : existing.budget_min;
  const budget_max = req.body.budget_max !== undefined ? req.body.budget_max : existing.budget_max;
  const status = req.body.status !== undefined ? req.body.status : existing.status;

  db.prepare(
    'UPDATE jobs SET title = ?, description = ?, skills_required = ?, budget_min = ?, budget_max = ?, status = ? WHERE id = ?'
  ).run(title, description, skills_required, budget_min, budget_max, status, req.params.id);
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  res.json(job);
});

// DELETE /api/jobs/:id
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM jobs WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Job not found' });
  db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

module.exports = router;
