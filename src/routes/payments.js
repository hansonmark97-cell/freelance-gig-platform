'use strict';

const express = require('express');
const router = express.Router();
const Stripe = require('stripe');

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  return Stripe(key);
}

// POST /api/payments/intent
router.post('/intent', async (req, res) => {
  try {
    const { amount, currency = 'usd' } = req.body;

    if (amount === undefined || amount === null) {
      return res.status(400).json({ error: 'amount is required' });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number in cents' });
    }

    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      payment_method_types: ['card'],
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    if (err.message === 'STRIPE_SECRET_KEY is not configured') {
      return res.status(500).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
