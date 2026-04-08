process.env.DATABASE_PATH = ':memory:';

const request = require('supertest');
const app = require('../src/app');

describe('Jobs API', () => {
  let clientId;

  beforeAll(async () => {
    const userRes = await request(app).post('/api/users').send({
      username: 'jobclient',
      email: 'jobclient@example.com',
      password: 'pass',
      role: 'client'
    });
    clientId = userRes.body.id;
  });

  test('1. POST /api/jobs - creates job (201)', async () => {
    const res = await request(app).post('/api/jobs').send({
      title: 'Backend Developer',
      description: 'Need Node.js dev',
      skills_required: 'Node.js, Express',
      budget_min: 1000,
      budget_max: 3000,
      client_id: clientId
    });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Backend Developer');
    expect(res.body.status).toBe('open');
  });

  test('2. POST /api/jobs - returns 400 for missing fields', async () => {
    const res = await request(app).post('/api/jobs').send({ title: 'Incomplete' });
    expect(res.status).toBe(400);
  });

  test('3. GET /api/jobs - returns array', async () => {
    const res = await request(app).get('/api/jobs');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('4. GET /api/jobs - filters by status', async () => {
    const res = await request(app).get('/api/jobs?status=open');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    res.body.forEach(j => expect(j.status).toBe('open'));
  });

  test('5. GET /api/jobs/:id - returns job', async () => {
    const created = await request(app).post('/api/jobs').send({
      title: 'Frontend Dev',
      description: 'React expert needed',
      skills_required: 'React',
      budget_min: 500,
      budget_max: 1500,
      client_id: clientId
    });
    const res = await request(app).get(`/api/jobs/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
  });

  test('6. GET /api/jobs/:id - 404 for non-existent', async () => {
    const res = await request(app).get('/api/jobs/999999');
    expect(res.status).toBe(404);
  });

  test('7. PUT /api/jobs/:id - updates job', async () => {
    const created = await request(app).post('/api/jobs').send({
      title: 'Update Job',
      description: 'Desc',
      skills_required: 'Python',
      budget_min: 200,
      budget_max: 800,
      client_id: clientId
    });
    const res = await request(app).put(`/api/jobs/${created.body.id}`).send({ status: 'filled', budget_max: 1000 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('filled');
    expect(res.body.budget_max).toBe(1000);
  });

  test('8. PUT /api/jobs/:id - 404 for non-existent', async () => {
    const res = await request(app).put('/api/jobs/999999').send({ title: 'nope' });
    expect(res.status).toBe(404);
  });

  test('9. DELETE /api/jobs/:id - deletes (204)', async () => {
    const created = await request(app).post('/api/jobs').send({
      title: 'Delete Job',
      description: 'Desc',
      skills_required: 'PHP',
      budget_min: 100,
      budget_max: 500,
      client_id: clientId
    });
    const res = await request(app).delete(`/api/jobs/${created.body.id}`);
    expect(res.status).toBe(204);
  });

  test('10. DELETE /api/jobs/:id - 404 for non-existent', async () => {
    const res = await request(app).delete('/api/jobs/999999');
    expect(res.status).toBe(404);
  });

  test('11. GET /api/jobs - filters by client_id', async () => {
    const res = await request(app).get(`/api/jobs?client_id=${clientId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    res.body.forEach(j => expect(j.client_id).toBe(clientId));
  });
});
