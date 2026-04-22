process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/app');
const firestoreMock = require('./firestoreMock');

beforeEach(() => {
  firestoreMock.reset();
});

async function registerAndLogin(user) {
  const res = await request(app).post('/api/users/register').send(user);
  return res.body.token;
}

async function createLoad(shipperToken) {
  const res = await request(app).post('/api/loads').set('Authorization', `Bearer ${shipperToken}`).send({
    title: 'Test Load', description: 'Freight', origin: 'Dallas, TX', destination: 'Houston, TX',
    weightLbs: 2000, budgetUsd: 900,
  });
  return res.body;
}

describe('Quotes API', () => {
  const shipper = { name: 'Shipper Sam', email: 'sam@example.com', password: 'pass123', role: 'shipper' };
  const carrier = { name: 'Carrier Carl', email: 'carl@example.com', password: 'pass456', role: 'carrier' };
  const carrier2 = { name: 'Carrier Dave', email: 'dave@example.com', password: 'pass789', role: 'carrier' };

  test('POST /api/quotes - carrier can submit a quote', async () => {
    const shipperToken = await registerAndLogin(shipper);
    const carrierToken = await registerAndLogin(carrier);
    const load = await createLoad(shipperToken);

    const res = await request(app).post('/api/quotes').set('Authorization', `Bearer ${carrierToken}`).send({
      loadId: load.id, amountUsd: 850, estimatedDays: 2, message: 'We can handle this.',
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    expect(res.body.loadId).toBe(load.id);
  });

  test('POST /api/quotes - shipper cannot submit a quote', async () => {
    const shipperToken = await registerAndLogin(shipper);
    const load = await createLoad(shipperToken);
    const res = await request(app).post('/api/quotes').set('Authorization', `Bearer ${shipperToken}`).send({
      loadId: load.id, amountUsd: 850, estimatedDays: 2, message: 'Msg',
    });
    expect(res.status).toBe(403);
  });

  test('POST /api/quotes - missing fields returns 400', async () => {
    const shipperToken = await registerAndLogin(shipper);
    const carrierToken = await registerAndLogin(carrier);
    const load = await createLoad(shipperToken);
    const res = await request(app).post('/api/quotes').set('Authorization', `Bearer ${carrierToken}`).send({
      loadId: load.id, amountUsd: 850,
    });
    expect(res.status).toBe(400);
  });

  test('POST /api/quotes - non-existent load returns 404', async () => {
    const carrierToken = await registerAndLogin(carrier);
    const res = await request(app).post('/api/quotes').set('Authorization', `Bearer ${carrierToken}`).send({
      loadId: 'bogus', amountUsd: 850, estimatedDays: 2, message: 'Msg',
    });
    expect(res.status).toBe(404);
  });

  test('GET /api/quotes/load/:loadId - list quotes for a load', async () => {
    const shipperToken = await registerAndLogin(shipper);
    const carrierToken = await registerAndLogin(carrier);
    const load = await createLoad(shipperToken);
    await request(app).post('/api/quotes').set('Authorization', `Bearer ${carrierToken}`)
      .send({ loadId: load.id, amountUsd: 850, estimatedDays: 2, message: 'Msg' });

    const res = await request(app).get(`/api/quotes/load/${load.id}`).set('Authorization', `Bearer ${shipperToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });

  test('GET /api/quotes/my - carrier sees own quotes', async () => {
    const shipperToken = await registerAndLogin(shipper);
    const carrierToken = await registerAndLogin(carrier);
    const load = await createLoad(shipperToken);
    await request(app).post('/api/quotes').set('Authorization', `Bearer ${carrierToken}`)
      .send({ loadId: load.id, amountUsd: 850, estimatedDays: 2, message: 'Msg' });

    const res = await request(app).get('/api/quotes/my').set('Authorization', `Bearer ${carrierToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });

  test('PUT /api/quotes/:id/accept - shipper accepts a quote', async () => {
    const shipperToken = await registerAndLogin(shipper);
    const carrierToken = await registerAndLogin(carrier);
    const load = await createLoad(shipperToken);
    const quote = (await request(app).post('/api/quotes').set('Authorization', `Bearer ${carrierToken}`)
      .send({ loadId: load.id, amountUsd: 850, estimatedDays: 2, message: 'Msg' })).body;

    const res = await request(app).put(`/api/quotes/${quote.id}/accept`).set('Authorization', `Bearer ${shipperToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('accepted');

    // Load should now be booked
    const loadRes = await request(app).get(`/api/loads/${load.id}`);
    expect(loadRes.body.status).toBe('booked');
  });

  test('PUT /api/quotes/:id/accept - accepting one quote rejects others', async () => {
    const shipperToken = await registerAndLogin(shipper);
    const carrierToken = await registerAndLogin(carrier);
    const carrier2Token = await registerAndLogin(carrier2);
    const load = await createLoad(shipperToken);

    const q1 = (await request(app).post('/api/quotes').set('Authorization', `Bearer ${carrierToken}`)
      .send({ loadId: load.id, amountUsd: 850, estimatedDays: 2, message: 'Quote 1' })).body;
    const q2 = (await request(app).post('/api/quotes').set('Authorization', `Bearer ${carrier2Token}`)
      .send({ loadId: load.id, amountUsd: 900, estimatedDays: 3, message: 'Quote 2' })).body;

    await request(app).put(`/api/quotes/${q1.id}/accept`).set('Authorization', `Bearer ${shipperToken}`);

    const q2Res = await request(app).get(`/api/quotes/load/${load.id}`).set('Authorization', `Bearer ${shipperToken}`);
    const q2Updated = q2Res.body.find(q => q.id === q2.id);
    expect(q2Updated.status).toBe('rejected');
  });

  test('PUT /api/quotes/:id/accept - carrier cannot accept a quote', async () => {
    const shipperToken = await registerAndLogin(shipper);
    const carrierToken = await registerAndLogin(carrier);
    const load = await createLoad(shipperToken);
    const quote = (await request(app).post('/api/quotes').set('Authorization', `Bearer ${carrierToken}`)
      .send({ loadId: load.id, amountUsd: 850, estimatedDays: 2, message: 'Msg' })).body;

    const res = await request(app).put(`/api/quotes/${quote.id}/accept`).set('Authorization', `Bearer ${carrierToken}`);
    expect(res.status).toBe(403);
  });

  test('PUT /api/quotes/:id/reject - shipper can reject a quote', async () => {
    const shipperToken = await registerAndLogin(shipper);
    const carrierToken = await registerAndLogin(carrier);
    const load = await createLoad(shipperToken);
    const quote = (await request(app).post('/api/quotes').set('Authorization', `Bearer ${carrierToken}`)
      .send({ loadId: load.id, amountUsd: 850, estimatedDays: 2, message: 'Msg' })).body;

    const res = await request(app).put(`/api/quotes/${quote.id}/reject`).set('Authorization', `Bearer ${shipperToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');
  });
});
