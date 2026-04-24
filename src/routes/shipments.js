const express = require('express');
const { db } = require('../firebase');
const { authenticate, requireRole } = require('../middleware/auth');
const { generateId } = require('../utils');

const router = express.Router();

// POST / — dispatch shipment (carrier only, after quote accepted)
router.post('/', authenticate, requireRole('carrier'), async (req, res) => {
  try {
    const { loadId, quoteId, driverId } = req.body;
    if (!loadId || !quoteId) {
      return res.status(400).json({ error: 'loadId and quoteId are required' });
    }

    const quoteDoc = await db.collection('quotes').doc(quoteId).get();
    if (!quoteDoc.exists) return res.status(404).json({ error: 'Quote not found' });
    const quote = quoteDoc.data();
    if (quote.carrierId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    if (quote.status !== 'accepted') return res.status(400).json({ error: 'Quote must be accepted before dispatching' });
    if (quote.loadId !== loadId) return res.status(400).json({ error: 'loadId does not match quote' });

    const loadDoc = await db.collection('loads').doc(loadId).get();
    if (!loadDoc.exists) return res.status(404).json({ error: 'Load not found' });
    const load = loadDoc.data();
    if (load.status !== 'booked') return res.status(400).json({ error: 'Load must be booked before dispatching' });

    // If driverId provided, verify the driver exists
    if (driverId) {
      const driverDoc = await db.collection('users').doc(driverId).get();
      if (!driverDoc.exists) return res.status(404).json({ error: 'Driver not found' });
      if (driverDoc.data().role !== 'driver') return res.status(400).json({ error: 'Assigned user is not a driver' });
    }

    const id = generateId();
    const createdAt = new Date().toISOString();
    const shipment = {
      id,
      loadId,
      quoteId,
      carrierId: req.user.id,
      driverId: driverId || null,
      status: 'dispatched',
      currentLocation: null,
      trackingUpdates: [],
      proofOfDelivery: null,
      createdAt,
    };

    await db.collection('shipments').doc(id).set(shipment);

    // Move load to in_transit
    await db.collection('loads').doc(loadId).update({ status: 'in_transit' });

    return res.status(201).json(shipment);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /load/:loadId — get shipment for a load
router.get('/load/:loadId', authenticate, async (req, res) => {
  try {
    const snapshot = await db.collection('shipments').where('loadId', '==', req.params.loadId).get();
    if (snapshot.empty) return res.status(404).json({ error: 'Shipment not found' });
    return res.json(snapshot.docs[0].data());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /:id — get single shipment
router.get('/:id', authenticate, async (req, res) => {
  try {
    const doc = await db.collection('shipments').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Shipment not found' });
    return res.json(doc.data());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /:id/tracking — add tracking update (driver or carrier)
router.post('/:id/tracking', authenticate, async (req, res) => {
  try {
    if (!['driver', 'carrier'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only drivers and carriers can add tracking updates' });
    }

    const doc = await db.collection('shipments').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Shipment not found' });
    const shipment = doc.data();

    if (shipment.carrierId !== req.user.id && shipment.driverId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (!['dispatched', 'in_transit'].includes(shipment.status)) {
      return res.status(400).json({ error: 'Cannot add tracking to a completed or cancelled shipment' });
    }

    const { location, note } = req.body;
    if (!location) return res.status(400).json({ error: 'location is required' });

    const update = {
      location,
      note: note || null,
      timestamp: new Date().toISOString(),
      updatedBy: req.user.id,
    };

    const updatedTracking = [...(shipment.trackingUpdates || []), update];
    await db.collection('shipments').doc(req.params.id).update({
      currentLocation: location,
      status: 'in_transit',
      trackingUpdates: updatedTracking,
    });

    const updated = await db.collection('shipments').doc(req.params.id).get();
    return res.json(updated.data());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /:id/pod — submit proof of delivery (driver or carrier)
router.post('/:id/pod', authenticate, async (req, res) => {
  try {
    if (!['driver', 'carrier'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only drivers and carriers can submit proof of delivery' });
    }

    const doc = await db.collection('shipments').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Shipment not found' });
    const shipment = doc.data();

    if (shipment.carrierId !== req.user.id && shipment.driverId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (shipment.status === 'delivered') {
      return res.status(400).json({ error: 'Shipment already delivered' });
    }
    if (!['dispatched', 'in_transit'].includes(shipment.status)) {
      return res.status(400).json({ error: 'Shipment is not active' });
    }

    const { signedBy, notes, imageUrl } = req.body;
    if (!signedBy) return res.status(400).json({ error: 'signedBy is required' });

    const proofOfDelivery = {
      signedBy,
      notes: notes || null,
      imageUrl: imageUrl || null,
      deliveredAt: new Date().toISOString(),
      submittedBy: req.user.id,
    };

    await db.collection('shipments').doc(req.params.id).update({
      status: 'delivered',
      proofOfDelivery,
    });

    // Move load to delivered
    await db.collection('loads').doc(shipment.loadId).update({ status: 'delivered' });

    // Auto-release escrowed invoice (Component 2 — Automated Escrow & Split Payments)
    const escrowedInvoiceSnap = await db.collection('invoices')
      .where('shipmentId', '==', req.params.id)
      .where('status', '==', 'escrowed')
      .get();
    if (!escrowedInvoiceSnap.empty) {
      await db.collection('invoices').doc(escrowedInvoiceSnap.docs[0].id).update({
        status: 'paid',
        paidAt: new Date().toISOString(),
      });
    }

    const updated = await db.collection('shipments').doc(req.params.id).get();
    return res.json(updated.data());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
