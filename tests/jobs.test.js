'use strict';

const request = require('supertest');
const { createDatabase } = require('../src/database');
const { createApp } = require('../src/app');

let app;
let clientId;
let freelancerId;

beforeAll(async () => {
  const db = createDatabase(':memory:');
  app = createApp(db);

  const cl = await request(app).post('/api/users').send({ username: 'jobClient', email: 'jc@example.com', role: 'client' });
  clientId = cl.body.id;

  const fl = await request(app).post('/api/users').send({ username: 'jobFreelancer', email: 'jf@example.com', role: 'freelancer' });
  freelancerId = fl.body.id;
});

describe('POST /api/jobs', () => {
  it('creates a job for a client', async () => {
    const res = await request(app).post('/api/jobs').send({
      client_id: clientId, title: 'Build an API', description: 'REST API needed', category: 'development', budget: 2000
    });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Build an API');
    expect(res.body.status).toBe('open');
  });

  it('rejects job creation by a freelancer', async () => {
    const res = await request(app).post('/api/jobs').send({
      client_id: freelancerId, title: 'Bad job', description: 'desc', category: 'development', budget: 500
    });
    expect(res.status).toBe(403);
  });

  it('rejects missing fields', async () => {
    const res = await request(app).post('/api/jobs').send({ client_id: clientId });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/jobs', () => {
  it('lists jobs with client info and bid count', async () => {
    const res = await request(app).get('/api/jobs');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    if (res.body.data.length > 0) {
      expect(res.body.data[0]).toHaveProperty('client_username');
      expect(typeof res.body.data[0].bid_count).toBe('number');
    }
  });

  it('filters by category', async () => {
    const res = await request(app).get('/api/jobs?category=development');
    expect(res.status).toBe(200);
    res.body.data.forEach(j => expect(j.category).toBe('development'));
  });

  it('filters by status', async () => {
    const res = await request(app).get('/api/jobs?status=open');
    expect(res.status).toBe(200);
    res.body.data.forEach(j => expect(j.status).toBe('open'));
  });
});

describe('GET /api/jobs/:id', () => {
  let jobId;
  beforeAll(async () => {
    const res = await request(app).get('/api/jobs');
    jobId = res.body.data[0].id;
  });

  it('returns a single job with bid summary', async () => {
    const res = await request(app).get(`/api/jobs/${jobId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(jobId);
    expect(typeof res.body.bid_count).toBe('number');
  });

  it('returns 404 for missing job', async () => {
    const res = await request(app).get('/api/jobs/99999');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/jobs/:id', () => {
  let jobId;
  beforeAll(async () => {
    const res = await request(app).get('/api/jobs');
    jobId = res.body.data[0].id;
  });

  it('updates job status', async () => {
    const res = await request(app).patch(`/api/jobs/${jobId}`).send({ status: 'in_progress' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in_progress');
  });

  it('returns 404 for missing job', async () => {
    const res = await request(app).patch('/api/jobs/99999').send({ status: 'open' });
    expect(res.status).toBe(404);
  });
});
