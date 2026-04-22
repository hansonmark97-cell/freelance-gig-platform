const express = require('express');
const { db } = require('../firebase');
const { authenticate, requireRole } = require('../middleware/auth');
const { generateId } = require('../utils');

const router = express.Router();

// POST / — submit quote (carrier only)
router.post('/', authenticate, requireRole('carrier'), async (req, res) => {
  try {
    const { loadId, amountUsd, estimatedDays, message } = req.body;
    if (!loadId || amountUsd == null || !estimatedDays || !message) {
      return res.status(400).json({ error: 'loadId, amountUsd, estimatedDays, and message are required' });
    }

    const loadDoc = await db.collection('loads').doc(loadId).get();
    if (!loadDoc.exists) return res.status(404).json({ error: 'Load not found' });
    const load = loadDoc.data();
    if (load.status !== 'open') return res.status(400).json({ error: 'Load is not open for quotes' });

    const id = generateId();
    const createdAt = new Date().toISOString();
    const quote = {
      id,
      loadId,
      carrierId: req.user.id,
      amountUsd: Number(amountUsd),
      estimatedDays: Number(estimatedDays),
      message,
      status: 'pending',
      createdAt,
    };

    await db.collection('quotes').doc(id).set(quote);
    return res.status(201).json(quote);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /load/:loadId — list quotes for a load (authenticated)
router.get('/load/:loadId', authenticate, async (req, res) => {
  try {
    const snapshot = await db.collection('quotes').where('loadId', '==', req.params.loadId).get();
    const quotes = snapshot.docs.map(d => d.data());
    return res.json(quotes);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /my — list my quotes (carrier)
router.get('/my', authenticate, requireRole('carrier'), async (req, res) => {
  try {
    const snapshot = await db.collection('quotes').where('carrierId', '==', req.user.id).get();
    const quotes = snapshot.docs.map(d => d.data());
    return res.json(quotes);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /:id/accept — accept quote (shipper, load owner only)
router.put('/:id/accept', authenticate, requireRole('shipper'), async (req, res) => {
  try {
    const quoteDoc = await db.collection('quotes').doc(req.params.id).get();
    if (!quoteDoc.exists) return res.status(404).json({ error: 'Quote not found' });
    const quote = quoteDoc.data();

    const loadDoc = await db.collection('loads').doc(quote.loadId).get();
    if (!loadDoc.exists) return res.status(404).json({ error: 'Load not found' });
    const load = loadDoc.data();
    if (load.shipperId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    if (load.status !== 'open') return res.status(400).json({ error: 'Load is no longer open' });

    // Accept this quote
    await db.collection('quotes').doc(req.params.id).update({ status: 'accepted' });

    // Move load to booked
    await db.collection('loads').doc(quote.loadId).update({ status: 'booked' });

    // Reject all other pending quotes for this load
    const otherQuotes = await db.collection('quotes')
      .where('loadId', '==', quote.loadId)
      .where('status', '==', 'pending')
      .get();
    const rejectPromises = otherQuotes.docs
      .filter(d => d.id !== req.params.id)
      .map(d => db.collection('quotes').doc(d.id).update({ status: 'rejected' }));
    await Promise.all(rejectPromises);

    const updated = await db.collection('quotes').doc(req.params.id).get();
    return res.json(updated.data());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /:id/reject — reject quote (shipper, load owner only)
router.put('/:id/reject', authenticate, requireRole('shipper'), async (req, res) => {
  try {
    const quoteDoc = await db.collection('quotes').doc(req.params.id).get();
    if (!quoteDoc.exists) return res.status(404).json({ error: 'Quote not found' });
    const quote = quoteDoc.data();

    const loadDoc = await db.collection('loads').doc(quote.loadId).get();
    if (!loadDoc.exists) return res.status(404).json({ error: 'Load not found' });
    const load = loadDoc.data();
    if (load.shipperId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

    await db.collection('quotes').doc(req.params.id).update({ status: 'rejected' });
    const updated = await db.collection('quotes').doc(req.params.id).get();
    return res.json(updated.data());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
