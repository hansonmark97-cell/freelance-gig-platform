'use strict';

const request = require('supertest');

jest.mock('../src/firebase', () => {
  const { mockDb } = require('./firestoreMock');
  return { db: mockDb };
});

const app = require('../src/app');
const { mockDb } = require('./firestoreMock');

beforeEach(() => mockDb.reset());

describe('Jobs API', () => {
  const validJob = {
    title: 'Build an e-commerce site',
    description: 'Need a full e-commerce platform with payment integration',
    clientId: 'client-1',
    budget: 3000,
    category: 'web-development',
    deadline: '2026-06-01',
  };

  test('POST /api/jobs - creates a job successfully', async () => {
    const res = await request(app).post('/api/jobs').send(validJob);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.title).toBe('Build an e-commerce site');
    expect(res.body.status).toBe('open');
    expect(res.body.createdAt).toBeDefined();
  });

  test('POST /api/jobs - returns 400 if required fields are missing', async () => {
    const res = await request(app).post('/api/jobs').send({ title: 'Incomplete job' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/);
  });

  test('POST /api/jobs - returns 400 if budget is not a positive number', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .send({ ...validJob, budget: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/budget/);
  });

  test('GET /api/jobs - returns all jobs', async () => {
    await request(app).post('/api/jobs').send(validJob);
    await request(app)
      .post('/api/jobs')
      .send({ ...validJob, title: 'Design a logo', category: 'design' });
    const res = await request(app).get('/api/jobs');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  test('GET /api/jobs - filters by clientId', async () => {
    await request(app).post('/api/jobs').send(validJob);
    await request(app)
      .post('/api/jobs')
      .send({ ...validJob, clientId: 'client-2', title: 'Other job' });
    const res = await request(app).get('/api/jobs?clientId=client-1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].clientId).toBe('client-1');
  });

  test('GET /api/jobs - filters by category', async () => {
    await request(app).post('/api/jobs').send(validJob);
    await request(app)
      .post('/api/jobs')
      .send({ ...validJob, category: 'design', title: 'Logo design' });
    const res = await request(app).get('/api/jobs?category=web-development');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].category).toBe('web-development');
  });

  test('GET /api/jobs/:id - returns a job by id', async () => {
    const created = await request(app).post('/api/jobs').send(validJob);
    const res = await request(app).get(`/api/jobs/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Build an e-commerce site');
  });

  test('GET /api/jobs/:id - returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/jobs/nonexistent-id');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  test('PUT /api/jobs/:id - updates job fields', async () => {
    const created = await request(app).post('/api/jobs').send(validJob);
    const res = await request(app)
      .put(`/api/jobs/${created.body.id}`)
      .send({ budget: 4000, status: 'in-progress' });
    expect(res.status).toBe(200);
    expect(res.body.budget).toBe(4000);
    expect(res.body.status).toBe('in-progress');
  });

  test('PUT /api/jobs/:id - returns 404 for unknown id', async () => {
    const res = await request(app).put('/api/jobs/nonexistent-id').send({ budget: 100 });
    expect(res.status).toBe(404);
  });

  test('DELETE /api/jobs/:id - deletes a job', async () => {
    const created = await request(app).post('/api/jobs').send(validJob);
    const del = await request(app).delete(`/api/jobs/${created.body.id}`);
    expect(del.status).toBe(204);
    const get = await request(app).get(`/api/jobs/${created.body.id}`);
    expect(get.status).toBe(404);
  });
});
