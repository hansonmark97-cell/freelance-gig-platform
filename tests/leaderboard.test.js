'use strict';

const request = require('supertest');
const { buildTestApp } = require('./helpers');

let app, cleanup;
beforeAll(async () => {
  ({ app, cleanup } = buildTestApp());
  // Create managers and play some matches so leaderboard is populated
  const m1 = await request(app).post('/managers')
    .send({ username: 'top_dog', email: 'top@test.com', team_name: 'Top FC' });
  const m2 = await request(app).post('/managers')
    .send({ username: 'mid_table', email: 'mid@test.com', team_name: 'Mid FC' });
  for (let i = 0; i < 3; i++) {
    await request(app).post('/matches').send({ home_manager_id: m1.body.id });
    await request(app).post('/matches').send({ home_manager_id: m2.body.id });
  }
});
afterAll(() => cleanup());

describe('Leaderboard', () => {
  test('GET /leaderboard — returns managers sorted by points', async () => {
    const res = await request(app).get('/leaderboard');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    // Points should be non-increasing
    for (let i = 1; i < res.body.length; i++) {
      expect(res.body[i].points).toBeLessThanOrEqual(res.body[i - 1].points);
    }
  });

  test('GET /leaderboard?limit=1 — respects limit', async () => {
    const res = await request(app).get('/leaderboard?limit=1');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });

  test('GET /leaderboard — each row has expected fields', async () => {
    const res = await request(app).get('/leaderboard');
    res.body.forEach(m => {
      expect(m).toHaveProperty('username');
      expect(m).toHaveProperty('team_name');
      expect(m).toHaveProperty('points');
      expect(m).toHaveProperty('wins');
    });
  });
});
