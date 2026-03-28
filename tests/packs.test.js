'use strict';

const request = require('supertest');
const { buildTestApp } = require('./helpers');

let app, cleanup, managerId;
beforeAll(async () => {
  ({ app, cleanup } = buildTestApp());
  // Create manager and give them coins via a purchase
  const mgr = await request(app).post('/managers')
    .send({ username: 'packer', email: 'packer@test.com' });
  managerId = mgr.body.id;
  const packRes = await request(app).get('/store/packs');
  const bigPack = packRes.body.find(p => p.coins >= 10000) || packRes.body[packRes.body.length - 1];
  await request(app).post('/store/purchase').send({ manager_id: managerId, coin_pack_id: bigPack.id });
});
afterAll(() => cleanup());

describe('Player Packs', () => {
  test('GET /packs/types — lists pack types with rarity odds', async () => {
    const res = await request(app).get('/packs/types');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(3);
    res.body.forEach(t => {
      expect(t).toHaveProperty('type');
      expect(t).toHaveProperty('cost_coins');
      expect(t).toHaveProperty('players');
      expect(t).toHaveProperty('rarity_odds');
    });
  });

  test('POST /packs/open — opens a standard pack', async () => {
    const res = await request(app).post('/packs/open')
      .send({ manager_id: managerId, pack_type: 'standard' });
    expect(res.status).toBe(201);
    expect(res.body.players_drawn.length).toBe(5);
    expect(res.body.manager.coins).toBeGreaterThanOrEqual(0);
  });

  test('POST /packs/open — opens an elite pack', async () => {
    const res = await request(app).post('/packs/open')
      .send({ manager_id: managerId, pack_type: 'elite' });
    expect(res.status).toBe(201);
    expect(res.body.players_drawn.length).toBe(12);
  });

  test('POST /packs/open — insufficient coins returns 402', async () => {
    // Drain remaining coins by checking balance first, then try elite pack
    const mgr2 = await request(app).post('/managers')
      .send({ username: 'broke', email: 'broke@test.com' });
    const res = await request(app).post('/packs/open')
      .send({ manager_id: mgr2.body.id, pack_type: 'standard' });
    expect(res.status).toBe(402);
  });

  test('POST /packs/open — invalid pack type returns 400', async () => {
    const res = await request(app).post('/packs/open')
      .send({ manager_id: managerId, pack_type: 'ultra' });
    expect(res.status).toBe(400);
  });

  test('POST /packs/open — missing fields returns 400', async () => {
    const res = await request(app).post('/packs/open').send({});
    expect(res.status).toBe(400);
  });

  test('POST /packs/open — unknown manager returns 404', async () => {
    const res = await request(app).post('/packs/open')
      .send({ manager_id: 99999, pack_type: 'standard' });
    expect(res.status).toBe(404);
  });
});
