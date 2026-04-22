process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/app');
const firestoreMock = require('./firestoreMock');

beforeEach(() => {
  firestoreMock.reset();
});

// Mock Stripe so no real HTTP calls are made
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn().mockResolvedValue({ client_secret: 'pi_test_secret_mock' }),
    },
  }));
});

async function registerAndLogin(user) {
  const res = await request(app).post('/api/users/register').send(user);
  return { token: res.body.token, id: res.body.user.id };
}

async function setupDeliveredShipment(shipperToken, carrierToken) {
  const load = (await request(app).post('/api/loads').set('Authorization', `Bearer ${shipperToken}`).send({
    title: 'Load', description: 'Goods', origin: 'Austin, TX', destination: 'San Antonio, TX',
    weightLbs: 1000, budgetUsd: 500,
  })).body;

  const quote = (await request(app).post('/api/quotes').set('Authorization', `Bearer ${carrierToken}`).send({
    loadId: load.id, amountUsd: 480, estimatedDays: 1, message: 'Ready.',
  })).body;

  await request(app).put(`/api/quotes/${quote.id}/accept`).set('Authorization', `Bearer ${shipperToken}`);

  const shipment = (await request(app).post('/api/shipments').set('Authorization', `Bearer ${carrierToken}`).send({
    loadId: load.id, quoteId: quote.id,
  })).body;

  await request(app).post(`/api/shipments/${shipment.id}/pod`)
    .set('Authorization', `Bearer ${carrierToken}`)
    .send({ signedBy: 'Receiver Bob' });

  return { load, quote, shipment };
}

describe('Invoices API', () => {
  const shipper = { name: 'Sam Shipper', email: 'sam@example.com', password: 'pass123', role: 'shipper' };
  const carrier = { name: 'Carl Carrier', email: 'carl@example.com', password: 'pass456', role: 'carrier' };

  test('POST /api/invoices - carrier generates invoice for delivered shipment', async () => {
    const { token: shipperToken } = await registerAndLogin(shipper);
    const { token: carrierToken } = await registerAndLogin(carrier);
    const { shipment, quote } = await setupDeliveredShipment(shipperToken, carrierToken);

    const res = await request(app).post('/api/invoices').set('Authorization', `Bearer ${carrierToken}`).send({
      shipmentId: shipment.id,
    });
    expect(res.status).toBe(201);
    expect(res.body.amountUsd).toBe(quote.amountUsd);
    expect(res.body.status).toBe('draft');
    expect(res.body.platformFeeUsd).toBeDefined();
    expect(res.body.carrierPayoutUsd).toBeDefined();
    expect(res.body.carrierPayoutUsd).toBeLessThan(res.body.amountUsd);
  });

  test('POST /api/invoices - shipper cannot generate invoice', async () => {
    const { token: shipperToken } = await registerAndLogin(shipper);
    const { token: carrierToken } = await registerAndLogin(carrier);
    const { shipment } = await setupDeliveredShipment(shipperToken, carrierToken);

    const res = await request(app).post('/api/invoices').set('Authorization', `Bearer ${shipperToken}`).send({
      shipmentId: shipment.id,
    });
    expect(res.status).toBe(403);
  });

  test('POST /api/invoices - missing shipmentId returns 400', async () => {
    const { token: carrierToken } = await registerAndLogin(carrier);
    const res = await request(app).post('/api/invoices').set('Authorization', `Bearer ${carrierToken}`).send({});
    expect(res.status).toBe(400);
  });

  test('POST /api/invoices - non-existent shipment returns 404', async () => {
    const { token: carrierToken } = await registerAndLogin(carrier);
    const res = await request(app).post('/api/invoices').set('Authorization', `Bearer ${carrierToken}`).send({
      shipmentId: 'bogus',
    });
    expect(res.status).toBe(404);
  });

  test('POST /api/invoices - duplicate invoice returns 409', async () => {
    const { token: shipperToken } = await registerAndLogin(shipper);
    const { token: carrierToken } = await registerAndLogin(carrier);
    const { shipment } = await setupDeliveredShipment(shipperToken, carrierToken);

    await request(app).post('/api/invoices').set('Authorization', `Bearer ${carrierToken}`).send({ shipmentId: shipment.id });
    const res = await request(app).post('/api/invoices').set('Authorization', `Bearer ${carrierToken}`).send({ shipmentId: shipment.id });
    expect(res.status).toBe(409);
  });

  test('GET /api/invoices/my - shipper sees their invoices', async () => {
    const { token: shipperToken } = await registerAndLogin(shipper);
    const { token: carrierToken } = await registerAndLogin(carrier);
    const { shipment } = await setupDeliveredShipment(shipperToken, carrierToken);
    await request(app).post('/api/invoices').set('Authorization', `Bearer ${carrierToken}`).send({ shipmentId: shipment.id });

    const res = await request(app).get('/api/invoices/my').set('Authorization', `Bearer ${shipperToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });

  test('GET /api/invoices/my - carrier sees their invoices', async () => {
    const { token: shipperToken } = await registerAndLogin(shipper);
    const { token: carrierToken } = await registerAndLogin(carrier);
    const { shipment } = await setupDeliveredShipment(shipperToken, carrierToken);
    await request(app).post('/api/invoices').set('Authorization', `Bearer ${carrierToken}`).send({ shipmentId: shipment.id });

    const res = await request(app).get('/api/invoices/my').set('Authorization', `Bearer ${carrierToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });

  test('GET /api/invoices/:id - parties can read their invoice', async () => {
    const { token: shipperToken } = await registerAndLogin(shipper);
    const { token: carrierToken } = await registerAndLogin(carrier);
    const { shipment } = await setupDeliveredShipment(shipperToken, carrierToken);
    const invoice = (await request(app).post('/api/invoices').set('Authorization', `Bearer ${carrierToken}`)
      .send({ shipmentId: shipment.id })).body;

    const res = await request(app).get(`/api/invoices/${invoice.id}`).set('Authorization', `Bearer ${shipperToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(invoice.id);
  });

  test('POST /api/invoices/:id/pay - shipper pays invoice', async () => {
    const { token: shipperToken } = await registerAndLogin(shipper);
    const { token: carrierToken } = await registerAndLogin(carrier);
    const { shipment } = await setupDeliveredShipment(shipperToken, carrierToken);
    const invoice = (await request(app).post('/api/invoices').set('Authorization', `Bearer ${carrierToken}`)
      .send({ shipmentId: shipment.id })).body;

    const res = await request(app).post(`/api/invoices/${invoice.id}/pay`).set('Authorization', `Bearer ${shipperToken}`);
    expect(res.status).toBe(201);
    expect(res.body.clientSecret).toBeDefined();
  });

  test('POST /api/invoices/:id/pay - carrier cannot pay invoice', async () => {
    const { token: shipperToken } = await registerAndLogin(shipper);
    const { token: carrierToken } = await registerAndLogin(carrier);
    const { shipment } = await setupDeliveredShipment(shipperToken, carrierToken);
    const invoice = (await request(app).post('/api/invoices').set('Authorization', `Bearer ${carrierToken}`)
      .send({ shipmentId: shipment.id })).body;

    const res = await request(app).post(`/api/invoices/${invoice.id}/pay`).set('Authorization', `Bearer ${carrierToken}`);
    expect(res.status).toBe(403);
  });
});
