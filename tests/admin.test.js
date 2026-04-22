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

describe('Admin API', () => {
  const admin = { name: 'Admin Alice', email: 'admin@example.com', password: 'adminpass', role: 'admin' };
  const shipper = { name: 'Sam Shipper', email: 'sam@example.com', password: 'pass123', role: 'shipper' };
  const carrier = { name: 'Carl Carrier', email: 'carl@example.com', password: 'pass456', role: 'carrier' };

  test('GET /api/admin/users - admin lists all users', async () => {
    const { token: adminToken } = await registerAndLogin(admin);
    await registerAndLogin(shipper);
    await registerAndLogin(carrier);

    const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(3);
    res.body.forEach(u => expect(u.passwordHash).toBeUndefined());
  });

  test('GET /api/admin/users - non-admin returns 403', async () => {
    const { token: shipperToken } = await registerAndLogin(shipper);
    const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${shipperToken}`);
    expect(res.status).toBe(403);
  });

  test('GET /api/admin/users - unauthenticated returns 401', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
  });

  test('PUT /api/admin/users/:id/role - admin can update user role', async () => {
    const { token: adminToken } = await registerAndLogin(admin);
    const { id: shipperId } = await registerAndLogin(shipper);

    const res = await request(app).put(`/api/admin/users/${shipperId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'carrier' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('carrier');
  });

  test('PUT /api/admin/users/:id/role - invalid role returns 400', async () => {
    const { token: adminToken } = await registerAndLogin(admin);
    const { id: shipperId } = await registerAndLogin(shipper);

    const res = await request(app).put(`/api/admin/users/${shipperId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'superadmin' });
    expect(res.status).toBe(400);
  });

  test('PUT /api/admin/users/:id/role - not found returns 404', async () => {
    const { token: adminToken } = await registerAndLogin(admin);
    const res = await request(app).put('/api/admin/users/nonexistent/role')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'driver' });
    expect(res.status).toBe(404);
  });

  test('GET /api/admin/loads - admin can list all loads', async () => {
    const { token: adminToken } = await registerAndLogin(admin);
    const { token: shipperToken } = await registerAndLogin(shipper);

    await request(app).post('/api/loads').set('Authorization', `Bearer ${shipperToken}`).send({
      title: 'Load A', description: 'Freight', origin: 'A', destination: 'B', weightLbs: 500, budgetUsd: 400,
    });

    const res = await request(app).get('/api/admin/loads').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });

  test('GET /api/admin/shipments - admin can list all shipments', async () => {
    const { token: adminToken } = await registerAndLogin(admin);
    const res = await request(app).get('/api/admin/shipments').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/admin/invoices - admin can list all invoices', async () => {
    const { token: adminToken } = await registerAndLogin(admin);
    const res = await request(app).get('/api/admin/invoices').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/admin/stats - admin gets platform stats', async () => {
    const { token: adminToken } = await registerAndLogin(admin);
    await registerAndLogin(shipper);
    await registerAndLogin(carrier);

    const res = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.totalUsers).toBe(3);
    expect(res.body.totalLoads).toBeDefined();
    expect(res.body.totalShipments).toBeDefined();
    expect(res.body.totalInvoices).toBeDefined();
    expect(res.body.totalRevenueUsd).toBeDefined();
  });
});
