process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/app');
const firestoreMock = require('./firestoreMock');
const { PLATFORM_FEE_RATE } = require('../src/constants');

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn().mockResolvedValue({
        id: 'pi_test_123',
        client_secret: 'pi_test_123_secret_abc',
        amount: 10000,
        currency: 'usd',
        metadata: {},
      }),
    },
  }));
});

beforeEach(() => {
  firestoreMock.reset();
});

async function registerAndLogin(user) {
  const res = await request(app).post('/api/users/register').send(user);
  return res.body.token;
}

describe('Payments API', () => {
  const shopOwner = { name: 'Shop Owner', email: 'owner@example.com', password: 'pass123', role: 'shop_owner' };
  const welder = { name: 'Welder', email: 'welder@example.com', password: 'pass456', role: 'welder' };

  test('POST /api/payments/intent - shop owner can create payment intent', async () => {
    const token = await registerAndLogin(shopOwner);
    const amountUsd = 100;

    const res = await request(app).post('/api/payments/intent').set('Authorization', `Bearer ${token}`).send({ amountUsd });
    expect(res.status).toBe(201);
    expect(res.body.clientSecret).toBeDefined();
    expect(res.body.platformFeeUsd).toBeDefined();
    expect(res.body.welderPayoutUsd).toBeDefined();
  });

  test('POST /api/payments/intent - verify fee calculation', async () => {
    const token = await registerAndLogin(shopOwner);
    const amountUsd = 100;

    const res = await request(app).post('/api/payments/intent').set('Authorization', `Bearer ${token}`).send({ amountUsd });
    expect(res.status).toBe(201);

    const expectedFee = +(amountUsd * PLATFORM_FEE_RATE).toFixed(2);
    const expectedPayout = +(amountUsd * (1 - PLATFORM_FEE_RATE)).toFixed(2);

    expect(res.body.platformFeeUsd).toBe(expectedFee);
    expect(res.body.welderPayoutUsd).toBe(expectedPayout);
    expect(res.body.platformFeeUsd + res.body.welderPayoutUsd).toBeCloseTo(amountUsd, 5);
  });

  test('POST /api/payments/intent - verify 9% platform fee rate', async () => {
    const token = await registerAndLogin(shopOwner);

    const res = await request(app).post('/api/payments/intent').set('Authorization', `Bearer ${token}`).send({ amountUsd: 200 });
    expect(res.status).toBe(201);
    expect(res.body.platformFeeUsd).toBe(18); // 9% of 200
    expect(res.body.welderPayoutUsd).toBe(182); // 91% of 200
  });

  test('POST /api/payments/intent - welder cannot create payment intent', async () => {
    const token = await registerAndLogin(welder);
    const res = await request(app).post('/api/payments/intent').set('Authorization', `Bearer ${token}`).send({ amountUsd: 100 });
    expect(res.status).toBe(403);
  });

  test('POST /api/payments/intent - unauthenticated returns 401', async () => {
    const res = await request(app).post('/api/payments/intent').send({ amountUsd: 100 });
    expect(res.status).toBe(401);
  });

  test('POST /api/payments/intent - invalid amount returns 400', async () => {
    const token = await registerAndLogin(shopOwner);
    const res = await request(app).post('/api/payments/intent').set('Authorization', `Bearer ${token}`).send({ amountUsd: -50 });
    expect(res.status).toBe(400);
  });

  test('POST /api/payments/intent - missing amount returns 400', async () => {
    const token = await registerAndLogin(shopOwner);
    const res = await request(app).post('/api/payments/intent').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(400);
  });

  test('PLATFORM_FEE_RATE constant is 0.09', () => {
    expect(PLATFORM_FEE_RATE).toBe(0.09);
  });
});
