'use strict';

const request = require('supertest');
const { createDatabase } = require('../src/database');
const { createApp } = require('../src/app');

let app;

beforeAll(() => {
  const db = createDatabase(':memory:');
  app = createApp(db);
});

describe('POST /api/users', () => {
  it('creates a freelancer', async () => {
    const res = await request(app).post('/api/users').send({
      username: 'alice', email: 'alice@example.com', role: 'freelancer',
      skills: 'Node.js, React', hourly_rate: 75
    });
    expect(res.status).toBe(201);
    expect(res.body.username).toBe('alice');
    expect(res.body.role).toBe('freelancer');
  });

  it('creates a client', async () => {
    const res = await request(app).post('/api/users').send({
      username: 'bob', email: 'bob@example.com', role: 'client'
    });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('client');
  });

  it('rejects missing fields', async () => {
    const res = await request(app).post('/api/users').send({ username: 'ghost' });
    expect(res.status).toBe(400);
  });

  it('rejects invalid role', async () => {
    const res = await request(app).post('/api/users').send({
      username: 'bad', email: 'bad@example.com', role: 'admin'
    });
    expect(res.status).toBe(400);
  });

  it('rejects duplicate username', async () => {
    const res = await request(app).post('/api/users').send({
      username: 'alice', email: 'alice2@example.com', role: 'freelancer'
    });
    expect(res.status).toBe(409);
  });
});

describe('GET /api/users', () => {
  it('lists users', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.total).toBe('number');
  });

  it('filters by role', async () => {
    const res = await request(app).get('/api/users?role=freelancer');
    expect(res.status).toBe(200);
    res.body.data.forEach(u => expect(u.role).toBe('freelancer'));
  });

  it('respects limit and offset', async () => {
    const res = await request(app).get('/api/users?limit=1&offset=0');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(1);
    expect(res.body.limit).toBe(1);
  });
});

describe('GET /api/users/:id', () => {
  it('returns a user with review stats', async () => {
    // Get the id of alice from the list
    const list = await request(app).get('/api/users?role=freelancer');
    const alice = list.body.data.find(u => u.username === 'alice');
    const res = await request(app).get(`/api/users/${alice.id}`);
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('alice');
    expect(typeof res.body.review_count).toBe('number');
  });

  it('returns 404 for missing user', async () => {
    const res = await request(app).get('/api/users/99999');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/users/:id', () => {
  it('updates user profile', async () => {
    const list = await request(app).get('/api/users?role=freelancer');
    const alice = list.body.data.find(u => u.username === 'alice');
    const res = await request(app).patch(`/api/users/${alice.id}`).send({ bio: 'Experienced dev', hourly_rate: 90 });
    expect(res.status).toBe(200);
    expect(res.body.bio).toBe('Experienced dev');
    expect(res.body.hourly_rate).toBe(90);
  });

  it('returns 404 for missing user', async () => {
    const res = await request(app).patch('/api/users/99999').send({ bio: 'x' });
    expect(res.status).toBe(404);
  });
});
