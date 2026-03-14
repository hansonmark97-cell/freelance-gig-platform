'use strict';

const request = require('supertest');
const { createDatabase } = require('../src/database');
const { createApp } = require('../src/app');

let app;
let clientId;
let freelancerId;
let jobId;

beforeAll(async () => {
  const db = createDatabase(':memory:');
  app = createApp(db);

  const cl = await request(app).post('/api/users').send({ username: 'revClient', email: 'rc@example.com', role: 'client' });
  clientId = cl.body.id;

  const fl = await request(app).post('/api/users').send({ username: 'revFreelancer', email: 'rf@example.com', role: 'freelancer' });
  freelancerId = fl.body.id;

  const job = await request(app).post('/api/jobs').send({
    client_id: clientId, title: 'Review Test Job', description: 'A job for reviews', category: 'testing', budget: 1000
  });
  jobId = job.body.id;
});

describe('POST /api/reviews', () => {
  it('client can review a freelancer', async () => {
    const res = await request(app).post('/api/reviews').send({
      reviewer_id: clientId, reviewee_id: freelancerId, job_id: jobId, rating: 5, comment: 'Great work!'
    });
    expect(res.status).toBe(201);
    expect(res.body.rating).toBe(5);
  });

  it('prevents duplicate review (same reviewer, same job)', async () => {
    const res = await request(app).post('/api/reviews').send({
      reviewer_id: clientId, reviewee_id: freelancerId, job_id: jobId, rating: 4, comment: 'Second review'
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already reviewed/);
  });

  it('rejects invalid rating', async () => {
    const job2 = await request(app).post('/api/jobs').send({
      client_id: clientId, title: 'Job 2', description: 'Another job', category: 'testing', budget: 500
    });
    const res = await request(app).post('/api/reviews').send({
      reviewer_id: clientId, reviewee_id: freelancerId, job_id: job2.body.id, rating: 10
    });
    expect(res.status).toBe(400);
  });

  it('rejects missing fields', async () => {
    const res = await request(app).post('/api/reviews').send({ reviewer_id: clientId });
    expect(res.status).toBe(400);
  });

  it('rejects review for non-existent job', async () => {
    const res = await request(app).post('/api/reviews').send({
      reviewer_id: clientId, reviewee_id: freelancerId, job_id: 99999, rating: 3
    });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/reviews', () => {
  it('lists reviews with reviewer and reviewee usernames', async () => {
    const res = await request(app).get(`/api/reviews?reviewee_id=${freelancerId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    if (res.body.data.length > 0) {
      expect(res.body.data[0]).toHaveProperty('reviewer_username');
      expect(res.body.data[0]).toHaveProperty('reviewee_username');
    }
  });
});

describe('GET /api/reviews/summary/:userId', () => {
  it('returns aggregated rating summary', async () => {
    const res = await request(app).get(`/api/reviews/summary/${freelancerId}`);
    expect(res.status).toBe(200);
    expect(res.body.review_count).toBeGreaterThan(0);
    expect(typeof res.body.avg_rating).toBe('number');
    expect(typeof res.body.min_rating).toBe('number');
    expect(typeof res.body.max_rating).toBe('number');
  });

  it('returns zero counts for user with no reviews', async () => {
    const res = await request(app).get(`/api/reviews/summary/${clientId}`);
    expect(res.status).toBe(200);
    expect(res.body.review_count).toBe(0);
    expect(res.body.avg_rating).toBeNull();
  });
});

describe('GET /api/reviews/:id', () => {
  let reviewId;
  beforeAll(async () => {
    const list = await request(app).get(`/api/reviews?reviewee_id=${freelancerId}`);
    reviewId = list.body.data[0].id;
  });

  it('returns a single review with usernames', async () => {
    const res = await request(app).get(`/api/reviews/${reviewId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(reviewId);
    expect(res.body).toHaveProperty('reviewer_username');
  });

  it('returns 404 for missing review', async () => {
    const res = await request(app).get('/api/reviews/99999');
    expect(res.status).toBe(404);
  });
});
