const express = require('express');
const Stripe = require('stripe');
const { authenticate, requireRole } = require('../middleware/auth');
const { PLATFORM_FEE_RATE } = require('../constants');

const router = express.Router();

// Initialize Stripe once at module load
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', {
  apiVersion: '2023-10-16',
});

// POST /intent — create Stripe PaymentIntent (shop owner only)
router.post('/intent', authenticate, requireRole('shop_owner'), async (req, res) => {
  try {
    const { amountUsd } = req.body;
    if (!amountUsd || amountUsd <= 0) {
      return res.status(400).json({ error: 'amountUsd must be a positive number' });
    }

    const platformFeeUsd = +(amountUsd * PLATFORM_FEE_RATE).toFixed(2);
    const welderPayoutUsd = +(amountUsd * (1 - PLATFORM_FEE_RATE)).toFixed(2);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amountUsd * 100),
      currency: 'usd',
      metadata: { platformFeeUsd, welderPayoutUsd },
    });

    return res.status(201).json({
      clientSecret: paymentIntent.client_secret,
      platformFeeUsd,
      welderPayoutUsd,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
