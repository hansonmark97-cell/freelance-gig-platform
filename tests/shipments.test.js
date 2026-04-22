process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/app');
const firestoreMock = require('./firestoreMock');

beforeEach(() => {
  firestoreMock.reset();
});

async function registerAndLogin(user) {
  const res = await request(app).post('/api/users/register').send(user);
  return { token: res.body.token, id: res.body.user.id };
}

async function setupBookedLoad(shipperToken, carrierToken) {
  const load = (await request(app).post('/api/loads').set('Authorization', `Bearer ${shipperToken}`).send({
    title: 'Test Load', description: 'Freight', origin: 'Memphis, TN', destination: 'Nashville, TN',
    weightLbs: 3000, budgetUsd: 700,
  })).body;

  const quote = (await request(app).post('/api/quotes').set('Authorization', `Bearer ${carrierToken}`).send({
    loadId: load.id, amountUsd: 680, estimatedDays: 1, message: 'Can do.',
  })).body;

  await request(app).put(`/api/quotes/${quote.id}/accept`).set('Authorization', `Bearer ${shipperToken}`);
  return { load, quote };
}

describe('Shipments API', () => {
  const shipper = { name: 'Sam Shipper', email: 'sam@example.com', password: 'pass123', role: 'shipper' };
  const carrier = { name: 'Carl Carrier', email: 'carl@example.com', password: 'pass456', role: 'carrier' };
  const driver = { name: 'Dave Driver', email: 'dave@example.com', password: 'pass789', role: 'driver' };

  test('POST /api/shipments - carrier dispatches a shipment', async () => {
    const { token: shipperToken } = await registerAndLogin(shipper);
    const { token: carrierToken } = await registerAndLogin(carrier);
    const { load, quote } = await setupBookedLoad(shipperToken, carrierToken);

    const res = await request(app).post('/api/shipments').set('Authorization', `Bearer ${carrierToken}`).send({
      loadId: load.id, quoteId: quote.id,
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('dispatched');
    expect(res.body.loadId).toBe(load.id);

    // Load should be in_transit
    const loadRes = await request(app).get(`/api/loads/${load.id}`);
    expect(loadRes.body.status).toBe('in_transit');
  });

  test('POST /api/shipments - carrier can assign a driver', async () => {
    const { token: shipperToken } = await registerAndLogin(shipper);
    const { token: carrierToken } = await registerAndLogin(carrier);
    const { id: driverId } = await registerAndLogin(driver);
    const { load, quote } = await setupBookedLoad(shipperToken, carrierToken);

    const res = await request(app).post('/api/shipments').set('Authorization', `Bearer ${carrierToken}`).send({
      loadId: load.id, quoteId: quote.id, driverId,
    });
    expect(res.status).toBe(201);
    expect(res.body.driverId).toBe(driverId);
  });

  test('POST /api/shipments - shipper cannot dispatch', async () => {
    const { token: shipperToken } = await registerAndLogin(shipper);
    const { token: carrierToken } = await registerAndLogin(carrier);
    const { load, quote } = await setupBookedLoad(shipperToken, carrierToken);

    const res = await request(app).post('/api/shipments').set('Authorization', `Bearer ${shipperToken}`).send({
      loadId: load.id, quoteId: quote.id,
    });
    expect(res.status).toBe(403);
  });

  test('POST /api/shipments - missing loadId or quoteId returns 400', async () => {
    const { token: carrierToken } = await registerAndLogin(carrier);
    const res = await request(app).post('/api/shipments').set('Authorization', `Bearer ${carrierToken}`).send({
      loadId: 'someId',
    });
    expect(res.status).toBe(400);
  });

  test('GET /api/shipments/:id - get shipment', async () => {
    const { token: shipperToken } = await registerAndLogin(shipper);
    const { token: carrierToken } = await registerAndLogin(carrier);
    const { load, quote } = await setupBookedLoad(shipperToken, carrierToken);

    const created = (await request(app).post('/api/shipments').set('Authorization', `Bearer ${carrierToken}`).send({
      loadId: load.id, quoteId: quote.id,
    })).body;

    const res = await request(app).get(`/api/shipments/${created.id}`).set('Authorization', `Bearer ${shipperToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.id);
  });

  test('GET /api/shipments/load/:loadId - get shipment by load', async () => {
    const { token: shipperToken } = await registerAndLogin(shipper);
    const { token: carrierToken } = await registerAndLogin(carrier);
    const { load, quote } = await setupBookedLoad(shipperToken, carrierToken);

    await request(app).post('/api/shipments').set('Authorization', `Bearer ${carrierToken}`).send({
      loadId: load.id, quoteId: quote.id,
    });

    const res = await request(app).get(`/api/shipments/load/${load.id}`).set('Authorization', `Bearer ${shipperToken}`);
    expect(res.status).toBe(200);
    expect(res.body.loadId).toBe(load.id);
  });

  test('POST /api/shipments/:id/tracking - carrier adds tracking update', async () => {
    const { token: shipperToken } = await registerAndLogin(shipper);
    const { token: carrierToken } = await registerAndLogin(carrier);
    const { load, quote } = await setupBookedLoad(shipperToken, carrierToken);

    const shipment = (await request(app).post('/api/shipments').set('Authorization', `Bearer ${carrierToken}`).send({
      loadId: load.id, quoteId: quote.id,
    })).body;

    const res = await request(app).post(`/api/shipments/${shipment.id}/tracking`)
      .set('Authorization', `Bearer ${carrierToken}`)
      .send({ location: 'Jackson, MS', note: 'On schedule' });
    expect(res.status).toBe(200);
    expect(res.body.currentLocation).toBe('Jackson, MS');
    expect(res.body.status).toBe('in_transit');
    expect(res.body.trackingUpdates.length).toBe(1);
  });

  test('POST /api/shipments/:id/tracking - shipper cannot add tracking', async () => {
    const { token: shipperToken } = await registerAndLogin(shipper);
    const { token: carrierToken } = await registerAndLogin(carrier);
    const { load, quote } = await setupBookedLoad(shipperToken, carrierToken);

    const shipment = (await request(app).post('/api/shipments').set('Authorization', `Bearer ${carrierToken}`).send({
      loadId: load.id, quoteId: quote.id,
    })).body;

    const res = await request(app).post(`/api/shipments/${shipment.id}/tracking`)
      .set('Authorization', `Bearer ${shipperToken}`)
      .send({ location: 'Somewhere' });
    expect(res.status).toBe(403);
  });

  test('POST /api/shipments/:id/pod - carrier submits proof of delivery', async () => {
    const { token: shipperToken } = await registerAndLogin(shipper);
    const { token: carrierToken } = await registerAndLogin(carrier);
    const { load, quote } = await setupBookedLoad(shipperToken, carrierToken);

    const shipment = (await request(app).post('/api/shipments').set('Authorization', `Bearer ${carrierToken}`).send({
      loadId: load.id, quoteId: quote.id,
    })).body;

    const res = await request(app).post(`/api/shipments/${shipment.id}/pod`)
      .set('Authorization', `Bearer ${carrierToken}`)
      .send({ signedBy: 'John Doe', notes: 'Received in good condition', imageUrl: 'https://example.com/pod.jpg' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('delivered');
    expect(res.body.proofOfDelivery.signedBy).toBe('John Doe');

    // Load should be delivered
    const loadRes = await request(app).get(`/api/loads/${load.id}`);
    expect(loadRes.body.status).toBe('delivered');
  });

  test('POST /api/shipments/:id/pod - missing signedBy returns 400', async () => {
    const { token: shipperToken } = await registerAndLogin(shipper);
    const { token: carrierToken } = await registerAndLogin(carrier);
    const { load, quote } = await setupBookedLoad(shipperToken, carrierToken);

    const shipment = (await request(app).post('/api/shipments').set('Authorization', `Bearer ${carrierToken}`).send({
      loadId: load.id, quoteId: quote.id,
    })).body;

    const res = await request(app).post(`/api/shipments/${shipment.id}/pod`)
      .set('Authorization', `Bearer ${carrierToken}`)
      .send({ notes: 'ok' });
    expect(res.status).toBe(400);
  });

  test('POST /api/shipments/:id/pod - double delivery returns 400', async () => {
    const { token: shipperToken } = await registerAndLogin(shipper);
    const { token: carrierToken } = await registerAndLogin(carrier);
    const { load, quote } = await setupBookedLoad(shipperToken, carrierToken);

    const shipment = (await request(app).post('/api/shipments').set('Authorization', `Bearer ${carrierToken}`).send({
      loadId: load.id, quoteId: quote.id,
    })).body;

    await request(app).post(`/api/shipments/${shipment.id}/pod`)
      .set('Authorization', `Bearer ${carrierToken}`)
      .send({ signedBy: 'Jane' });

    const res = await request(app).post(`/api/shipments/${shipment.id}/pod`)
      .set('Authorization', `Bearer ${carrierToken}`)
      .send({ signedBy: 'Jane again' });
    expect(res.status).toBe(400);
  });
});
