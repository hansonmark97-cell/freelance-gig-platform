'use strict';

const request = require('supertest');

jest.mock('../src/firebase', () => {
  const { mockDb } = require('./firestoreMock');
  return { db: mockDb };
});

const app = require('../src/app');
const { mockDb } = require('./firestoreMock');

beforeEach(() => mockDb.reset());

describe('Bids API', () => {
  const validBid = {
    jobId: 'job-1',
    freelancerId: 'freelancer-1',
    amount: 500,
    message: 'I can deliver this project in 7 days with full testing.',
    deliveryDays: 7,
  };

  test('POST /api/bids - creates a bid successfully', async () => {
    const res = await request(app).post('/api/bids').send(validBid);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.jobId).toBe('job-1');
    expect(res.body.status).toBe('pending');
    expect(res.body.createdAt).toBeDefined();
  });

  test('POST /api/bids - returns 400 if required fields are missing', async () => {
    const res = await request(app).post('/api/bids').send({ jobId: 'job-1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/);
  });

  test('POST /api/bids - returns 400 if amount is not a positive number', async () => {
    const res = await request(app)
      .post('/api/bids')
      .send({ ...validBid, amount: -100 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/amount/);
  });

  test('GET /api/bids - returns all bids', async () => {
    await request(app).post('/api/bids').send(validBid);
    await request(app)
      .post('/api/bids')
      .send({ ...validBid, freelancerId: 'freelancer-2', amount: 600 });
    const res = await request(app).get('/api/bids');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  test('GET /api/bids - filters by jobId', async () => {
    await request(app).post('/api/bids').send(validBid);
    await request(app)
      .post('/api/bids')
      .send({ ...validBid, jobId: 'job-2', amount: 700 });
    const res = await request(app).get('/api/bids?jobId=job-1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].jobId).toBe('job-1');
  });

  test('GET /api/bids - filters by freelancerId', async () => {
    await request(app).post('/api/bids').send(validBid);
    await request(app)
      .post('/api/bids')
      .send({ ...validBid, freelancerId: 'freelancer-2', jobId: 'job-2' });
    const res = await request(app).get('/api/bids?freelancerId=freelancer-1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].freelancerId).toBe('freelancer-1');
  });

  test('GET /api/bids/:id - returns a bid by id', async () => {
    const created = await request(app).post('/api/bids').send(validBid);
    const res = await request(app).get(`/api/bids/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.amount).toBe(500);
  });

  test('GET /api/bids/:id - returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/bids/nonexistent-id');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  test('PATCH /api/bids/:id/status - updates bid status to accepted', async () => {
    const created = await request(app).post('/api/bids').send(validBid);
    const res = await request(app)
      .patch(`/api/bids/${created.body.id}/status`)
      .send({ status: 'accepted' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('accepted');
  });

  test('PATCH /api/bids/:id/status - returns 400 for invalid status', async () => {
    const created = await request(app).post('/api/bids').send(validBid);
    const res = await request(app)
      .patch(`/api/bids/${created.body.id}/status`)
      .send({ status: 'unknown' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/status/);
  });

  test('DELETE /api/bids/:id - deletes a bid', async () => {
    const created = await request(app).post('/api/bids').send(validBid);
    const del = await request(app).delete(`/api/bids/${created.body.id}`);
    expect(del.status).toBe(204);
    const get = await request(app).get(`/api/bids/${created.body.id}`);
    expect(get.status).toBe(404);
  });
});
