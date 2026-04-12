process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/app');
const firestoreMock = require('./firestoreMock');

beforeEach(() => {
  firestoreMock.reset();
});

async function registerAndLogin(user) {
  const res = await request(app).post('/api/users/register').send(user);
  return res.body.token;
}

describe('Bids API', () => {
  const client = { name: 'Client', email: 'client@example.com', password: 'pass123', role: 'client' };
  const freelancer1 = { name: 'Freelancer 1', email: 'fl1@example.com', password: 'pass123', role: 'freelancer' };
  const freelancer2 = { name: 'Freelancer 2', email: 'fl2@example.com', password: 'pass456', role: 'freelancer' };

  async function createJob(clientToken) {
    const res = await request(app).post('/api/jobs').set('Authorization', `Bearer ${clientToken}`).send({
      title: 'Test Job', description: 'Need work', category: 'dev', budgetUsd: 500,
    });
    return res.body;
  }

  test('POST /api/bids - freelancer can place bid', async () => {
    const clientToken = await registerAndLogin(client);
    const fl1Token = await registerAndLogin(freelancer1);
    const job = await createJob(clientToken);

    const res = await request(app).post('/api/bids').set('Authorization', `Bearer ${fl1Token}`).send({
      jobId: job.id, amountUsd: 400, message: 'I can do this',
    });
    expect(res.status).toBe(201);
    expect(res.body.jobId).toBe(job.id);
    expect(res.body.status).toBe('pending');
  });

  test('POST /api/bids - client cannot place bid', async () => {
    const clientToken = await registerAndLogin(client);
    const job = await createJob(clientToken);

    const res = await request(app).post('/api/bids').set('Authorization', `Bearer ${clientToken}`).send({
      jobId: job.id, amountUsd: 400, message: 'I can do this',
    });
    expect(res.status).toBe(403);
  });

  test('POST /api/bids - cannot bid on non-open job', async () => {
    const clientToken = await registerAndLogin(client);
    const fl1Token = await registerAndLogin(freelancer1);
    const job = await createJob(clientToken);

    // Cancel the job
    await request(app).delete(`/api/jobs/${job.id}`).set('Authorization', `Bearer ${clientToken}`);

    const res = await request(app).post('/api/bids').set('Authorization', `Bearer ${fl1Token}`).send({
      jobId: job.id, amountUsd: 400, message: 'I can do this',
    });
    expect(res.status).toBe(400);
  });

  test('POST /api/bids - missing fields returns 400', async () => {
    const clientToken = await registerAndLogin(client);
    const fl1Token = await registerAndLogin(freelancer1);
    const job = await createJob(clientToken);

    const res = await request(app).post('/api/bids').set('Authorization', `Bearer ${fl1Token}`).send({ jobId: job.id });
    expect(res.status).toBe(400);
  });

  test('GET /api/bids/job/:jobId - list bids for a job', async () => {
    const clientToken = await registerAndLogin(client);
    const fl1Token = await registerAndLogin(freelancer1);
    const fl2Token = await registerAndLogin(freelancer2);
    const job = await createJob(clientToken);

    await request(app).post('/api/bids').set('Authorization', `Bearer ${fl1Token}`).send({
      jobId: job.id, amountUsd: 400, message: 'Bid 1',
    });
    await request(app).post('/api/bids').set('Authorization', `Bearer ${fl2Token}`).send({
      jobId: job.id, amountUsd: 350, message: 'Bid 2',
    });

    const res = await request(app).get(`/api/bids/job/${job.id}`).set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  test('GET /api/bids/my - freelancer can list own bids', async () => {
    const clientToken = await registerAndLogin(client);
    const fl1Token = await registerAndLogin(freelancer1);
    const job1 = await createJob(clientToken);
    const job2 = await createJob(clientToken);

    await request(app).post('/api/bids').set('Authorization', `Bearer ${fl1Token}`).send({
      jobId: job1.id, amountUsd: 300, message: 'Bid on job1',
    });
    await request(app).post('/api/bids').set('Authorization', `Bearer ${fl1Token}`).send({
      jobId: job2.id, amountUsd: 400, message: 'Bid on job2',
    });

    const res = await request(app).get('/api/bids/my').set('Authorization', `Bearer ${fl1Token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  test('PUT /api/bids/:id/accept - client can accept bid', async () => {
    const clientToken = await registerAndLogin(client);
    const fl1Token = await registerAndLogin(freelancer1);
    const fl2Token = await registerAndLogin(freelancer2);
    const job = await createJob(clientToken);

    const bid1 = await request(app).post('/api/bids').set('Authorization', `Bearer ${fl1Token}`).send({
      jobId: job.id, amountUsd: 400, message: 'Bid 1',
    });
    const bid2 = await request(app).post('/api/bids').set('Authorization', `Bearer ${fl2Token}`).send({
      jobId: job.id, amountUsd: 350, message: 'Bid 2',
    });

    const res = await request(app).put(`/api/bids/${bid1.body.id}/accept`).set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('accepted');

    // Check job is now in_progress
    const jobCheck = await request(app).get(`/api/jobs/${job.id}`);
    expect(jobCheck.body.status).toBe('in_progress');

    // Check other bid was rejected
    const bid2Check = await request(app).get(`/api/bids/job/${job.id}`).set('Authorization', `Bearer ${clientToken}`);
    const otherBid = bid2Check.body.find(b => b.id === bid2.body.id);
    expect(otherBid.status).toBe('rejected');
  });

  test('PUT /api/bids/:id/accept - non-owner cannot accept bid', async () => {
    const clientToken = await registerAndLogin(client);
    const otherClientToken = await registerAndLogin({ name: 'Other', email: 'other@example.com', password: 'pass', role: 'client' });
    const fl1Token = await registerAndLogin(freelancer1);
    const job = await createJob(clientToken);

    const bid = await request(app).post('/api/bids').set('Authorization', `Bearer ${fl1Token}`).send({
      jobId: job.id, amountUsd: 400, message: 'Bid',
    });

    const res = await request(app).put(`/api/bids/${bid.body.id}/accept`).set('Authorization', `Bearer ${otherClientToken}`);
    expect(res.status).toBe(403);
  });

  test('PUT /api/bids/:id/reject - client can reject bid', async () => {
    const clientToken = await registerAndLogin(client);
    const fl1Token = await registerAndLogin(freelancer1);
    const job = await createJob(clientToken);

    const bid = await request(app).post('/api/bids').set('Authorization', `Bearer ${fl1Token}`).send({
      jobId: job.id, amountUsd: 400, message: 'Bid',
    });

    const res = await request(app).put(`/api/bids/${bid.body.id}/reject`).set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');
  });
});
