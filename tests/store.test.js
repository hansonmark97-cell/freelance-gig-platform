'use strict';

const request = require('supertest');
const { buildTestApp } = require('./helpers');

let app, db, cleanup, managerId;
beforeAll(async () => {
  ({ app, db, cleanup } = buildTestApp());
  const res = await request(app).post('/managers')
    .send({ username: 'shopper', email: 'shopper@test.com', team_name: 'Shop FC' });
  managerId = res.body.id;
});
afterAll(() => cleanup());

describe('Coin Store', () => {
  let packId;

  test('GET /store/packs — returns coin packs', async () => {
    const res = await request(app).get('/store/packs');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    packId = res.body[0].id;
    expect(res.body[0]).toHaveProperty('coins');
    expect(res.body[0]).toHaveProperty('price_usd');
  });

  test('POST /store/purchase — buys coins', async () => {
    const res = await request(app).post('/store/purchase')
      .send({ manager_id: managerId, coin_pack_id: packId });
    expect(res.status).toBe(201);
    expect(res.body.purchase.coins_awarded).toBeGreaterThan(0);
    expect(res.body.manager.coins).toBeGreaterThan(0);
  });

  test('POST /store/purchase — missing fields returns 400', async () => {
    const res = await request(app).post('/store/purchase').send({});
    expect(res.status).toBe(400);
  });

  test('POST /store/purchase — unknown manager returns 404', async () => {
    const res = await request(app).post('/store/purchase')
      .send({ manager_id: 99999, coin_pack_id: packId });
    expect(res.status).toBe(404);
  });

  test('GET /store/revenue — returns revenue stats', async () => {
    const res = await request(app).get('/store/revenue');
    expect(res.status).toBe(200);
    expect(res.body.totals.total_purchases).toBeGreaterThan(0);
    expect(res.body.totals.total_revenue_usd).toBeGreaterThan(0);
  });

  test('GET /store/purchases/:managerId — lists manager purchases', async () => {
    const res = await request(app).get(`/store/purchases/${managerId}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('GET /store/purchases/:managerId — 404 for unknown', async () => {
    const res = await request(app).get('/store/purchases/99999');
    expect(res.status).toBe(404);
  });
});
