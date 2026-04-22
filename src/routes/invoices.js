const express = require('express');
const Stripe = require('stripe');
const { db } = require('../firebase');
const { authenticate, requireRole } = require('../middleware/auth');
const { generateId } = require('../utils');
const { PLATFORM_FEE_RATE } = require('../constants');

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', {
  apiVersion: '2023-10-16',
});

// POST / — generate invoice for a delivered shipment (carrier only)
router.post('/', authenticate, requireRole('carrier'), async (req, res) => {
  try {
    const { shipmentId } = req.body;
    if (!shipmentId) return res.status(400).json({ error: 'shipmentId is required' });

    const shipmentDoc = await db.collection('shipments').doc(shipmentId).get();
    if (!shipmentDoc.exists) return res.status(404).json({ error: 'Shipment not found' });
    const shipment = shipmentDoc.data();

    if (shipment.carrierId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    if (shipment.status !== 'delivered') return res.status(400).json({ error: 'Invoice can only be generated for delivered shipments' });

    // Check no invoice already exists
    const existingSnap = await db.collection('invoices').where('shipmentId', '==', shipmentId).get();
    if (!existingSnap.empty) return res.status(409).json({ error: 'Invoice already exists for this shipment' });

    const quoteDoc = await db.collection('quotes').doc(shipment.quoteId).get();
    if (!quoteDoc.exists) return res.status(404).json({ error: 'Quote not found' });
    const quote = quoteDoc.data();

    const loadDoc = await db.collection('loads').doc(shipment.loadId).get();
    if (!loadDoc.exists) return res.status(404).json({ error: 'Load not found' });
    const load = loadDoc.data();

    const amountUsd = quote.amountUsd;
    const platformFeeUsd = +(amountUsd * PLATFORM_FEE_RATE).toFixed(2);
    const carrierPayoutUsd = +(amountUsd * (1 - PLATFORM_FEE_RATE)).toFixed(2);

    const id = generateId();
    const createdAt = new Date().toISOString();
    const invoice = {
      id,
      shipmentId,
      loadId: shipment.loadId,
      shipperId: load.shipperId,
      carrierId: req.user.id,
      amountUsd,
      platformFeeUsd,
      carrierPayoutUsd,
      status: 'draft',
      createdAt,
    };

    await db.collection('invoices').doc(id).set(invoice);
    return res.status(201).json(invoice);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /my — list invoices for the current user (shipper sees as payer, carrier sees as payee)
router.get('/my', authenticate, async (req, res) => {
  try {
    let snapshot;
    if (req.user.role === 'shipper') {
      snapshot = await db.collection('invoices').where('shipperId', '==', req.user.id).get();
    } else if (req.user.role === 'carrier') {
      snapshot = await db.collection('invoices').where('carrierId', '==', req.user.id).get();
    } else {
      return res.status(403).json({ error: 'Only shippers and carriers can view invoices' });
    }
    const invoices = snapshot.docs.map(d => d.data());
    return res.json(invoices);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /:id — get single invoice (shipper or carrier party)
router.get('/:id', authenticate, async (req, res) => {
  try {
    const doc = await db.collection('invoices').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Invoice not found' });
    const invoice = doc.data();
    if (invoice.shipperId !== req.user.id && invoice.carrierId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    return res.json(invoice);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /:id/pay — create Stripe PaymentIntent and mark invoice as sent (shipper only)
router.post('/:id/pay', authenticate, requireRole('shipper'), async (req, res) => {
  try {
    const doc = await db.collection('invoices').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Invoice not found' });
    const invoice = doc.data();
    if (invoice.shipperId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    if (invoice.status === 'paid') return res.status(400).json({ error: 'Invoice already paid' });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(invoice.amountUsd * 100),
      currency: 'usd',
      metadata: {
        invoiceId: invoice.id,
        platformFeeUsd: invoice.platformFeeUsd,
        carrierPayoutUsd: invoice.carrierPayoutUsd,
      },
    });

    await db.collection('invoices').doc(req.params.id).update({ status: 'sent' });

    return res.status(201).json({
      clientSecret: paymentIntent.client_secret,
      platformFeeUsd: invoice.platformFeeUsd,
      carrierPayoutUsd: invoice.carrierPayoutUsd,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
