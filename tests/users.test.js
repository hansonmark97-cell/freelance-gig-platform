'use strict';

const request = require('supertest');

jest.mock('../src/firebase', () => {
  const { mockDb } = require('./firestoreMock');
  return { db: mockDb };
});

const app = require('../src/app');
const { mockDb } = require('./firestoreMock');

beforeEach(() => mockDb.reset());

describe('Users API', () => {
  const validUser = {
    name: 'Alice',
    email: 'alice@example.com',
    role: 'freelancer',
    bio: 'Full-stack developer',
    skills: ['JavaScript', 'Node.js'],
    hourlyRate: 80,
  };

  test('POST /api/users - creates a user successfully', async () => {
    const res = await request(app).post('/api/users').send(validUser);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Alice');
    expect(res.body.email).toBe('alice@example.com');
    expect(res.body.role).toBe('freelancer');
    expect(res.body.createdAt).toBeDefined();
  });

  test('POST /api/users - returns 400 if name is missing', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ email: 'b@example.com', role: 'client' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/);
  });

  test('POST /api/users - returns 400 if email is missing', async () => {
    const res = await request(app).post('/api/users').send({ name: 'Bob', role: 'client' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/);
  });

  test('POST /api/users - returns 400 for invalid role', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ name: 'Bob', email: 'bob@example.com', role: 'admin' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/role/);
  });

  test('POST /api/users - returns 409 if email already in use', async () => {
    await request(app).post('/api/users').send(validUser);
    const res = await request(app).post('/api/users').send(validUser);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already in use/);
  });

  test('GET /api/users - returns all users', async () => {
    await request(app).post('/api/users').send(validUser);
    await request(app)
      .post('/api/users')
      .send({ name: 'Bob', email: 'bob@example.com', role: 'client' });
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  test('GET /api/users/:id - returns user by id', async () => {
    const created = await request(app).post('/api/users').send(validUser);
    const res = await request(app).get(`/api/users/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('alice@example.com');
  });

  test('GET /api/users/:id - returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/users/nonexistent-id');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  test('PUT /api/users/:id - updates user fields', async () => {
    const created = await request(app).post('/api/users').send(validUser);
    const res = await request(app)
      .put(`/api/users/${created.body.id}`)
      .send({ bio: 'Updated bio', hourlyRate: 100 });
    expect(res.status).toBe(200);
    expect(res.body.bio).toBe('Updated bio');
    expect(res.body.hourlyRate).toBe(100);
  });

  test('PUT /api/users/:id - returns 404 for unknown id', async () => {
    const res = await request(app).put('/api/users/nonexistent-id').send({ bio: 'Bio' });
    expect(res.status).toBe(404);
  });

  test('DELETE /api/users/:id - deletes user', async () => {
    const created = await request(app).post('/api/users').send(validUser);
    const del = await request(app).delete(`/api/users/${created.body.id}`);
    expect(del.status).toBe(204);
    const get = await request(app).get(`/api/users/${created.body.id}`);
    expect(get.status).toBe(404);
  });

  test('DELETE /api/users/:id - returns 404 for unknown id', async () => {
    const res = await request(app).delete('/api/users/nonexistent-id');
    expect(res.status).toBe(404);
  });
});
