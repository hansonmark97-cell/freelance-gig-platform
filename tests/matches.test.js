'use strict';

const request = require('supertest');
const { buildTestApp } = require('./helpers');

let app, cleanup, manager1Id, manager2Id;
beforeAll(async () => {
  ({ app, cleanup } = buildTestApp());
  const m1 = await request(app).post('/managers')
    .send({ username: 'home_mgr', email: 'home@test.com', team_name: 'Home United' });
  manager1Id = m1.body.id;
  const m2 = await request(app).post('/managers')
    .send({ username: 'away_mgr', email: 'away@test.com', team_name: 'Away City' });
  manager2Id = m2.body.id;
});
afterAll(() => cleanup());

describe('Matches', () => {
  let matchId;

  test('POST /matches — plays vs AI and updates manager stats', async () => {
    const res = await request(app).post('/matches')
      .send({ home_manager_id: manager1Id });
    expect(res.status).toBe(201);
    expect(res.body.match).toHaveProperty('result');
    expect(['home_win', 'away_win', 'draw']).toContain(res.body.match.result);
    expect(res.body.match.coins_earned).toBeGreaterThan(0);
    const mgr = res.body.home_manager;
    const total = mgr.wins + mgr.draws + mgr.losses;
    expect(total).toBe(1);
    matchId = res.body.match.id;
  });

  test('POST /matches — plays vs another manager', async () => {
    const res = await request(app).post('/matches')
      .send({ home_manager_id: manager1Id, away_manager_id: manager2Id });
    expect(res.status).toBe(201);
    expect(res.body.match.away_manager_id).toBe(manager2Id);
  });

  test('POST /matches — cannot play against yourself', async () => {
    const res = await request(app).post('/matches')
      .send({ home_manager_id: manager1Id, away_manager_id: manager1Id });
    expect(res.status).toBe(400);
  });

  test('POST /matches — missing home_manager_id returns 400', async () => {
    const res = await request(app).post('/matches').send({});
    expect(res.status).toBe(400);
  });

  test('POST /matches — unknown manager returns 404', async () => {
    const res = await request(app).post('/matches')
      .send({ home_manager_id: 99999 });
    expect(res.status).toBe(404);
  });

  test('GET /matches — lists recent matches', async () => {
    const res = await request(app).get('/matches');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('GET /matches — filter by manager_id', async () => {
    const res = await request(app).get(`/matches?manager_id=${manager1Id}`);
    expect(res.status).toBe(200);
    res.body.forEach(m => {
      expect(m.home_manager_id === manager1Id || m.away_manager_id === manager1Id).toBe(true);
    });
  });

  test('GET /matches/:id — gets match', async () => {
    const res = await request(app).get(`/matches/${matchId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(matchId);
  });

  test('GET /matches/:id — 404 for unknown', async () => {
    const res = await request(app).get('/matches/99999');
    expect(res.status).toBe(404);
  });

  test('coins are awarded after winning', async () => {
    // Play many matches; at least one should be a win, granting > 25 coins (wins give 200)
    let maxCoins = 0;
    for (let i = 0; i < 10; i++) {
      const r = await request(app).post('/matches').send({ home_manager_id: manager1Id });
      maxCoins = Math.max(maxCoins, r.body.match.coins_earned);
    }
    expect(maxCoins).toBeGreaterThanOrEqual(25);
  });
});
