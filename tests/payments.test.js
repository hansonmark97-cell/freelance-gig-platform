'use strict';

const request = require('supertest');

// Mock firebase before importing the app
jest.mock('../src/firebase', () => {
  const { mockDb } = require('./firestoreMock');
  return { db: mockDb };
});

// Mock the stripe module
jest.mock('stripe', () => {
  return jest.fn(() => ({
    paymentIntents: {
      create: jest.fn().mockResolvedValue({
        id: 'pi_test_123456',
        client_secret: 'pi_test_123456_secret_abc',
        amount: 5000,
        currency: 'usd',
        status: 'requires_payment_method',
      }),
    },
  }));
});

process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';

const app = require('../src/app');
const { mockDb } = require('./firestoreMock');

beforeEach(() => mockDb.reset());

describe('Payments API', () => {
  test('POST /api/payments/intent - creates a payment intent successfully', async () => {
    const res = await request(app)
      .post('/api/payments/intent')
      .send({ amount: 5000 });
    expect(res.status).toBe(200);
    expect(res.body.clientSecret).toBe('pi_test_123456_secret_abc');
  });

  test('POST /api/payments/intent - returns clientSecret in response', async () => {
    const res = await request(app)
      .post('/api/payments/intent')
      .send({ amount: 1000, currency: 'usd' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('clientSecret');
  });

  test('POST /api/payments/intent - uses default USD currency', async () => {
    const Stripe = require('stripe');
    const mockStripeInstance = Stripe.mock.results[0].value;
    await request(app).post('/api/payments/intent').send({ amount: 2000 });
    expect(mockStripeInstance.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'usd' })
    );
  });

  test('POST /api/payments/intent - returns 400 if amount is missing', async () => {
    const res = await request(app).post('/api/payments/intent').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/amount/);
  });

  test('POST /api/payments/intent - returns 400 if amount is not positive', async () => {
    const res = await request(app)
      .post('/api/payments/intent')
      .send({ amount: -500 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/positive/);
  });

  test('POST /api/payments/intent - returns 400 if amount is zero', async () => {
    const res = await request(app).post('/api/payments/intent').send({ amount: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/positive/);
  });
});
