process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/app');
const firestoreMock = require('./firestoreMock');

beforeEach(() => {
  firestoreMock.reset();
});

describe('Users API', () => {
  const clientUser = { name: 'Alice Client', email: 'alice@example.com', password: 'pass123', role: 'client' };
  const freelancerUser = { name: 'Bob Freelancer', email: 'bob@example.com', password: 'pass456', role: 'freelancer' };

  test('POST /api/users/register - register a client', async () => {
    const res = await request(app).post('/api/users/register').send(clientUser);
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(clientUser.email);
    expect(res.body.user.role).toBe('client');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  test('POST /api/users/register - register a freelancer', async () => {
    const res = await request(app).post('/api/users/register').send(freelancerUser);
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('freelancer');
  });

  test('POST /api/users/register - duplicate email returns 409', async () => {
    await request(app).post('/api/users/register').send(clientUser);
    const res = await request(app).post('/api/users/register').send(clientUser);
    expect(res.status).toBe(409);
  });

  test('POST /api/users/register - missing fields returns 400', async () => {
    const res = await request(app).post('/api/users/register').send({ email: 'x@x.com', password: 'pass' });
    expect(res.status).toBe(400);
  });

  test('POST /api/users/register - invalid role returns 400', async () => {
    const res = await request(app).post('/api/users/register').send({ ...clientUser, role: 'superuser' });
    expect(res.status).toBe(400);
  });

  test('POST /api/users/login - login with correct credentials', async () => {
    await request(app).post('/api/users/register').send(clientUser);
    const res = await request(app).post('/api/users/login').send({ email: clientUser.email, password: clientUser.password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(clientUser.email);
  });

  test('POST /api/users/login - wrong password returns 401', async () => {
    await request(app).post('/api/users/register').send(clientUser);
    const res = await request(app).post('/api/users/login').send({ email: clientUser.email, password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  test('POST /api/users/login - nonexistent user returns 401', async () => {
    const res = await request(app).post('/api/users/login').send({ email: 'nobody@example.com', password: 'pass' });
    expect(res.status).toBe(401);
  });

  test('GET /api/users/me - returns profile without passwordHash', async () => {
    const reg = await request(app).post('/api/users/register').send(clientUser);
    const token = reg.body.token;
    const res = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(clientUser.email);
    expect(res.body.passwordHash).toBeUndefined();
  });

  test('GET /api/users/me - without token returns 401', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });

  test('PUT /api/users/me - update name', async () => {
    const reg = await request(app).post('/api/users/register').send(clientUser);
    const token = reg.body.token;
    const res = await request(app).put('/api/users/me').set('Authorization', `Bearer ${token}`).send({ name: 'Alice Updated' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Alice Updated');
  });

  test('PUT /api/users/me - without token returns 401', async () => {
    const res = await request(app).put('/api/users/me').send({ name: 'New Name' });
    expect(res.status).toBe(401);
  });
});
