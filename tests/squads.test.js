'use strict';

const request = require('supertest');
const { buildTestApp } = require('./helpers');

let app, cleanup, managerId;
beforeAll(async () => {
  ({ app, cleanup } = buildTestApp());
  const mgr = await request(app).post('/managers')
    .send({ username: 'squadder', email: 'squad@test.com', team_name: 'Squad FC' });
  managerId = mgr.body.id;
  // Give manager some players by purchasing a pack
  const packs = await request(app).get('/store/packs');
  await request(app).post('/store/purchase')
    .send({ manager_id: managerId, coin_pack_id: packs.body[packs.body.length - 1].id });
  await request(app).post('/packs/open')
    .send({ manager_id: managerId, pack_type: 'elite' });
});
afterAll(() => cleanup());

describe('Squads', () => {
  test('GET /managers/:id/squad — lists owned players', async () => {
    const res = await request(app).get(`/managers/${managerId}/squad`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('GET /managers/:id/squad — 404 for unknown manager', async () => {
    const res = await request(app).get('/managers/99999/squad');
    expect(res.status).toBe(404);
  });

  test('PUT /managers/:id/squad — sets starting lineup', async () => {
    const owned = await request(app).get(`/managers/${managerId}/squad`);
    const slots = owned.body.slice(0, 5).map((p, i) => ({
      squad_player_id: p.squad_player_id,
      squad_slot: i + 1,
    }));
    const res = await request(app).put(`/managers/${managerId}/squad`).send({ slots });
    expect(res.status).toBe(200);
    const inSquad = res.body.filter(p => p.in_squad === 1);
    expect(inSquad.length).toBe(5);
  });

  test('PUT /managers/:id/squad — max 11 players enforced', async () => {
    const owned = await request(app).get(`/managers/${managerId}/squad`);
    // Try to set 12 slots
    const slots = owned.body.slice(0, 12).map((p, i) => ({
      squad_player_id: p.squad_player_id,
      squad_slot: i + 1,
    }));
    if (slots.length < 12) return; // skip if manager has fewer than 12 players
    const res = await request(app).put(`/managers/${managerId}/squad`).send({ slots });
    expect(res.status).toBe(400);
  });

  test('PUT /managers/:id/squad — 404 for unknown manager', async () => {
    const res = await request(app).put('/managers/99999/squad').send({ slots: [] });
    expect(res.status).toBe(404);
  });

  test('PUT /managers/:id/squad — requires slots array', async () => {
    const res = await request(app).put(`/managers/${managerId}/squad`).send({});
    expect(res.status).toBe(400);
  });
});
