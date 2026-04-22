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

describe('Loads API', () => {
  const shipper = { name: 'Shipper Sam', email: 'sam@example.com', password: 'pass123', role: 'shipper' };
  const carrier = { name: 'Carrier Carl', email: 'carl@example.com', password: 'pass456', role: 'carrier' };

  test('POST /api/loads - shipper can create a load', async () => {
    const token = await registerAndLogin(shipper);
    const res = await request(app).post('/api/loads').set('Authorization', `Bearer ${token}`).send({
      title: 'Midwest Freight',
      description: 'Pallets to Chicago',
      origin: 'Detroit, MI',
      destination: 'Chicago, IL',
      weightLbs: 5000,
      freightClass: '70',
      budgetUsd: 1200,
      pickupDate: '2026-05-01',
      deliveryDate: '2026-05-02',
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('open');
    expect(res.body.shipperId).toBeDefined();
    expect(res.body.origin).toBe('Detroit, MI');
  });

  test('POST /api/loads - carrier cannot create a load', async () => {
    const token = await registerAndLogin(carrier);
    const res = await request(app).post('/api/loads').set('Authorization', `Bearer ${token}`).send({
      title: 'Load',
      description: 'Desc',
      origin: 'A',
      destination: 'B',
      weightLbs: 1000,
      budgetUsd: 500,
    });
    expect(res.status).toBe(403);
  });

  test('POST /api/loads - missing required fields returns 400', async () => {
    const token = await registerAndLogin(shipper);
    const res = await request(app).post('/api/loads').set('Authorization', `Bearer ${token}`).send({
      title: 'Load',
    });
    expect(res.status).toBe(400);
  });

  test('POST /api/loads - unauthenticated returns 401', async () => {
    const res = await request(app).post('/api/loads').send({
      title: 'Load', description: 'Desc', origin: 'A', destination: 'B', weightLbs: 100, budgetUsd: 100,
    });
    expect(res.status).toBe(401);
  });

  test('GET /api/loads - returns open loads', async () => {
    const token = await registerAndLogin(shipper);
    await request(app).post('/api/loads').set('Authorization', `Bearer ${token}`).send({
      title: 'Load 1', description: 'Desc', origin: 'Detroit, MI', destination: 'Chicago, IL', weightLbs: 1000, budgetUsd: 800,
    });
    const res = await request(app).get('/api/loads');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });

  test('GET /api/loads/:id - returns a single load', async () => {
    const token = await registerAndLogin(shipper);
    const created = await request(app).post('/api/loads').set('Authorization', `Bearer ${token}`).send({
      title: 'Load X', description: 'Desc', origin: 'A', destination: 'B', weightLbs: 500, budgetUsd: 600,
    });
    const res = await request(app).get(`/api/loads/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Load X');
  });

  test('GET /api/loads/:id - not found returns 404', async () => {
    const res = await request(app).get('/api/loads/nonexistent');
    expect(res.status).toBe(404);
  });

  test('PUT /api/loads/:id - shipper can update open load', async () => {
    const token = await registerAndLogin(shipper);
    const created = await request(app).post('/api/loads').set('Authorization', `Bearer ${token}`).send({
      title: 'Old Title', description: 'Desc', origin: 'A', destination: 'B', weightLbs: 500, budgetUsd: 600,
    });
    const res = await request(app).put(`/api/loads/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'New Title', budgetUsd: 700 });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New Title');
    expect(res.body.budgetUsd).toBe(700);
  });

  test('PUT /api/loads/:id - another user cannot update', async () => {
    const shipperToken = await registerAndLogin(shipper);
    const carrierToken = await registerAndLogin(carrier);
    const created = await request(app).post('/api/loads').set('Authorization', `Bearer ${shipperToken}`).send({
      title: 'Load', description: 'Desc', origin: 'A', destination: 'B', weightLbs: 500, budgetUsd: 600,
    });
    const res = await request(app).put(`/api/loads/${created.body.id}`)
      .set('Authorization', `Bearer ${carrierToken}`)
      .send({ title: 'Hijack' });
    expect(res.status).toBe(403);
  });

  test('DELETE /api/loads/:id - shipper can cancel open load', async () => {
    const token = await registerAndLogin(shipper);
    const created = await request(app).post('/api/loads').set('Authorization', `Bearer ${token}`).send({
      title: 'Load', description: 'Desc', origin: 'A', destination: 'B', weightLbs: 500, budgetUsd: 600,
    });
    const res = await request(app).delete(`/api/loads/${created.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Load cancelled');
  });
});
