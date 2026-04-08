process.env.DATABASE_PATH = ':memory:';

const request = require('supertest');
const app = require('../src/app');

describe('Users API', () => {
  let createdUserId;

  test('1. POST /api/users - creates user successfully (201)', async () => {
    const res = await request(app).post('/api/users').send({
      username: 'testuser1',
      email: 'test1@example.com',
      password: 'password123',
      role: 'freelancer',
      bio: 'Hello world',
      hourly_rate: 50
    });
    expect(res.status).toBe(201);
    expect(res.body.username).toBe('testuser1');
    expect(res.body.email).toBe('test1@example.com');
    expect(res.body.role).toBe('freelancer');
    expect(res.body.password_hash).toBeUndefined();
    createdUserId = res.body.id;
  });

  test('2. POST /api/users - returns 409 for duplicate email', async () => {
    await request(app).post('/api/users').send({
      username: 'uniqueuser',
      email: 'dup@example.com',
      password: 'pass',
      role: 'client'
    });
    const res = await request(app).post('/api/users').send({
      username: 'differentuser',
      email: 'dup@example.com',
      password: 'pass',
      role: 'client'
    });
    expect(res.status).toBe(409);
  });

  test('3. POST /api/users - returns 400 for missing required fields', async () => {
    const res = await request(app).post('/api/users').send({ username: 'incomplete' });
    expect(res.status).toBe(400);
  });

  test('4. GET /api/users - returns array of users', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('5. GET /api/users/:id - returns user by id', async () => {
    const created = await request(app).post('/api/users').send({
      username: 'getbyid',
      email: 'getbyid@example.com',
      password: 'pass',
      role: 'freelancer'
    });
    const res = await request(app).get(`/api/users/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
    expect(res.body.password_hash).toBeUndefined();
  });

  test('6. GET /api/users/:id - returns 404 for non-existent user', async () => {
    const res = await request(app).get('/api/users/999999');
    expect(res.status).toBe(404);
  });

  test('7. PUT /api/users/:id - updates user fields', async () => {
    const created = await request(app).post('/api/users').send({
      username: 'updateme',
      email: 'updateme@example.com',
      password: 'pass',
      role: 'freelancer'
    });
    const res = await request(app).put(`/api/users/${created.body.id}`).send({ bio: 'Updated bio', hourly_rate: 75 });
    expect(res.status).toBe(200);
    expect(res.body.bio).toBe('Updated bio');
    expect(res.body.hourly_rate).toBe(75);
  });

  test('8. PUT /api/users/:id - returns 404 for non-existent user', async () => {
    const res = await request(app).put('/api/users/999999').send({ bio: 'nope' });
    expect(res.status).toBe(404);
  });

  test('9. DELETE /api/users/:id - deletes user (204)', async () => {
    const created = await request(app).post('/api/users').send({
      username: 'deleteme',
      email: 'deleteme@example.com',
      password: 'pass',
      role: 'client'
    });
    const res = await request(app).delete(`/api/users/${created.body.id}`);
    expect(res.status).toBe(204);
  });

  test('10. DELETE /api/users/:id - returns 404 for non-existent user', async () => {
    const res = await request(app).delete('/api/users/999999');
    expect(res.status).toBe(404);
  });

  test('11. POST /api/users/login - returns user on valid credentials', async () => {
    await request(app).post('/api/users').send({
      username: 'loginuser',
      email: 'login@example.com',
      password: 'mypassword',
      role: 'freelancer'
    });
    const res = await request(app).post('/api/users/login').send({
      email: 'login@example.com',
      password: 'mypassword'
    });
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('login@example.com');
    expect(res.body.password_hash).toBeUndefined();
  });
});
