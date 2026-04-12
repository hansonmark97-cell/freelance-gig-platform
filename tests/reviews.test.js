process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/app');
const firestoreMock = require('./firestoreMock');

beforeEach(() => {
  firestoreMock.reset();
});

async function registerAndLogin(user) {
  const res = await request(app).post('/api/users/register').send(user);
  return { token: res.body.token, id: res.body.user.id };
}

describe('Reviews API', () => {
  const client = { name: 'Client', email: 'client@example.com', password: 'pass123', role: 'client' };
  const freelancer = { name: 'Freelancer', email: 'fl@example.com', password: 'pass456', role: 'freelancer' };

  test('POST /api/reviews - authenticated user can create review', async () => {
    const { token: clientToken } = await registerAndLogin(client);
    const { id: freelancerId } = await registerAndLogin(freelancer);

    const res = await request(app).post('/api/reviews').set('Authorization', `Bearer ${clientToken}`).send({
      revieweeId: freelancerId,
      rating: 5,
      comment: 'Excellent work!',
    });
    expect(res.status).toBe(201);
    expect(res.body.rating).toBe(5);
    expect(res.body.revieweeId).toBe(freelancerId);
  });

  test('POST /api/reviews - rating must be 1-5', async () => {
    const { token: clientToken } = await registerAndLogin(client);
    const { id: freelancerId } = await registerAndLogin(freelancer);

    const res = await request(app).post('/api/reviews').set('Authorization', `Bearer ${clientToken}`).send({
      revieweeId: freelancerId,
      rating: 6,
      comment: 'Too high rating',
    });
    expect(res.status).toBe(400);
  });

  test('POST /api/reviews - missing fields returns 400', async () => {
    const { token: clientToken } = await registerAndLogin(client);
    const res = await request(app).post('/api/reviews').set('Authorization', `Bearer ${clientToken}`).send({
      rating: 4,
    });
    expect(res.status).toBe(400);
  });

  test('POST /api/reviews - without auth returns 401', async () => {
    const res = await request(app).post('/api/reviews').send({
      revieweeId: 'someId',
      rating: 4,
      comment: 'Good',
    });
    expect(res.status).toBe(401);
  });

  test('POST /api/reviews - review with gigId', async () => {
    const { token: clientToken } = await registerAndLogin(client);
    const { id: freelancerId, token: flToken } = await registerAndLogin(freelancer);

    const gigRes = await request(app).post('/api/gigs').set('Authorization', `Bearer ${flToken}`).send({
      title: 'My Gig', description: 'desc', category: 'dev', priceUsd: 100, deliveryDays: 3,
    });
    const gigId = gigRes.body.id;

    const res = await request(app).post('/api/reviews').set('Authorization', `Bearer ${clientToken}`).send({
      revieweeId: freelancerId,
      gigId,
      rating: 4,
      comment: 'Great gig!',
    });
    expect(res.status).toBe(201);
    expect(res.body.gigId).toBe(gigId);
  });

  test('GET /api/reviews/user/:userId - list reviews for a user', async () => {
    const { token: clientToken } = await registerAndLogin(client);
    const { id: freelancerId } = await registerAndLogin(freelancer);

    await request(app).post('/api/reviews').set('Authorization', `Bearer ${clientToken}`).send({
      revieweeId: freelancerId, rating: 5, comment: 'Review 1',
    });
    await request(app).post('/api/reviews').set('Authorization', `Bearer ${clientToken}`).send({
      revieweeId: freelancerId, rating: 4, comment: 'Review 2',
    });

    const res = await request(app).get(`/api/reviews/user/${freelancerId}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  test('GET /api/reviews/gig/:gigId - list reviews for a gig', async () => {
    const { token: clientToken } = await registerAndLogin(client);
    const { id: freelancerId, token: flToken } = await registerAndLogin(freelancer);

    const gigRes = await request(app).post('/api/gigs').set('Authorization', `Bearer ${flToken}`).send({
      title: 'My Gig', description: 'desc', category: 'dev', priceUsd: 100, deliveryDays: 3,
    });
    const gigId = gigRes.body.id;

    await request(app).post('/api/reviews').set('Authorization', `Bearer ${clientToken}`).send({
      revieweeId: freelancerId, gigId, rating: 5, comment: 'Nice gig 1',
    });
    await request(app).post('/api/reviews').set('Authorization', `Bearer ${clientToken}`).send({
      revieweeId: freelancerId, gigId, rating: 3, comment: 'Nice gig 2',
    });

    const res = await request(app).get(`/api/reviews/gig/${gigId}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body[0].gigId).toBe(gigId);
  });

  test('GET /api/reviews/user/:userId - returns empty for user with no reviews', async () => {
    const res = await request(app).get('/api/reviews/user/nonexistent');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(0);
  });
});
