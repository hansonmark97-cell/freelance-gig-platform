const express = require('express');
const { db } = require('../firebase');
const { authenticate, requireRole } = require('../middleware/auth');
const { generateId } = require('../utils');

const router = express.Router();

// POST / — create job (client only)
router.post('/', authenticate, requireRole('client'), async (req, res) => {
  try {
    const { title, description, category, budgetUsd } = req.body;
    if (!title || !description || !category || budgetUsd == null) {
      return res.status(400).json({ error: 'title, description, category, and budgetUsd are required' });
    }

    const id = generateId();
    const createdAt = new Date().toISOString();
    const job = {
      id,
      clientId: req.user.id,
      title,
      description,
      category,
      budgetUsd: Number(budgetUsd),
      status: 'open',
      createdAt,
    };

    await db.collection('jobs').doc(id).set(job);
    return res.status(201).json(job);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET / — list jobs (supports search, page, limit)
router.get('/', async (req, res) => {
  try {
    const { category, status, search, page, limit } = req.query;
    let query = db.collection('jobs').where('status', '==', status || 'open');

    if (category) query = query.where('category', '==', category);

    const snapshot = await query.get();
    let jobs = snapshot.docs.map(d => d.data());

    if (search) {
      const term = search.toLowerCase();
      jobs = jobs.filter(j =>
        j.title.toLowerCase().includes(term) ||
        j.description.toLowerCase().includes(term)
      );
    }

    const total = jobs.length;
    res.set('X-Total-Count', String(total));

    if (page !== undefined || limit !== undefined) {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const start = (pageNum - 1) * limitNum;
      jobs = jobs.slice(start, start + limitNum);
      res.set('X-Page', String(pageNum));
      res.set('X-Limit', String(limitNum));
    }

    return res.json(jobs);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /:id — get single job
router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection('jobs').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Job not found' });
    return res.json(doc.data());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /:id — update job (owner only)
router.put('/:id', authenticate, async (req, res) => {
  try {
    const doc = await db.collection('jobs').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Job not found' });
    const job = doc.data();
    if (job.clientId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

    const { title, description, budgetUsd, status } = req.body;
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (budgetUsd !== undefined) updates.budgetUsd = Number(budgetUsd);
    if (status !== undefined) updates.status = status;

    await db.collection('jobs').doc(req.params.id).update(updates);
    const updated = await db.collection('jobs').doc(req.params.id).get();
    return res.json(updated.data());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /:id — cancel job (owner only)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const doc = await db.collection('jobs').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Job not found' });
    const job = doc.data();
    if (job.clientId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

    await db.collection('jobs').doc(req.params.id).update({ status: 'cancelled' });
    return res.json({ message: 'Job cancelled' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
