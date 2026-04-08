'use strict';

const express = require('express');
const router = express.Router();
const { db } = require('../firebase');

const COLLECTION = 'bids';
const VALID_STATUSES = ['pending', 'accepted', 'rejected'];

// GET /api/bids?jobId=&freelancerId=
router.get('/', async (req, res) => {
  try {
    const { jobId, freelancerId } = req.query;
    let query = db.collection(COLLECTION);

    if (jobId) query = query.where('jobId', '==', jobId);
    if (freelancerId) query = query.where('freelancerId', '==', freelancerId);

    const snapshot = await query.get();
    const bids = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(bids);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bids/:id
router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection(COLLECTION).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Bid not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bids
router.post('/', async (req, res) => {
  try {
    const { jobId, freelancerId, amount, message, deliveryDays } = req.body;

    if (!jobId || !freelancerId || amount === undefined || !message || !deliveryDays) {
      return res.status(400).json({
        error: 'jobId, freelancerId, amount, message, and deliveryDays are required',
      });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    const data = {
      jobId,
      freelancerId,
      amount,
      message,
      deliveryDays,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    const ref = await db.collection(COLLECTION).add(data);
    res.status(201).json({ id: ref.id, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/bids/:id/status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'status must be pending, accepted, or rejected' });
    }

    const docRef = db.collection(COLLECTION).doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Bid not found' });

    await docRef.update({ status });
    const updated = await docRef.get();
    res.json({ id: updated.id, ...updated.data() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/bids/:id
router.delete('/:id', async (req, res) => {
  try {
    const doc = await db.collection(COLLECTION).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Bid not found' });
    await db.collection(COLLECTION).doc(req.params.id).delete();
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
