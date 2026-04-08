'use strict';

const express = require('express');
const router = express.Router();
const { db } = require('../firebase');

const COLLECTION = 'jobs';
const VALID_STATUSES = ['open', 'in-progress', 'completed', 'cancelled'];

// GET /api/jobs?category=&status=&clientId=
router.get('/', async (req, res) => {
  try {
    const { category, status, clientId } = req.query;
    let query = db.collection(COLLECTION);

    if (category) query = query.where('category', '==', category);
    if (status) query = query.where('status', '==', status);
    if (clientId) query = query.where('clientId', '==', clientId);

    const snapshot = await query.get();
    const jobs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/jobs/:id
router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection(COLLECTION).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Job not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/jobs
router.post('/', async (req, res) => {
  try {
    const { title, description, clientId, budget, category, deadline } = req.body;

    if (!title || !description || !clientId || budget === undefined || !category || !deadline) {
      return res.status(400).json({
        error: 'title, description, clientId, budget, category, and deadline are required',
      });
    }
    if (typeof budget !== 'number' || budget <= 0) {
      return res.status(400).json({ error: 'budget must be a positive number' });
    }

    const data = {
      title,
      description,
      clientId,
      budget,
      category,
      deadline,
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    const ref = await db.collection(COLLECTION).add(data);
    res.status(201).json({ id: ref.id, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/jobs/:id
router.put('/:id', async (req, res) => {
  try {
    const docRef = db.collection(COLLECTION).doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Job not found' });

    const allowed = ['title', 'description', 'budget', 'category', 'deadline', 'status'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (updates.status && !VALID_STATUSES.includes(updates.status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    await docRef.update(updates);
    const updated = await docRef.get();
    res.json({ id: updated.id, ...updated.data() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/jobs/:id
router.delete('/:id', async (req, res) => {
  try {
    const doc = await db.collection(COLLECTION).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Job not found' });
    await db.collection(COLLECTION).doc(req.params.id).delete();
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
