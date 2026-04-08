process.env.DATABASE_PATH = ':memory:';

const request = require('supertest');
const app = require('../src/app');

describe('Bids API', () => {
  let freelancerId, clientId, gigId, jobId;

  beforeAll(async () => {
    const freelancer = await request(app).post('/api/users').send({
      username: 'bidfreelancer',
      email: 'bidfreelancer@example.com',
      password: 'pass',
      role: 'freelancer'
    });
    freelancerId = freelancer.body.id;

    const client = await request(app).post('/api/users').send({
      username: 'bidclient',
      email: 'bidclient@example.com',
      password: 'pass',
      role: 'client'
    });
    clientId = client.body.id;

    const gig = await request(app).post('/api/gigs').send({
      title: 'Bid Gig',
      description: 'A gig to bid on',
      category: 'dev',
      budget: 400,
      client_id: clientId
    });
    gigId = gig.body.id;

    const job = await request(app).post('/api/jobs').send({
      title: 'Bid Job',
      description: 'A job to bid on',
      skills_required: 'JS',
      budget_min: 500,
      budget_max: 1000,
      client_id: clientId
    });
    jobId = job.body.id;
  });

  test('1. POST /api/bids - creates bid on gig (201)', async () => {
    const res = await request(app).post('/api/bids').send({
      amount: 350,
      proposal: 'I can do this gig well',
      freelancer_id: freelancerId,
      gig_id: gigId
    });
    expect(res.status).toBe(201);
    expect(res.body.gig_id).toBe(gigId);
    expect(res.body.status).toBe('pending');
  });

  test('2. POST /api/bids - creates bid on job (201)', async () => {
    const res = await request(app).post('/api/bids').send({
      amount: 800,
      proposal: 'I can do this job well',
      freelancer_id: freelancerId,
      job_id: jobId
    });
    expect(res.status).toBe(201);
    expect(res.body.job_id).toBe(jobId);
    expect(res.body.status).toBe('pending');
  });

  test('3. POST /api/bids - returns 409 for duplicate bid', async () => {
    const res = await request(app).post('/api/bids').send({
      amount: 400,
      proposal: 'Duplicate bid',
      freelancer_id: freelancerId,
      gig_id: gigId
    });
    expect(res.status).toBe(409);
  });

  test('4. POST /api/bids - returns 400 for missing fields', async () => {
    const res = await request(app).post('/api/bids').send({ amount: 100 });
    expect(res.status).toBe(400);
  });

  test('5. GET /api/bids - returns array', async () => {
    const res = await request(app).get('/api/bids');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('6. GET /api/bids - filters by gig_id', async () => {
    const res = await request(app).get(`/api/bids?gig_id=${gigId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    res.body.forEach(b => expect(b.gig_id).toBe(gigId));
  });

  test('7. GET /api/bids/:id - returns bid', async () => {
    const allBids = await request(app).get('/api/bids');
    const firstBid = allBids.body[0];
    const res = await request(app).get(`/api/bids/${firstBid.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(firstBid.id);
  });

  test('8. GET /api/bids/:id - 404 for non-existent', async () => {
    const res = await request(app).get('/api/bids/999999');
    expect(res.status).toBe(404);
  });

  test('9. PUT /api/bids/:id - updates bid status', async () => {
    const allBids = await request(app).get('/api/bids');
    const firstBid = allBids.body[0];
    const res = await request(app).put(`/api/bids/${firstBid.id}`).send({ status: 'accepted' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('accepted');
  });

  test('10. DELETE /api/bids/:id - deletes (204)', async () => {
    // Create a fresh freelancer so we can create a unique bid to delete
    const newFreelancer = await request(app).post('/api/users').send({
      username: 'deletebiduser',
      email: 'deletebid@example.com',
      password: 'pass',
      role: 'freelancer'
    });
    const bid = await request(app).post('/api/bids').send({
      amount: 200,
      proposal: 'Delete this bid',
      freelancer_id: newFreelancer.body.id,
      gig_id: gigId
    });
    const res = await request(app).delete(`/api/bids/${bid.body.id}`);
    expect(res.status).toBe(204);
  });

  test('11. DELETE /api/bids/:id - 404 for non-existent', async () => {
    const res = await request(app).delete('/api/bids/999999');
    expect(res.status).toBe(404);
  });
});
