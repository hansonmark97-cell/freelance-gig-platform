const express = require('express');
const { db } = require('../firebase');
const { authenticate } = require('../middleware/auth');
const { generateId } = require('../utils');

const router = express.Router();

// POST / — create review (authenticated)
router.post('/', authenticate, async (req, res) => {
  try {
    const { revieweeId, gigId, jobId, rating, comment } = req.body;
    if (!revieweeId || rating == null || !comment) {
      return res.status(400).json({ error: 'revieweeId, rating, and comment are required' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'rating must be between 1 and 5' });
    }

    const id = generateId();
    const createdAt = new Date().toISOString();
    const review = {
      id,
      reviewerId: req.user.id,
      revieweeId,
      rating: Number(rating),
      comment,
      createdAt,
    };
    if (gigId) review.gigId = gigId;
    if (jobId) review.jobId = jobId;

    await db.collection('reviews').doc(id).set(review);
    return res.status(201).json(review);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /user/:userId — list reviews for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const snapshot = await db.collection('reviews').where('revieweeId', '==', req.params.userId).get();
    const reviews = snapshot.docs.map(d => d.data());
    return res.json(reviews);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /gig/:gigId — list reviews for a gig
router.get('/gig/:gigId', async (req, res) => {
  try {
    const snapshot = await db.collection('reviews').where('gigId', '==', req.params.gigId).get();
    const reviews = snapshot.docs.map(d => d.data());
    return res.json(reviews);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
