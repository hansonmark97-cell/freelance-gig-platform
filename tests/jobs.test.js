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

describe('Jobs API', () => {
  const client = { name: 'Client Joe', email: 'joe@example.com', password: 'pass123', role: 'client' };
  const freelancer = { name: 'Free Sara', email: 'sara@example.com', password: 'pass456', role: 'freelancer' };

  test('POST /api/jobs - client can create job', async () => {
    const token = await registerAndLogin(client);
    const res = await request(app).post('/api/jobs').set('Authorization', `Bearer ${token}`).send({
      title: 'Build Website',
      description: 'Need a site',
      category: 'web',
      budgetUsd: 500,
    });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Build Website');
    expect(res.body.status).toBe('open');
  });

  test('POST /api/jobs - freelancer cannot create job', async () => {
    const token = await registerAndLogin(freelancer);
    const res = await request(app).post('/api/jobs').set('Authorization', `Bearer ${token}`).send({
      title: 'Build Website',
      description: 'Need a site',
      category: 'web',
      budgetUsd: 500,
    });
    expect(res.status).toBe(403);
  });

  test('POST /api/jobs - missing fields returns 400', async () => {
    const token = await registerAndLogin(client);
    const res = await request(app).post('/api/jobs').set('Authorization', `Bearer ${token}`).send({ title: 'Incomplete' });
    expect(res.status).toBe(400);
  });

  test('GET /api/jobs - list open jobs', async () => {
    const token = await registerAndLogin(client);
    await request(app).post('/api/jobs').set('Authorization', `Bearer ${token}`).send({
      title: 'Job 1', description: 'desc', category: 'web', budgetUsd: 300,
    });
    await request(app).post('/api/jobs').set('Authorization', `Bearer ${token}`).send({
      title: 'Job 2', description: 'desc', category: 'design', budgetUsd: 200,
    });

    const res = await request(app).get('/api/jobs');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  test('GET /api/jobs - filter by category', async () => {
    const token = await registerAndLogin(client);
    await request(app).post('/api/jobs').set('Authorization', `Bearer ${token}`).send({
      title: 'Web Job', description: 'desc', category: 'web', budgetUsd: 300,
    });
    await request(app).post('/api/jobs').set('Authorization', `Bearer ${token}`).send({
      title: 'Design Job', description: 'desc', category: 'design', budgetUsd: 200,
    });

    const res = await request(app).get('/api/jobs?category=web');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].category).toBe('web');
  });

  test('GET /api/jobs/:id - get single job', async () => {
    const token = await registerAndLogin(client);
    const created = await request(app).post('/api/jobs').set('Authorization', `Bearer ${token}`).send({
      title: 'My Job', description: 'desc', category: 'dev', budgetUsd: 1000,
    });
    const id = created.body.id;
    const res = await request(app).get(`/api/jobs/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
  });

  test('GET /api/jobs/:id - not found returns 404', async () => {
    const res = await request(app).get('/api/jobs/nonexistent');
    expect(res.status).toBe(404);
  });

  test('PUT /api/jobs/:id - owner can update job', async () => {
    const token = await registerAndLogin(client);
    const created = await request(app).post('/api/jobs').set('Authorization', `Bearer ${token}`).send({
      title: 'Old Title', description: 'desc', category: 'dev', budgetUsd: 500,
    });
    const id = created.body.id;
    const res = await request(app).put(`/api/jobs/${id}`).set('Authorization', `Bearer ${token}`).send({ title: 'New Title', budgetUsd: 750 });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New Title');
    expect(res.body.budgetUsd).toBe(750);
  });

  test('PUT /api/jobs/:id - non-owner cannot update', async () => {
    const ownerToken = await registerAndLogin(client);
    const otherToken = await registerAndLogin({ name: 'Other Client', email: 'other@example.com', password: 'pass', role: 'client' });
    const created = await request(app).post('/api/jobs').set('Authorization', `Bearer ${ownerToken}`).send({
      title: 'My Job', description: 'desc', category: 'dev', budgetUsd: 500,
    });
    const id = created.body.id;
    const res = await request(app).put(`/api/jobs/${id}`).set('Authorization', `Bearer ${otherToken}`).send({ title: 'Hijacked' });
    expect(res.status).toBe(403);
  });

  test('DELETE /api/jobs/:id - owner can cancel job', async () => {
    const token = await registerAndLogin(client);
    const created = await request(app).post('/api/jobs').set('Authorization', `Bearer ${token}`).send({
      title: 'My Job', description: 'desc', category: 'dev', budgetUsd: 500,
    });
    const id = created.body.id;
    const res = await request(app).delete(`/api/jobs/${id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const check = await request(app).get(`/api/jobs/${id}`);
    expect(check.body.status).toBe('cancelled');
  });

  test('DELETE /api/jobs/:id - non-owner cannot delete', async () => {
    const ownerToken = await registerAndLogin(client);
    const otherToken = await registerAndLogin({ name: 'Other2', email: 'other2@example.com', password: 'pass', role: 'client' });
    const created = await request(app).post('/api/jobs').set('Authorization', `Bearer ${ownerToken}`).send({
      title: 'My Job', description: 'desc', category: 'dev', budgetUsd: 500,
    });
    const id = created.body.id;
    const res = await request(app).delete(`/api/jobs/${id}`).set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
  });

  test('GET /api/jobs - search by title keyword', async () => {
    const token = await registerAndLogin(client);
    await request(app).post('/api/jobs').set('Authorization', `Bearer ${token}`).send({
      title: 'Need a React Developer', description: 'Build SPA', category: 'dev', budgetUsd: 500,
    });
    await request(app).post('/api/jobs').set('Authorization', `Bearer ${token}`).send({
      title: 'Logo Design Needed', description: 'Create brand logo', category: 'design', budgetUsd: 150,
    });

    const res = await request(app).get('/api/jobs?search=react');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].title).toBe('Need a React Developer');
  });

  test('GET /api/jobs - search by description keyword', async () => {
    const token = await registerAndLogin(client);
    await request(app).post('/api/jobs').set('Authorization', `Bearer ${token}`).send({
      title: 'Job A', description: 'Looking for a Figma expert', category: 'design', budgetUsd: 200,
    });
    await request(app).post('/api/jobs').set('Authorization', `Bearer ${token}`).send({
      title: 'Job B', description: 'Express API development', category: 'dev', budgetUsd: 300,
    });

    const res = await request(app).get('/api/jobs?search=figma');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].description).toContain('Figma');
  });

  test('GET /api/jobs - search with no matches returns empty array', async () => {
    const token = await registerAndLogin(client);
    await request(app).post('/api/jobs').set('Authorization', `Bearer ${token}`).send({
      title: 'Web Development', description: 'Need a site', category: 'web', budgetUsd: 500,
    });

    const res = await request(app).get('/api/jobs?search=blockchain');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(0);
  });

  test('GET /api/jobs - pagination slices results and sets headers', async () => {
    const token = await registerAndLogin(client);
    for (let i = 1; i <= 5; i++) {
      await request(app).post('/api/jobs').set('Authorization', `Bearer ${token}`).send({
        title: `Job ${i}`, description: 'desc', category: 'web', budgetUsd: 300,
      });
    }

    const res = await request(app).get('/api/jobs?page=1&limit=3');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(3);
    expect(res.headers['x-total-count']).toBe('5');
    expect(res.headers['x-page']).toBe('1');
    expect(res.headers['x-limit']).toBe('3');
  });

  test('GET /api/jobs - X-Total-Count set even without pagination params', async () => {
    const token = await registerAndLogin(client);
    await request(app).post('/api/jobs').set('Authorization', `Bearer ${token}`).send({
      title: 'A Job', description: 'desc', category: 'dev', budgetUsd: 400,
    });

    const res = await request(app).get('/api/jobs');
    expect(res.status).toBe(200);
    expect(res.headers['x-total-count']).toBe('1');
  });
});
