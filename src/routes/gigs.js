'use strict';

const express = require('express');
const router = express.Router();
const { db } = require('../firebase');

const COLLECTION = 'gigs';
const VALID_STATUSES = ['active', 'paused', 'completed'];

// GET /api/gigs?category=&freelancerId=&status=
router.get('/', async (req, res) => {
  try {
    const { category, freelancerId, status } = req.query;
    let query = db.collection(COLLECTION);

    if (category) query = query.where('category', '==', category);
    if (freelancerId) query = query.where('freelancerId', '==', freelancerId);
    if (status) query = query.where('status', '==', status);

    const snapshot = await query.get();
    const gigs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(gigs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gigs/:id
router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection(COLLECTION).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Gig not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/gigs
router.post('/', async (req, res) => {
  try {
    const { title, description, freelancerId, price, category, deliveryDays } = req.body;

    if (!title || !description || !freelancerId || price === undefined || !category || !deliveryDays) {
      return res.status(400).json({
        error: 'title, description, freelancerId, price, category, and deliveryDays are required',
      });
    }
    if (typeof price !== 'number' || price <= 0) {
      return res.status(400).json({ error: 'price must be a positive number' });
    }

    const data = {
      title,
      description,
      freelancerId,
      price,
      category,
      deliveryDays,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    const ref = await db.collection(COLLECTION).add(data);
    res.status(201).json({ id: ref.id, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/gigs/:id
router.put('/:id', async (req, res) => {
  try {
    const docRef = db.collection(COLLECTION).doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Gig not found' });

    const allowed = ['title', 'description', 'price', 'category', 'deliveryDays', 'status'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (updates.status && !VALID_STATUSES.includes(updates.status)) {
      return res.status(400).json({ error: 'status must be active, paused, or completed' });
    }

    await docRef.update(updates);
    const updated = await docRef.get();
    res.json({ id: updated.id, ...updated.data() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/gigs/:id
router.delete('/:id', async (req, res) => {
  try {
    const doc = await db.collection(COLLECTION).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Gig not found' });
    await db.collection(COLLECTION).doc(req.params.id).delete();
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
