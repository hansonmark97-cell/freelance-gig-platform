process.env.DATABASE_PATH = ':memory:';

const request = require('supertest');
const app = require('../src/app');

describe('Reviews API', () => {
  let reviewerId, revieweeId, clientId, gigId, jobId;

  beforeAll(async () => {
    const reviewer = await request(app).post('/api/users').send({
      username: 'reviewer1',
      email: 'reviewer1@example.com',
      password: 'pass',
      role: 'client'
    });
    reviewerId = reviewer.body.id;

    const reviewee = await request(app).post('/api/users').send({
      username: 'reviewee1',
      email: 'reviewee1@example.com',
      password: 'pass',
      role: 'freelancer'
    });
    revieweeId = reviewee.body.id;

    const client = await request(app).post('/api/users').send({
      username: 'reviewclient',
      email: 'reviewclient@example.com',
      password: 'pass',
      role: 'client'
    });
    clientId = client.body.id;

    const gig = await request(app).post('/api/gigs').send({
      title: 'Review Gig',
      description: 'Gig to review',
      category: 'dev',
      budget: 300,
      client_id: clientId
    });
    gigId = gig.body.id;

    const job = await request(app).post('/api/jobs').send({
      title: 'Review Job',
      description: 'Job to review',
      skills_required: 'Python',
      budget_min: 400,
      budget_max: 900,
      client_id: clientId
    });
    jobId = job.body.id;
  });

  test('1. POST /api/reviews - creates review on gig (201)', async () => {
    const res = await request(app).post('/api/reviews').send({
      rating: 5,
      comment: 'Excellent work!',
      reviewer_id: reviewerId,
      reviewee_id: revieweeId,
      gig_id: gigId
    });
    expect(res.status).toBe(201);
    expect(res.body.rating).toBe(5);
    expect(res.body.gig_id).toBe(gigId);
  });

  test('2. POST /api/reviews - creates review on job (201)', async () => {
    const res = await request(app).post('/api/reviews').send({
      rating: 4,
      comment: 'Good work',
      reviewer_id: reviewerId,
      reviewee_id: revieweeId,
      job_id: jobId
    });
    expect(res.status).toBe(201);
    expect(res.body.rating).toBe(4);
    expect(res.body.job_id).toBe(jobId);
  });

  test('3. POST /api/reviews - returns 409 for duplicate', async () => {
    const res = await request(app).post('/api/reviews').send({
      rating: 3,
      comment: 'Duplicate review',
      reviewer_id: reviewerId,
      reviewee_id: revieweeId,
      gig_id: gigId
    });
    expect(res.status).toBe(409);
  });

  test('4. POST /api/reviews - returns 400 for invalid rating', async () => {
    const res = await request(app).post('/api/reviews').send({
      rating: 10,
      comment: 'Invalid rating',
      reviewer_id: reviewerId,
      reviewee_id: revieweeId,
      gig_id: gigId
    });
    expect(res.status).toBe(400);
  });

  test('5. GET /api/reviews - returns array', async () => {
    const res = await request(app).get('/api/reviews');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('6. GET /api/reviews - filters by reviewee_id', async () => {
    const res = await request(app).get(`/api/reviews?reviewee_id=${revieweeId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    res.body.forEach(r => expect(r.reviewee_id).toBe(revieweeId));
  });

  test('7. GET /api/reviews/:id - returns review', async () => {
    const allReviews = await request(app).get('/api/reviews');
    const first = allReviews.body[0];
    const res = await request(app).get(`/api/reviews/${first.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(first.id);
  });

  test('8. GET /api/reviews/:id - 404 for non-existent', async () => {
    const res = await request(app).get('/api/reviews/999999');
    expect(res.status).toBe(404);
  });

  test('9. PUT /api/reviews/:id - updates review', async () => {
    const allReviews = await request(app).get('/api/reviews');
    const first = allReviews.body[0];
    const res = await request(app).put(`/api/reviews/${first.id}`).send({ rating: 3, comment: 'Updated comment' });
    expect(res.status).toBe(200);
    expect(res.body.rating).toBe(3);
    expect(res.body.comment).toBe('Updated comment');
  });

  test('10. DELETE /api/reviews/:id - deletes (204)', async () => {
    // Create unique reviewer to have a fresh review to delete
    const newReviewer = await request(app).post('/api/users').send({
      username: 'deletereviewuser',
      email: 'deletereview@example.com',
      password: 'pass',
      role: 'client'
    });
    const review = await request(app).post('/api/reviews').send({
      rating: 2,
      comment: 'Delete me',
      reviewer_id: newReviewer.body.id,
      reviewee_id: revieweeId,
      gig_id: gigId
    });
    const res = await request(app).delete(`/api/reviews/${review.body.id}`);
    expect(res.status).toBe(204);
  });

  test('11. DELETE /api/reviews/:id - 404 for non-existent', async () => {
    const res = await request(app).delete('/api/reviews/999999');
    expect(res.status).toBe(404);
  });
});
