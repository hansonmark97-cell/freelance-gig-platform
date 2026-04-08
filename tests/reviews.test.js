'use strict';

const request = require('supertest');

jest.mock('../src/firebase', () => {
  const { mockDb } = require('./firestoreMock');
  return { db: mockDb };
});

const app = require('../src/app');
const { mockDb } = require('./firestoreMock');

beforeEach(() => mockDb.reset());

describe('Reviews API', () => {
  const validReview = {
    reviewerId: 'client-1',
    revieweeId: 'freelancer-1',
    rating: 5,
    comment: 'Excellent work! Delivered on time and exceeded expectations.',
    gigId: 'gig-1',
  };

  test('POST /api/reviews - creates a review successfully', async () => {
    const res = await request(app).post('/api/reviews').send(validReview);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.rating).toBe(5);
    expect(res.body.gigId).toBe('gig-1');
    expect(res.body.createdAt).toBeDefined();
  });

  test('POST /api/reviews - returns 400 if required fields are missing', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .send({ reviewerId: 'client-1', gigId: 'gig-1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/);
  });

  test('POST /api/reviews - returns 400 if rating is out of range', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .send({ ...validReview, rating: 6 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/rating/);
  });

  test('POST /api/reviews - returns 400 if rating is below 1', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .send({ ...validReview, rating: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/rating/);
  });

  test('POST /api/reviews - returns 400 if neither gigId nor jobId provided', async () => {
    const { gigId: _gigId, ...reviewWithoutGigId } = validReview;
    const res = await request(app).post('/api/reviews').send(reviewWithoutGigId);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/gigId or jobId/);
  });

  test('GET /api/reviews - returns all reviews', async () => {
    await request(app).post('/api/reviews').send(validReview);
    await request(app)
      .post('/api/reviews')
      .send({ ...validReview, reviewerId: 'client-2', gigId: 'gig-2', rating: 4 });
    const res = await request(app).get('/api/reviews');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  test('GET /api/reviews - filters by revieweeId', async () => {
    await request(app).post('/api/reviews').send(validReview);
    await request(app)
      .post('/api/reviews')
      .send({ ...validReview, revieweeId: 'freelancer-2', gigId: 'gig-2' });
    const res = await request(app).get('/api/reviews?revieweeId=freelancer-1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].revieweeId).toBe('freelancer-1');
  });

  test('GET /api/reviews/:id - returns a review by id', async () => {
    const created = await request(app).post('/api/reviews').send(validReview);
    const res = await request(app).get(`/api/reviews/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.comment).toMatch(/Excellent/);
  });

  test('GET /api/reviews/:id - returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/reviews/nonexistent-id');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  test('DELETE /api/reviews/:id - deletes a review', async () => {
    const created = await request(app).post('/api/reviews').send(validReview);
    const del = await request(app).delete(`/api/reviews/${created.body.id}`);
    expect(del.status).toBe(204);
    const get = await request(app).get(`/api/reviews/${created.body.id}`);
    expect(get.status).toBe(404);
  });

  test('DELETE /api/reviews/:id - returns 404 for unknown id', async () => {
    const res = await request(app).delete('/api/reviews/nonexistent-id');
    expect(res.status).toBe(404);
  });
});
