'use strict';

const request = require('supertest');
const { createDatabase } = require('../src/database');
const { createApp } = require('../src/app');

let app;
let freelancerId;
let clientId;
let jobId;

beforeAll(async () => {
  const db = createDatabase(':memory:');
  app = createApp(db);

  const fl = await request(app).post('/api/users').send({ username: 'bidFreelancer', email: 'bf@example.com', role: 'freelancer' });
  freelancerId = fl.body.id;

  const cl = await request(app).post('/api/users').send({ username: 'bidClient', email: 'bc@example.com', role: 'client' });
  clientId = cl.body.id;

  const job = await request(app).post('/api/jobs').send({
    client_id: clientId, title: 'Build a store', description: 'E-commerce site', category: 'development', budget: 5000
  });
  jobId = job.body.id;
});

describe('POST /api/bids', () => {
  it('freelancer can bid on an open job', async () => {
    const res = await request(app).post('/api/bids').send({
      job_id: jobId, freelancer_id: freelancerId, amount: 3000, proposal: 'I can do this', delivery_days: 14
    });
    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(3000);
    expect(res.body.status).toBe('pending');
  });

  it('prevents duplicate bids from same freelancer', async () => {
    const res = await request(app).post('/api/bids').send({
      job_id: jobId, freelancer_id: freelancerId, amount: 2500, proposal: 'Second bid', delivery_days: 10
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already bid/);
  });

  it('rejects bid from a client user', async () => {
    const res = await request(app).post('/api/bids').send({
      job_id: jobId, freelancer_id: clientId, amount: 1000, proposal: 'Client bid', delivery_days: 5
    });
    expect(res.status).toBe(403);
  });

  it('rejects bid on a non-open job', async () => {
    await request(app).patch(`/api/jobs/${jobId}`).send({ status: 'in_progress' });
    const fl2 = await request(app).post('/api/users').send({ username: 'fl2', email: 'fl2@example.com', role: 'freelancer' });
    const res = await request(app).post('/api/bids').send({
      job_id: jobId, freelancer_id: fl2.body.id, amount: 2000, proposal: 'Late bid', delivery_days: 7
    });
    expect(res.status).toBe(409);
  });

  it('rejects missing fields', async () => {
    const res = await request(app).post('/api/bids').send({ job_id: jobId });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/bids', () => {
  it('lists bids with freelancer info', async () => {
    const res = await request(app).get(`/api/bids?job_id=${jobId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    if (res.body.data.length > 0) {
      expect(res.body.data[0]).toHaveProperty('freelancer_username');
    }
  });

  it('filters by freelancer_id', async () => {
    const res = await request(app).get(`/api/bids?freelancer_id=${freelancerId}`);
    expect(res.status).toBe(200);
    res.body.data.forEach(b => expect(b.freelancer_id).toBe(freelancerId));
  });
});

describe('GET /api/bids/:id', () => {
  let bidId;
  beforeAll(async () => {
    const res = await request(app).get(`/api/bids?freelancer_id=${freelancerId}`);
    bidId = res.body.data[0].id;
  });

  it('returns a single bid', async () => {
    const res = await request(app).get(`/api/bids/${bidId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(bidId);
  });

  it('returns 404 for missing bid', async () => {
    const res = await request(app).get('/api/bids/99999');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/bids/:id', () => {
  let bidId;
  beforeAll(async () => {
    const res = await request(app).get(`/api/bids?freelancer_id=${freelancerId}`);
    bidId = res.body.data[0].id;
  });

  it('updates bid status', async () => {
    const res = await request(app).patch(`/api/bids/${bidId}`).send({ status: 'accepted' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('accepted');
  });

  it('rejects invalid status', async () => {
    const res = await request(app).patch(`/api/bids/${bidId}`).send({ status: 'bogus' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for missing bid', async () => {
    const res = await request(app).patch('/api/bids/99999').send({ status: 'withdrawn' });
    expect(res.status).toBe(404);
  });
});
