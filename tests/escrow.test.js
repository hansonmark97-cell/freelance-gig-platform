process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/app');
const firestoreMock = require('./firestoreMock');
const { BROKERAGE_FEE_RATE, DRIVER_SHARE_RATE } = require('../src/constants');

beforeEach(() => {
  firestoreMock.reset();
});

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn().mockResolvedValue({ id: 'pi_escrow_test', client_secret: 'pi_escrow_secret_mock' }),
    },
  }));
});

async function registerAndLogin(user) {
  const res = await request(app).post('/api/users/register').send(user);
  return { token: res.body.token, id: res.body.user.id };
}

async function setupDispatchedShipment(shipperToken, carrierToken) {
  const load = (await request(app).post('/api/loads').set('Authorization', `Bearer ${shipperToken}`).send({
    title: 'Escrow Test Load', description: 'Freight', origin: 'Dallas, TX', destination: 'Houston, TX',
    weightLbs: 2000, budgetUsd: 600,
  })).body;

  const quote = (await request(app).post('/api/quotes').set('Authorization', `Bearer ${carrierToken}`).send({
    loadId: load.id, amountUsd: 550, estimatedDays: 1, message: 'On it.',
  })).body;

  await request(app).put(`/api/quotes/${quote.id}/accept`).set('Authorization', `Bearer ${shipperToken}`);

  const shipment = (await request(app).post('/api/shipments').set('Authorization', `Bearer ${carrierToken}`).send({
    loadId: load.id, quoteId: quote.id,
  })).body;

  return { load, quote, shipment };
}

describe('Escrow & Auto-Payout (Component 2)', () => {
  const shipper = { name: 'Sam Shipper', email: 'sam@example.com', password: 'pass123', role: 'shipper' };
  const carrier = { name: 'Carl Carrier', email: 'carl@example.com', password: 'pass456', role: 'carrier' };

  test('BROKERAGE_FEE_RATE is 0.15', () => {
    expect(BROKERAGE_FEE_RATE).toBe(0.15);
  });

  test('DRIVER_SHARE_RATE is 0.85', () => {
    expect(DRIVER_SHARE_RATE).toBe(0.85);
  });

  test('Invoice fee split is 15% platform / 85% driver', async () => {
    const { token: shipperToken } = await registerAndLogin(shipper);
    const { token: carrierToken } = await registerAndLogin(carrier);
    const { shipment, quote } = await setupDispatchedShipment(shipperToken, carrierToken);

    // Create invoice while shipment is still dispatched (pre-delivery escrow flow)
    const invoice = (await request(app).post('/api/invoices').set('Authorization', `Bearer ${carrierToken}`).send({
      shipmentId: shipment.id,
    })).body;

    expect(invoice.status).toBe('draft');
    const expectedFee = +(quote.amountUsd * 0.15).toFixed(2);
    const expectedPayout = +(quote.amountUsd * 0.85).toFixed(2);
    expect(invoice.platformFeeUsd).toBe(expectedFee);
    expect(invoice.carrierPayoutUsd).toBe(expectedPayout);
  });

  test('POST /api/invoices - allowed when shipment is dispatched', async () => {
    const { token: shipperToken } = await registerAndLogin(shipper);
    const { token: carrierToken } = await registerAndLogin(carrier);
    const { shipment } = await setupDispatchedShipment(shipperToken, carrierToken);

    const res = await request(app).post('/api/invoices').set('Authorization', `Bearer ${carrierToken}`).send({
      shipmentId: shipment.id,
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('draft');
  });

  test('POST /api/invoices/:id/escrow - shipper can put invoice in escrow', async () => {
    const { token: shipperToken } = await registerAndLogin(shipper);
    const { token: carrierToken } = await registerAndLogin(carrier);
    const { shipment } = await setupDispatchedShipment(shipperToken, carrierToken);

    const invoice = (await request(app).post('/api/invoices').set('Authorization', `Bearer ${carrierToken}`).send({
      shipmentId: shipment.id,
    })).body;

    const res = await request(app)
      .post(`/api/invoices/${invoice.id}/escrow`)
      .set('Authorization', `Bearer ${shipperToken}`);

    expect(res.status).toBe(201);
    expect(res.body.clientSecret).toBeDefined();
    expect(res.body.status).toBe('escrowed');
    expect(res.body.platformFeeUsd).toBeDefined();
    expect(res.body.carrierPayoutUsd).toBeDefined();
  });

  test('POST /api/invoices/:id/escrow - carrier cannot escrow invoice', async () => {
    const { token: shipperToken } = await registerAndLogin(shipper);
    const { token: carrierToken } = await registerAndLogin(carrier);
    const { shipment } = await setupDispatchedShipment(shipperToken, carrierToken);

    const invoice = (await request(app).post('/api/invoices').set('Authorization', `Bearer ${carrierToken}`).send({
      shipmentId: shipment.id,
    })).body;

    const res = await request(app)
      .post(`/api/invoices/${invoice.id}/escrow`)
      .set('Authorization', `Bearer ${carrierToken}`);

    expect(res.status).toBe(403);
  });

  test('POST /api/invoices/:id/escrow - double escrow returns 400', async () => {
    const { token: shipperToken } = await registerAndLogin(shipper);
    const { token: carrierToken } = await registerAndLogin(carrier);
    const { shipment } = await setupDispatchedShipment(shipperToken, carrierToken);

    const invoice = (await request(app).post('/api/invoices').set('Authorization', `Bearer ${carrierToken}`).send({
      shipmentId: shipment.id,
    })).body;

    await request(app).post(`/api/invoices/${invoice.id}/escrow`).set('Authorization', `Bearer ${shipperToken}`);

    const res = await request(app)
      .post(`/api/invoices/${invoice.id}/escrow`)
      .set('Authorization', `Bearer ${shipperToken}`);
    expect(res.status).toBe(400);
  });

  test('POST /api/invoices/:id/pay - blocked when invoice is escrowed', async () => {
    const { token: shipperToken } = await registerAndLogin(shipper);
    const { token: carrierToken } = await registerAndLogin(carrier);
    const { shipment } = await setupDispatchedShipment(shipperToken, carrierToken);

    const invoice = (await request(app).post('/api/invoices').set('Authorization', `Bearer ${carrierToken}`).send({
      shipmentId: shipment.id,
    })).body;

    await request(app).post(`/api/invoices/${invoice.id}/escrow`).set('Authorization', `Bearer ${shipperToken}`);

    const res = await request(app)
      .post(`/api/invoices/${invoice.id}/pay`)
      .set('Authorization', `Bearer ${shipperToken}`);
    expect(res.status).toBe(400);
  });

  test('POD submission auto-releases escrowed invoice to paid', async () => {
    const { token: shipperToken } = await registerAndLogin(shipper);
    const { token: carrierToken } = await registerAndLogin(carrier);
    const { shipment } = await setupDispatchedShipment(shipperToken, carrierToken);

    // Carrier creates invoice while shipment is dispatched
    const invoice = (await request(app).post('/api/invoices').set('Authorization', `Bearer ${carrierToken}`).send({
      shipmentId: shipment.id,
    })).body;

    // Shipper puts funds in escrow upfront
    await request(app).post(`/api/invoices/${invoice.id}/escrow`).set('Authorization', `Bearer ${shipperToken}`);

    // Driver submits proof of delivery (BOL photo)
    await request(app).post(`/api/shipments/${shipment.id}/pod`)
      .set('Authorization', `Bearer ${carrierToken}`)
      .send({ signedBy: 'Receiver Alice', notes: 'Good condition', imageUrl: 'https://example.com/bol.jpg' });

    // Verify invoice was auto-released to 'paid'
    const invoiceRes = await request(app)
      .get(`/api/invoices/${invoice.id}`)
      .set('Authorization', `Bearer ${shipperToken}`);

    expect(invoiceRes.status).toBe(200);
    expect(invoiceRes.body.status).toBe('paid');
    expect(invoiceRes.body.paidAt).toBeDefined();
  });

  test('POD submission with no escrowed invoice does not error', async () => {
    const { token: shipperToken } = await registerAndLogin(shipper);
    const { token: carrierToken } = await registerAndLogin(carrier);
    const { shipment } = await setupDispatchedShipment(shipperToken, carrierToken);

    // No invoice created — POD should still succeed
    const res = await request(app).post(`/api/shipments/${shipment.id}/pod`)
      .set('Authorization', `Bearer ${carrierToken}`)
      .send({ signedBy: 'Receiver Bob' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('delivered');
  });
});
