const express = require('express');
const { db } = require('../firebase');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// POST / — place bid (freelancer only)
router.post('/', authenticate, requireRole('freelancer'), async (req, res) => {
  try {
    const { jobId, amountUsd, message } = req.body;
    if (!jobId || amountUsd == null || !message) {
      return res.status(400).json({ error: 'jobId, amountUsd, and message are required' });
    }

    const jobDoc = await db.collection('jobs').doc(jobId).get();
    if (!jobDoc.exists) return res.status(404).json({ error: 'Job not found' });
    const job = jobDoc.data();
    if (job.status !== 'open') return res.status(400).json({ error: 'Job is not open for bids' });

    const id = generateId();
    const createdAt = new Date().toISOString();
    const bid = {
      id,
      jobId,
      freelancerId: req.user.id,
      amountUsd: Number(amountUsd),
      message,
      status: 'pending',
      createdAt,
    };

    await db.collection('bids').doc(id).set(bid);
    return res.status(201).json(bid);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /job/:jobId — list bids for a job (authenticated)
router.get('/job/:jobId', authenticate, async (req, res) => {
  try {
    const snapshot = await db.collection('bids').where('jobId', '==', req.params.jobId).get();
    const bids = snapshot.docs.map(d => d.data());
    return res.json(bids);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /my — list my bids (freelancer)
router.get('/my', authenticate, requireRole('freelancer'), async (req, res) => {
  try {
    const snapshot = await db.collection('bids').where('freelancerId', '==', req.user.id).get();
    const bids = snapshot.docs.map(d => d.data());
    return res.json(bids);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /:id/accept — accept bid (client, job owner only)
router.put('/:id/accept', authenticate, requireRole('client'), async (req, res) => {
  try {
    const bidDoc = await db.collection('bids').doc(req.params.id).get();
    if (!bidDoc.exists) return res.status(404).json({ error: 'Bid not found' });
    const bid = bidDoc.data();

    const jobDoc = await db.collection('jobs').doc(bid.jobId).get();
    if (!jobDoc.exists) return res.status(404).json({ error: 'Job not found' });
    const job = jobDoc.data();
    if (job.clientId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

    // Accept this bid
    await db.collection('bids').doc(req.params.id).update({ status: 'accepted' });

    // Set job to in_progress
    await db.collection('jobs').doc(bid.jobId).update({ status: 'in_progress' });

    // Reject all other bids on this job
    const otherBids = await db.collection('bids').where('jobId', '==', bid.jobId).where('status', '==', 'pending').get();
    const rejectPromises = otherBids.docs
      .filter(d => d.id !== req.params.id)
      .map(d => db.collection('bids').doc(d.id).update({ status: 'rejected' }));
    await Promise.all(rejectPromises);

    const updated = await db.collection('bids').doc(req.params.id).get();
    return res.json(updated.data());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /:id/reject — reject bid (client, job owner only)
router.put('/:id/reject', authenticate, requireRole('client'), async (req, res) => {
  try {
    const bidDoc = await db.collection('bids').doc(req.params.id).get();
    if (!bidDoc.exists) return res.status(404).json({ error: 'Bid not found' });
    const bid = bidDoc.data();

    const jobDoc = await db.collection('jobs').doc(bid.jobId).get();
    if (!jobDoc.exists) return res.status(404).json({ error: 'Job not found' });
    const job = jobDoc.data();
    if (job.clientId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

    await db.collection('bids').doc(req.params.id).update({ status: 'rejected' });
    const updated = await db.collection('bids').doc(req.params.id).get();
    return res.json(updated.data());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
