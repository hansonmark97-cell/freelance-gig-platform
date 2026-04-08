'use strict';

const request  = require('supertest');
const path     = require('path');
const fs       = require('fs');
const { closeDb } = require('../src/database');

// Use a separate test DB
process.env.DB_PATH = path.join(__dirname, '..', 'data', 'test.db');

const app = require('../src/app');

// ── helpers ──────────────────────────────────────────────────────────────────
async function register(data) {
  return request(app).post('/api/auth/register').send(data);
}
async function login(email, password) {
  const r = await request(app).post('/api/auth/login').send({ email, password });
  return r.body.token;
}

afterAll(() => {
  closeDb();
  const dbFile = path.join(__dirname, '..', 'data', 'test.db');
  if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
  ['-wal', '-shm'].forEach(ext => {
    const f = dbFile + ext;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
});

// ── Auth ──────────────────────────────────────────────────────────────────────
describe('Auth', () => {
  test('register a shipper', async () => {
    const res = await register({ name: 'Sam Shipper', email: 'sam@test.com', password: 'pass1234', role: 'shipper' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('shipper');
    expect(res.body.token).toBeTruthy();
  });

  test('register a trucker', async () => {
    const res = await register({ name: 'Tom Trucker', email: 'tom@test.com', password: 'pass1234', role: 'trucker' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('trucker');
  });

  test('duplicate email returns 409', async () => {
    const res = await register({ name: 'X', email: 'sam@test.com', password: 'x', role: 'shipper' });
    expect(res.status).toBe(409);
  });

  test('invalid role returns 400', async () => {
    const res = await register({ name: 'X', email: 'x@test.com', password: 'x', role: 'admin' });
    expect(res.status).toBe(400);
  });

  test('login with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'sam@test.com', password: 'pass1234' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  test('login with wrong password returns 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'sam@test.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  test('unauthenticated request returns 401', async () => {
    const res = await request(app).get('/api/loads');
    expect(res.status).toBe(401);
  });
});

// ── Loads ──────────────────────────────────────────────────────────────────────
describe('Loads', () => {
  let shipperToken, truckerToken, loadId;

  beforeAll(async () => {
    shipperToken = await login('sam@test.com', 'pass1234');
    truckerToken = await login('tom@test.com', 'pass1234');
  });

  test('shipper can post a load', async () => {
    const res = await request(app).post('/api/loads')
      .set('Authorization', `Bearer ${shipperToken}`)
      .send({ origin: 'Chicago, IL', destination: 'Dallas, TX', freight_type: 'Dry Van', weight_lbs: 10000, pay_usd: 2000 });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('open');
    loadId = res.body.id;
  });

  test('trucker cannot post a load', async () => {
    const res = await request(app).post('/api/loads')
      .set('Authorization', `Bearer ${truckerToken}`)
      .send({ origin: 'A', destination: 'B', freight_type: 'X', weight_lbs: 100, pay_usd: 500 });
    expect(res.status).toBe(403);
  });

  test('GET /api/loads returns open loads', async () => {
    const res = await request(app).get('/api/loads').set('Authorization', `Bearer ${truckerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('GET /api/loads/:id returns load', async () => {
    const res = await request(app).get(`/api/loads/${loadId}`).set('Authorization', `Bearer ${truckerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(loadId);
  });

  test('shipper can update their load', async () => {
    const res = await request(app).put(`/api/loads/${loadId}`)
      .set('Authorization', `Bearer ${shipperToken}`)
      .send({ pay_usd: 2200 });
    expect(res.status).toBe(200);
    expect(res.body.pay_usd).toBe(2200);
  });

  test('missing required fields returns 400', async () => {
    const res = await request(app).post('/api/loads')
      .set('Authorization', `Bearer ${shipperToken}`)
      .send({ origin: 'Chicago, IL' });
    expect(res.status).toBe(400);
  });
});

// ── Routes ─────────────────────────────────────────────────────────────────────
describe('Trucker Routes', () => {
  let truckerToken, shipperToken, routeId;

  beforeAll(async () => {
    truckerToken = await login('tom@test.com', 'pass1234');
    shipperToken = await login('sam@test.com', 'pass1234');
  });

  test('trucker can post a route', async () => {
    const res = await request(app).post('/api/routes')
      .set('Authorization', `Bearer ${truckerToken}`)
      .send({ origin: 'Chicago, IL', destination: 'Dallas, TX', departure_date: '2026-05-01', route_type: 'deadmiles', avail_weight_lbs: 20000 });
    expect(res.status).toBe(201);
    expect(res.body.route_type).toBe('deadmiles');
    routeId = res.body.id;
  });

  test('shipper cannot post a route', async () => {
    const res = await request(app).post('/api/routes')
      .set('Authorization', `Bearer ${shipperToken}`)
      .send({ origin: 'A', destination: 'B', departure_date: '2026-05-01', route_type: 'deadmiles', avail_weight_lbs: 1000 });
    expect(res.status).toBe(403);
  });

  test('GET /api/routes returns active routes', async () => {
    const res = await request(app).get('/api/routes').set('Authorization', `Bearer ${shipperToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('invalid route_type returns 400', async () => {
    const res = await request(app).post('/api/routes')
      .set('Authorization', `Bearer ${truckerToken}`)
      .send({ origin: 'A', destination: 'B', departure_date: '2026-05-01', route_type: 'invalid', avail_weight_lbs: 1000 });
    expect(res.status).toBe(400);
  });

  test('trucker can update their route', async () => {
    const res = await request(app).put(`/api/routes/${routeId}`)
      .set('Authorization', `Bearer ${truckerToken}`)
      .send({ avail_weight_lbs: 18000 });
    expect(res.status).toBe(200);
    expect(res.body.avail_weight_lbs).toBe(18000);
  });
});

// ── Matches ────────────────────────────────────────────────────────────────────
describe('Matches', () => {
  let truckerToken;

  beforeAll(async () => {
    truckerToken = await login('tom@test.com', 'pass1234');
  });

  test('GET /api/matches returns potential matches', async () => {
    const res = await request(app).get('/api/matches').set('Authorization', `Bearer ${truckerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/matches?load_id= returns matching routes for a load', async () => {
    const loads = await request(app).get('/api/loads').set('Authorization', `Bearer ${truckerToken}`);
    const loadId = loads.body[0].id;
    const res = await request(app).get(`/api/matches?load_id=${loadId}`).set('Authorization', `Bearer ${truckerToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('matching_routes');
  });
});

// ── Bookings + 9% fee ──────────────────────────────────────────────────────────
describe('Bookings and 9% platform fee', () => {
  let truckerToken, shipperToken, bookingId, loadId, routeId;

  beforeAll(async () => {
    truckerToken = await login('tom@test.com', 'pass1234');
    shipperToken = await login('sam@test.com', 'pass1234');

    // Post a fresh load
    const loadRes = await request(app).post('/api/loads')
      .set('Authorization', `Bearer ${shipperToken}`)
      .send({ origin: 'Memphis, TN', destination: 'Atlanta, GA', freight_type: 'Refrigerated', weight_lbs: 5000, pay_usd: 1000 });
    loadId = loadRes.body.id;

    // Post a matching route
    const routeRes = await request(app).post('/api/routes')
      .set('Authorization', `Bearer ${truckerToken}`)
      .send({ origin: 'Memphis, TN', destination: 'Atlanta, GA', departure_date: '2026-05-10', route_type: 'partial', avail_weight_lbs: 8000 });
    routeId = routeRes.body.id;
  });

  test('trucker can create a booking', async () => {
    const res = await request(app).post('/api/bookings')
      .set('Authorization', `Bearer ${truckerToken}`)
      .send({ load_id: loadId, route_id: routeId });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    // 9% fee on $1000 pay = $90 fee, $910 payout
    expect(res.body.platform_fee_usd).toBe(90);
    expect(res.body.trucker_payout_usd).toBe(910);
    bookingId = res.body.id;
  });

  test('9% fee is exactly 9 percent of pay', async () => {
    const res = await request(app).get(`/api/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${truckerToken}`);
    expect(res.status).toBe(200);
    const { pay_usd, platform_fee_usd, trucker_payout_usd } = res.body;
    expect(platform_fee_usd).toBeCloseTo(pay_usd * 0.09, 2);
    expect(trucker_payout_usd).toBeCloseTo(pay_usd * 0.91, 2);
  });

  test('GET /api/bookings/my returns bookings', async () => {
    const res = await request(app).get('/api/bookings/my').set('Authorization', `Bearer ${truckerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('shipper accepts the booking', async () => {
    const res = await request(app).put(`/api/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${shipperToken}`)
      .send({ status: 'accepted' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('accepted');
  });

  test('trucker marks booking as completed — fee finalised', async () => {
    const res = await request(app).put(`/api/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${truckerToken}`)
      .send({ status: 'completed' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
    // Fee is unchanged from creation (already locked in)
    expect(res.body.platform_fee_usd).toBe(90);
    expect(res.body.trucker_payout_usd).toBe(910);
  });

  test('load is marked completed after booking completes', async () => {
    const res = await request(app).get(`/api/loads/${loadId}`).set('Authorization', `Bearer ${shipperToken}`);
    expect(res.body.status).toBe('completed');
  });

  test('invalid transition is rejected', async () => {
    const res = await request(app).put(`/api/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${truckerToken}`)
      .send({ status: 'cancelled' });
    expect(res.status).toBe(409);
  });
});

// ── Reviews ────────────────────────────────────────────────────────────────────
describe('Reviews', () => {
  let truckerToken, shipperToken, completedBookingId, truckerId, shipperId;

  beforeAll(async () => {
    // Fresh users for clean state
    await register({ name: 'Rev Trucker', email: 'rev-truck@test.com', password: 'pass1234', role: 'trucker' });
    await register({ name: 'Rev Shipper', email: 'rev-ship@test.com',  password: 'pass1234', role: 'shipper' });
    truckerToken = await login('rev-truck@test.com', 'pass1234');
    shipperToken = await login('rev-ship@test.com',  'pass1234');

    const me1 = (await request(app).get('/api/users/' + (await request(app).post('/api/auth/login').send({ email: 'rev-truck@test.com', password: 'pass1234' })).body.user.id).set('Authorization', `Bearer ${truckerToken}`));
    truckerId = (await request(app).post('/api/auth/login').send({ email: 'rev-truck@test.com', password: 'pass1234' })).body.user.id;
    shipperId = (await request(app).post('/api/auth/login').send({ email: 'rev-ship@test.com',  password: 'pass1234' })).body.user.id;

    const loadRes = await request(app).post('/api/loads')
      .set('Authorization', `Bearer ${shipperToken}`)
      .send({ origin: 'Houston, TX', destination: 'Phoenix, AZ', freight_type: 'Flatbed', weight_lbs: 3000, pay_usd: 800 });
    const routeRes = await request(app).post('/api/routes')
      .set('Authorization', `Bearer ${truckerToken}`)
      .send({ origin: 'Houston, TX', destination: 'Phoenix, AZ', departure_date: '2026-06-01', route_type: 'deadmiles', avail_weight_lbs: 5000 });

    const bookRes = await request(app).post('/api/bookings')
      .set('Authorization', `Bearer ${truckerToken}`)
      .send({ load_id: loadRes.body.id, route_id: routeRes.body.id });
    completedBookingId = bookRes.body.id;

    await request(app).put(`/api/bookings/${completedBookingId}`)
      .set('Authorization', `Bearer ${shipperToken}`).send({ status: 'accepted' });
    await request(app).put(`/api/bookings/${completedBookingId}`)
      .set('Authorization', `Bearer ${truckerToken}`).send({ status: 'completed' });
  });

  test('trucker can leave a review for shipper', async () => {
    const res = await request(app).post('/api/reviews')
      .set('Authorization', `Bearer ${truckerToken}`)
      .send({ booking_id: completedBookingId, reviewee_id: shipperId, rating: 5, comment: 'Great shipper!' });
    expect(res.status).toBe(201);
    expect(res.body.rating).toBe(5);
  });

  test('cannot review same booking twice', async () => {
    const res = await request(app).post('/api/reviews')
      .set('Authorization', `Bearer ${truckerToken}`)
      .send({ booking_id: completedBookingId, reviewee_id: shipperId, rating: 4 });
    expect(res.status).toBe(409);
  });

  test('cannot leave review on non-completed booking', async () => {
    // post a new pending booking
    const loadRes = await request(app).post('/api/loads')
      .set('Authorization', `Bearer ${shipperToken}`)
      .send({ origin: 'A', destination: 'B', freight_type: 'X', weight_lbs: 100, pay_usd: 200 });
    const routeRes = await request(app).post('/api/routes')
      .set('Authorization', `Bearer ${truckerToken}`)
      .send({ origin: 'A', destination: 'B', departure_date: '2026-07-01', route_type: 'partial', avail_weight_lbs: 500 });
    const bookRes = await request(app).post('/api/bookings')
      .set('Authorization', `Bearer ${truckerToken}`)
      .send({ load_id: loadRes.body.id, route_id: routeRes.body.id });
    const res = await request(app).post('/api/reviews')
      .set('Authorization', `Bearer ${truckerToken}`)
      .send({ booking_id: bookRes.body.id, reviewee_id: shipperId, rating: 3 });
    expect(res.status).toBe(409);
  });

  test('GET /api/reviews/booking/:id returns reviews', async () => {
    const res = await request(app).get(`/api/reviews/booking/${completedBookingId}`)
      .set('Authorization', `Bearer ${truckerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });
});
