'use strict';

const request = require('supertest');
const { buildTestApp } = require('./helpers');

let app, cleanup;
beforeAll(() => { ({ app, cleanup } = buildTestApp()); });
afterAll(() => cleanup());

describe('Managers', () => {
  let managerId;

  test('POST /managers — creates a manager', async () => {
    const res = await request(app).post('/managers')
      .send({ username: 'alex', email: 'alex@test.com', team_name: 'Alex FC' });
    expect(res.status).toBe(201);
    expect(res.body.username).toBe('alex');
    expect(res.body.team_name).toBe('Alex FC');
    expect(res.body.coins).toBe(0);
    managerId = res.body.id;
  });

  test('POST /managers — duplicate username returns 409', async () => {
    const res = await request(app).post('/managers')
      .send({ username: 'alex', email: 'other@test.com' });
    expect(res.status).toBe(409);
  });

  test('POST /managers — missing fields returns 400', async () => {
    const res = await request(app).post('/managers').send({ username: 'x' });
    expect(res.status).toBe(400);
  });

  test('GET /managers — lists managers', async () => {
    const res = await request(app).get('/managers');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('GET /managers/:id — gets manager', async () => {
    const res = await request(app).get(`/managers/${managerId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(managerId);
  });

  test('GET /managers/:id — 404 for unknown', async () => {
    const res = await request(app).get('/managers/99999');
    expect(res.status).toBe(404);
  });

  test('PATCH /managers/:id — updates team name', async () => {
    const res = await request(app).patch(`/managers/${managerId}`)
      .send({ team_name: 'Super FC' });
    expect(res.status).toBe(200);
    expect(res.body.team_name).toBe('Super FC');
  });
});
