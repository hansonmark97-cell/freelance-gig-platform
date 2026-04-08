'use strict';

const express = require('express');
const router = express.Router();
const { db } = require('../firebase');

const COLLECTION = 'reviews';

// GET /api/reviews?revieweeId=&gigId=&jobId=
router.get('/', async (req, res) => {
  try {
    const { revieweeId, gigId, jobId } = req.query;
    let query = db.collection(COLLECTION);

    if (revieweeId) query = query.where('revieweeId', '==', revieweeId);
    if (gigId) query = query.where('gigId', '==', gigId);
    if (jobId) query = query.where('jobId', '==', jobId);

    const snapshot = await query.get();
    const reviews = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reviews/:id
router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection(COLLECTION).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Review not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reviews
router.post('/', async (req, res) => {
  try {
    const { reviewerId, revieweeId, rating, comment, gigId, jobId } = req.body;

    if (!reviewerId || !revieweeId || rating === undefined || !comment) {
      return res.status(400).json({
        error: 'reviewerId, revieweeId, rating, and comment are required',
      });
    }
    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'rating must be a number between 1 and 5' });
    }
    if (!gigId && !jobId) {
      return res.status(400).json({ error: 'Either gigId or jobId is required' });
    }

    const data = {
      reviewerId,
      revieweeId,
      rating,
      comment,
      gigId: gigId || null,
      jobId: jobId || null,
      createdAt: new Date().toISOString(),
    };
    const ref = await db.collection(COLLECTION).add(data);
    res.status(201).json({ id: ref.id, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/reviews/:id
router.delete('/:id', async (req, res) => {
  try {
    const doc = await db.collection(COLLECTION).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Review not found' });
    await db.collection(COLLECTION).doc(req.params.id).delete();
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
