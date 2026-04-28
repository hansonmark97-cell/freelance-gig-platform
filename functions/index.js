const functions = require('firebase-functions');
const Stripe = require('stripe');

exports.createPaymentIntent = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  const stripe = new Stripe(
    functions.config().stripe?.secret_key || process.env.STRIPE_SECRET_KEY || 'sk_test_mock',
    { apiVersion: '2023-10-16' }
  );
  const { amountUsd } = data;
  if (!amountUsd || amountUsd <= 0) throw new functions.https.HttpsError('invalid-argument', 'Invalid amount');
  const { PLATFORM_FEE_RATE } = require('../src/constants');
  const platformFeeUsd = +(amountUsd * PLATFORM_FEE_RATE).toFixed(2);
  const welderPayoutUsd = +(amountUsd * (1 - PLATFORM_FEE_RATE)).toFixed(2);
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amountUsd * 100),
    currency: 'usd',
    metadata: { platformFeeUsd, welderPayoutUsd },
  });
  return { clientSecret: paymentIntent.client_secret, platformFeeUsd, welderPayoutUsd };
});
