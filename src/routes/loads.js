const express = require('express');
const { db } = require('../firebase');
const { authenticate, requireRole } = require('../middleware/auth');
const { generateId } = require('../utils');

const router = express.Router();

// POST / — create load (shipper only)
router.post('/', authenticate, requireRole('shipper'), async (req, res) => {
  try {
    const { title, description, origin, destination, weightLbs, freightClass, budgetUsd, pickupDate, deliveryDate } = req.body;
    if (!title || !description || !origin || !destination || weightLbs == null || budgetUsd == null) {
      return res.status(400).json({ error: 'title, description, origin, destination, weightLbs, and budgetUsd are required' });
    }

    const id = generateId();
    const createdAt = new Date().toISOString();
    const load = {
      id,
      shipperId: req.user.id,
      title,
      description,
      origin,
      destination,
      weightLbs: Number(weightLbs),
      freightClass: freightClass || null,
      budgetUsd: Number(budgetUsd),
      pickupDate: pickupDate || null,
      deliveryDate: deliveryDate || null,
      status: 'open',
      createdAt,
    };

    await db.collection('loads').doc(id).set(load);
    return res.status(201).json(load);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET / — list loads (filterable by status, origin, destination)
router.get('/', async (req, res) => {
  try {
    const { status, origin, destination } = req.query;
    let query = db.collection('loads').where('status', '==', status || 'open');

    if (origin) query = query.where('origin', '==', origin);
    if (destination) query = query.where('destination', '==', destination);

    const snapshot = await query.get();
    const loads = snapshot.docs.map(d => d.data());
    return res.json(loads);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /:id — get single load
router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection('loads').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Load not found' });
    return res.json(doc.data());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /:id — update load (shipper owner only, only when open)
router.put('/:id', authenticate, requireRole('shipper'), async (req, res) => {
  try {
    const doc = await db.collection('loads').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Load not found' });
    const load = doc.data();
    if (load.shipperId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    if (load.status !== 'open') return res.status(400).json({ error: 'Only open loads can be updated' });

    const { title, description, origin, destination, weightLbs, freightClass, budgetUsd, pickupDate, deliveryDate } = req.body;
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (origin !== undefined) updates.origin = origin;
    if (destination !== undefined) updates.destination = destination;
    if (weightLbs !== undefined) updates.weightLbs = Number(weightLbs);
    if (freightClass !== undefined) updates.freightClass = freightClass;
    if (budgetUsd !== undefined) updates.budgetUsd = Number(budgetUsd);
    if (pickupDate !== undefined) updates.pickupDate = pickupDate;
    if (deliveryDate !== undefined) updates.deliveryDate = deliveryDate;

    await db.collection('loads').doc(req.params.id).update(updates);
    const updated = await db.collection('loads').doc(req.params.id).get();
    return res.json(updated.data());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /:id — cancel load (shipper owner only, only when open)
router.delete('/:id', authenticate, requireRole('shipper'), async (req, res) => {
  try {
    const doc = await db.collection('loads').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Load not found' });
    const load = doc.data();
    if (load.shipperId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    if (load.status !== 'open') return res.status(400).json({ error: 'Only open loads can be cancelled' });

    await db.collection('loads').doc(req.params.id).update({ status: 'cancelled' });
    return res.json({ message: 'Load cancelled' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
