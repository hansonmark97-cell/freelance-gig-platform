'use strict';

const request = require('supertest');
const { createDatabase } = require('../src/database');
const { createApp } = require('../src/app');

let app;
let freelancerId;
let clientId;

beforeAll(async () => {
  const db = createDatabase(':memory:');
  app = createApp(db);

  const fl = await request(app).post('/api/users').send({ username: 'gigFreelancer', email: 'gf@example.com', role: 'freelancer', hourly_rate: 60 });
  freelancerId = fl.body.id;

  const cl = await request(app).post('/api/users').send({ username: 'gigClient', email: 'gc@example.com', role: 'client' });
  clientId = cl.body.id;
});

describe('POST /api/gigs', () => {
  it('creates a gig for a freelancer', async () => {
    const res = await request(app).post('/api/gigs').send({
      user_id: freelancerId, title: 'Web Dev', description: 'I build sites', category: 'development', price: 500, delivery_days: 7
    });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Web Dev');
    expect(res.body.status).toBe('active');
  });

  it('rejects gig creation by a client', async () => {
    const res = await request(app).post('/api/gigs').send({
      user_id: clientId, title: 'Web Dev', description: 'I build sites', category: 'development', price: 500, delivery_days: 7
    });
    expect(res.status).toBe(403);
  });

  it('rejects missing fields', async () => {
    const res = await request(app).post('/api/gigs').send({ user_id: freelancerId, title: 'Incomplete' });
    expect(res.status).toBe(400);
  });

  it('rejects invalid user_id', async () => {
    const res = await request(app).post('/api/gigs').send({
      user_id: 99999, title: 'Web Dev', description: 'I build sites', category: 'development', price: 500, delivery_days: 7
    });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/gigs', () => {
  it('lists active gigs with owner info', async () => {
    const res = await request(app).get('/api/gigs');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.total).toBe('number');
    if (res.body.data.length > 0) {
      expect(res.body.data[0]).toHaveProperty('username');
    }
  });

  it('filters by category', async () => {
    const res = await request(app).get('/api/gigs?category=development');
    expect(res.status).toBe(200);
    res.body.data.forEach(g => expect(g.category).toBe('development'));
  });

  it('serves from cache on second request', async () => {
    const r1 = await request(app).get('/api/gigs?limit=5');
    const r2 = await request(app).get('/api/gigs?limit=5');
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r2.body.total).toBe(r1.body.total);
  });
});

describe('GET /api/gigs/:id', () => {
  let gigId;
  beforeAll(async () => {
    const res = await request(app).get('/api/gigs');
    gigId = res.body.data[0].id;
  });

  it('returns a single gig', async () => {
    const res = await request(app).get(`/api/gigs/${gigId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(gigId);
  });

  it('returns 404 for missing gig', async () => {
    const res = await request(app).get('/api/gigs/99999');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/gigs/:id', () => {
  let gigId;
  beforeAll(async () => {
    const res = await request(app).get('/api/gigs');
    gigId = res.body.data[0].id;
  });

  it('updates a gig', async () => {
    const res = await request(app).patch(`/api/gigs/${gigId}`).send({ price: 999 });
    expect(res.status).toBe(200);
    expect(res.body.price).toBe(999);
  });
});

describe('DELETE /api/gigs/:id', () => {
  it('soft-deletes a gig', async () => {
    const created = await request(app).post('/api/gigs').send({
      user_id: freelancerId, title: 'ToDelete', description: 'desc', category: 'design', price: 100, delivery_days: 3
    });
    const id = created.body.id;
    const del = await request(app).delete(`/api/gigs/${id}`);
    expect(del.status).toBe(204);

    const get = await request(app).get(`/api/gigs/${id}`);
    expect(get.status).toBe(404);
  });
});
