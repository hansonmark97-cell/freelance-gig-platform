'use strict';

const request = require('supertest');
const { buildTestApp } = require('./helpers');

let app, cleanup;
beforeAll(() => { ({ app, cleanup } = buildTestApp()); });
afterAll(() => cleanup());

describe('Players catalogue', () => {
  test('GET /players — returns all seeded players', async () => {
    const res = await request(app).get('/players');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(50);
  });

  test('GET /players — filter by position', async () => {
    const res = await request(app).get('/players?position=GK');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    res.body.forEach(p => expect(p.position).toBe('GK'));
  });

  test('GET /players — filter by rarity', async () => {
    const res = await request(app).get('/players?rarity=legendary');
    expect(res.status).toBe(200);
    res.body.forEach(p => expect(p.rarity).toBe('legendary'));
  });

  test('GET /players — filter by min_rating', async () => {
    const res = await request(app).get('/players?min_rating=90');
    expect(res.status).toBe(200);
    res.body.forEach(p => expect(p.rating).toBeGreaterThanOrEqual(90));
  });

  test('GET /players/:id — returns player', async () => {
    const all = await request(app).get('/players');
    const id = all.body[0].id;
    const res = await request(app).get(`/players/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
  });

  test('GET /players/:id — 404 for unknown', async () => {
    const res = await request(app).get('/players/99999');
    expect(res.status).toBe(404);
  });
});
