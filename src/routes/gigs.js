const express = require('express');
const { db } = require('../firebase');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// POST / — create gig (freelancer only)
router.post('/', authenticate, requireRole('freelancer'), async (req, res) => {
  try {
    const { title, description, category, priceUsd, deliveryDays } = req.body;
    if (!title || !description || !category || priceUsd == null || !deliveryDays) {
      return res.status(400).json({ error: 'title, description, category, priceUsd, and deliveryDays are required' });
    }

    const id = generateId();
    const createdAt = new Date().toISOString();
    const gig = {
      id,
      freelancerId: req.user.id,
      title,
      description,
      category,
      priceUsd: Number(priceUsd),
      deliveryDays: Number(deliveryDays),
      status: 'active',
      createdAt,
    };

    await db.collection('gigs').doc(id).set(gig);
    return res.status(201).json(gig);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET / — list gigs
router.get('/', async (req, res) => {
  try {
    const { category, minPrice, maxPrice, status } = req.query;
    let query = db.collection('gigs').where('status', '==', status || 'active');

    if (category) query = query.where('category', '==', category);
    if (minPrice != null) query = query.where('priceUsd', '>=', Number(minPrice));
    if (maxPrice != null) query = query.where('priceUsd', '<=', Number(maxPrice));

    const snapshot = await query.get();
    const gigs = snapshot.docs.map(d => d.data());
    return res.json(gigs);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /:id — get single gig
router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection('gigs').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Gig not found' });
    return res.json(doc.data());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /:id — update gig (owner only)
router.put('/:id', authenticate, async (req, res) => {
  try {
    const doc = await db.collection('gigs').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Gig not found' });
    const gig = doc.data();
    if (gig.freelancerId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

    const { title, description, category, priceUsd, deliveryDays, status } = req.body;
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (category !== undefined) updates.category = category;
    if (priceUsd !== undefined) updates.priceUsd = Number(priceUsd);
    if (deliveryDays !== undefined) updates.deliveryDays = Number(deliveryDays);
    if (status !== undefined) updates.status = status;

    await db.collection('gigs').doc(req.params.id).update(updates);
    const updated = await db.collection('gigs').doc(req.params.id).get();
    return res.json(updated.data());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /:id — soft delete (owner only)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const doc = await db.collection('gigs').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Gig not found' });
    const gig = doc.data();
    if (gig.freelancerId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

    await db.collection('gigs').doc(req.params.id).update({ status: 'deleted' });
    return res.json({ message: 'Gig deleted' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
