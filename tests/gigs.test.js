'use strict';

const request = require('supertest');

jest.mock('../src/firebase', () => {
  const { mockDb } = require('./firestoreMock');
  return { db: mockDb };
});

const app = require('../src/app');
const { mockDb } = require('./firestoreMock');

beforeEach(() => mockDb.reset());

describe('Gigs API', () => {
  const validGig = {
    title: 'Build a REST API',
    description: 'I will build a production-ready REST API in Node.js',
    freelancerId: 'user-1',
    price: 150,
    category: 'backend',
    deliveryDays: 5,
  };

  test('POST /api/gigs - creates a gig successfully', async () => {
    const res = await request(app).post('/api/gigs').send(validGig);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.title).toBe('Build a REST API');
    expect(res.body.status).toBe('active');
    expect(res.body.createdAt).toBeDefined();
  });

  test('POST /api/gigs - returns 400 if required fields are missing', async () => {
    const res = await request(app)
      .post('/api/gigs')
      .send({ title: 'Incomplete gig' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/);
  });

  test('POST /api/gigs - returns 400 if price is not a positive number', async () => {
    const res = await request(app)
      .post('/api/gigs')
      .send({ ...validGig, price: -10 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/price/);
  });

  test('GET /api/gigs - returns all gigs', async () => {
    await request(app).post('/api/gigs').send(validGig);
    await request(app)
      .post('/api/gigs')
      .send({ ...validGig, title: 'Design a logo', category: 'design' });
    const res = await request(app).get('/api/gigs');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  test('GET /api/gigs - filters by freelancerId', async () => {
    await request(app).post('/api/gigs').send(validGig);
    await request(app)
      .post('/api/gigs')
      .send({ ...validGig, freelancerId: 'user-2', title: 'Other gig' });
    const res = await request(app).get('/api/gigs?freelancerId=user-1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].freelancerId).toBe('user-1');
  });

  test('GET /api/gigs - filters by category', async () => {
    await request(app).post('/api/gigs').send(validGig);
    await request(app)
      .post('/api/gigs')
      .send({ ...validGig, category: 'design', title: 'Logo design' });
    const res = await request(app).get('/api/gigs?category=backend');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].category).toBe('backend');
  });

  test('GET /api/gigs/:id - returns a gig by id', async () => {
    const created = await request(app).post('/api/gigs').send(validGig);
    const res = await request(app).get(`/api/gigs/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Build a REST API');
  });

  test('GET /api/gigs/:id - returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/gigs/nonexistent-id');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  test('PUT /api/gigs/:id - updates gig fields', async () => {
    const created = await request(app).post('/api/gigs').send(validGig);
    const res = await request(app)
      .put(`/api/gigs/${created.body.id}`)
      .send({ price: 200, status: 'paused' });
    expect(res.status).toBe(200);
    expect(res.body.price).toBe(200);
    expect(res.body.status).toBe('paused');
  });

  test('PUT /api/gigs/:id - returns 404 for unknown id', async () => {
    const res = await request(app).put('/api/gigs/nonexistent-id').send({ price: 200 });
    expect(res.status).toBe(404);
  });

  test('DELETE /api/gigs/:id - deletes a gig', async () => {
    const created = await request(app).post('/api/gigs').send(validGig);
    const del = await request(app).delete(`/api/gigs/${created.body.id}`);
    expect(del.status).toBe(204);
    const get = await request(app).get(`/api/gigs/${created.body.id}`);
    expect(get.status).toBe(404);
  });
});
