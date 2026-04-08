process.env.DATABASE_PATH = ':memory:';

const request = require('supertest');
const app = require('../src/app');

describe('Gigs API', () => {
  let clientId;

  beforeAll(async () => {
    const userRes = await request(app).post('/api/users').send({
      username: 'gigclient',
      email: 'gigclient@example.com',
      password: 'pass',
      role: 'client'
    });
    clientId = userRes.body.id;
  });

  test('1. POST /api/gigs - creates gig (201)', async () => {
    const res = await request(app).post('/api/gigs').send({
      title: 'Build a website',
      description: 'Need a React website',
      category: 'web',
      budget: 500,
      client_id: clientId
    });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Build a website');
    expect(res.body.status).toBe('open');
  });

  test('2. POST /api/gigs - returns 400 for missing fields', async () => {
    const res = await request(app).post('/api/gigs').send({ title: 'Incomplete' });
    expect(res.status).toBe(400);
  });

  test('3. GET /api/gigs - returns array', async () => {
    const res = await request(app).get('/api/gigs');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('4. GET /api/gigs - filters by status', async () => {
    const res = await request(app).get('/api/gigs?status=open');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    res.body.forEach(g => expect(g.status).toBe('open'));
  });

  test('5. GET /api/gigs/:id - returns gig', async () => {
    const created = await request(app).post('/api/gigs').send({
      title: 'Test Gig',
      description: 'Desc',
      category: 'design',
      budget: 200,
      client_id: clientId
    });
    const res = await request(app).get(`/api/gigs/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
  });

  test('6. GET /api/gigs/:id - 404 for non-existent', async () => {
    const res = await request(app).get('/api/gigs/999999');
    expect(res.status).toBe(404);
  });

  test('7. PUT /api/gigs/:id - updates gig', async () => {
    const created = await request(app).post('/api/gigs').send({
      title: 'Update Gig',
      description: 'Desc',
      category: 'writing',
      budget: 100,
      client_id: clientId
    });
    const res = await request(app).put(`/api/gigs/${created.body.id}`).send({ budget: 300, status: 'in_progress' });
    expect(res.status).toBe(200);
    expect(res.body.budget).toBe(300);
    expect(res.body.status).toBe('in_progress');
  });

  test('8. PUT /api/gigs/:id - 404 for non-existent', async () => {
    const res = await request(app).put('/api/gigs/999999').send({ title: 'nope' });
    expect(res.status).toBe(404);
  });

  test('9. DELETE /api/gigs/:id - deletes (204)', async () => {
    const created = await request(app).post('/api/gigs').send({
      title: 'Delete Gig',
      description: 'Desc',
      category: 'seo',
      budget: 150,
      client_id: clientId
    });
    const res = await request(app).delete(`/api/gigs/${created.body.id}`);
    expect(res.status).toBe(204);
  });

  test('10. DELETE /api/gigs/:id - 404 for non-existent', async () => {
    const res = await request(app).delete('/api/gigs/999999');
    expect(res.status).toBe(404);
  });

  test('11. GET /api/gigs - filters by category', async () => {
    await request(app).post('/api/gigs').send({
      title: 'Logo Design',
      description: 'Design a logo',
      category: 'design',
      budget: 250,
      client_id: clientId
    });
    const res = await request(app).get('/api/gigs?category=design');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    res.body.forEach(g => expect(g.category).toBe('design'));
  });
});
