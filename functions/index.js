'use strict';

const admin = require('firebase-admin');

// Initialise Firebase Admin if not already done (Functions runtime may pre-initialise it)
if (!admin.apps.length) {
  admin.initializeApp();
}

const functions = require('firebase-functions');
const Stripe = require('stripe');

// ---------------------------------------------------------------------------
// Helper: lazily-init Stripe using runtime config or env var
// ---------------------------------------------------------------------------
let _stripe = null;
function getStripe() {
  if (!_stripe) {
    const key =
      (functions.config().stripe && functions.config().stripe.secret_key) ||
      process.env.STRIPE_SECRET_KEY;
    if (!key) throw new functions.https.HttpsError('internal', 'Stripe is not configured');
    _stripe = Stripe(key);
  }
  return _stripe;
}

// ---------------------------------------------------------------------------
// Callable Cloud Function: createPaymentIntent
//
// Client call (web):
//   const fn = httpsCallable(functions, 'createPaymentIntent');
//   const { data } = await fn({ amount: 5000 }); // 5000 cents = $50.00 USD
//   const { clientSecret } = data;
// ---------------------------------------------------------------------------
exports.createPaymentIntent = functions.https.onCall(async (data) => {
  const { amount, currency = 'usd' } = data;

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'amount must be a positive number in cents'
    );
  }

  const stripe = getStripe();
  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency,
    payment_method_types: ['card'],
  });

  return { clientSecret: paymentIntent.client_secret };
});
