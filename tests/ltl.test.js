process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/app');
const firestoreMock = require('./firestoreMock');
const { MAX_DETOUR_MILES } = require('../src/constants');
const { haversineDistanceMiles, distanceToSegmentMiles } = require('../src/utils');

beforeEach(() => {
  firestoreMock.reset();
});

async function registerAndLogin(user) {
  const res = await request(app).post('/api/users/register').send(user);
  return res.body.token;
}

const shipper = { name: 'Sam Shipper', email: 'sam@example.com', password: 'pass123', role: 'shipper' };

// Memphis, TN  ≈ 35.15°N, -90.05°W
// Nashville, TN ≈ 36.17°N, -86.78°W
// Jackson, TN  ≈ 35.61°N, -88.81°W  (~midpoint on I-40, within 5 mi of route)
// Louisville, KY ≈ 38.25°N, -85.76°W (~80 mi north of Nashville, way off route)

describe('LTL "Extra Space" Matching (Component 1 & 4)', () => {
  test('GET /api/loads/ltl-matches - missing availableLengthFt returns 400', async () => {
    const res = await request(app).get('/api/loads/ltl-matches');
    expect(res.status).toBe(400);
  });

  test('GET /api/loads/ltl-matches - zero availableLengthFt returns 400', async () => {
    const res = await request(app).get('/api/loads/ltl-matches?availableLengthFt=0');
    expect(res.status).toBe(400);
  });

  test('GET /api/loads/ltl-matches - returns loads that fit in available space', async () => {
    const token = await registerAndLogin(shipper);

    // Load that fits (20 ft required, 23 ft available)
    await request(app).post('/api/loads').set('Authorization', `Bearer ${token}`).send({
      title: 'Small LTL Load', description: 'Pallets', origin: 'Memphis, TN', destination: 'Nashville, TN',
      weightLbs: 1000, budgetUsd: 300, requiredLengthFt: 20,
    });

    // Load that does NOT fit (30 ft required, only 23 available)
    await request(app).post('/api/loads').set('Authorization', `Bearer ${token}`).send({
      title: 'Big Load', description: 'Heavy equipment', origin: 'Memphis, TN', destination: 'Nashville, TN',
      weightLbs: 8000, budgetUsd: 1500, requiredLengthFt: 30,
    });

    // Load with no requiredLengthFt (not an LTL listing — excluded from results)
    await request(app).post('/api/loads').set('Authorization', `Bearer ${token}`).send({
      title: 'FTL Load', description: 'Full trailer', origin: 'A', destination: 'B',
      weightLbs: 20000, budgetUsd: 2000,
    });

    const res = await request(app).get('/api/loads/ltl-matches?availableLengthFt=23');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].title).toBe('Small LTL Load');
  });

  test('GET /api/loads/ltl-matches - exact fit is included', async () => {
    const token = await registerAndLogin(shipper);
    await request(app).post('/api/loads').set('Authorization', `Bearer ${token}`).send({
      title: 'Exact Fit', description: 'Desc', origin: 'A', destination: 'B',
      weightLbs: 500, budgetUsd: 200, requiredLengthFt: 23,
    });
    const res = await request(app).get('/api/loads/ltl-matches?availableLengthFt=23');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });

  test('GET /api/loads/ltl-matches - only open loads returned', async () => {
    const token = await registerAndLogin(shipper);
    const created = (await request(app).post('/api/loads').set('Authorization', `Bearer ${token}`).send({
      title: 'Soon Cancelled', description: 'Desc', origin: 'A', destination: 'B',
      weightLbs: 500, budgetUsd: 200, requiredLengthFt: 10,
    })).body;

    await request(app).delete(`/api/loads/${created.id}`).set('Authorization', `Bearer ${token}`);

    const res = await request(app).get('/api/loads/ltl-matches?availableLengthFt=53');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(0);
  });

  test('GET /api/loads/ltl-matches - GPS route filter keeps loads within detour', async () => {
    const token = await registerAndLogin(shipper);

    // Load whose pickup is near the Memphis→Nashville route (midpoint, ~0 miles off segment)
    // Midpoint of Memphis (35.1495, -90.0490) → Nashville (36.1627, -86.7816) ≈ (35.6561, -88.4153)
    // Place load 2 miles north of midpoint — well within the 5-mile detour threshold
    await request(app).post('/api/loads').set('Authorization', `Bearer ${token}`).send({
      title: 'On-Route Load', description: 'Desc', origin: 'Near Route, TN', destination: 'Nashville, TN',
      weightLbs: 500, budgetUsd: 300, requiredLengthFt: 10,
      originLat: 35.685, originLng: -88.415,
    });

    // Load whose pickup is far off-route (Louisville, KY — ~80 mi north of Nashville)
    await request(app).post('/api/loads').set('Authorization', `Bearer ${token}`).send({
      title: 'Off-Route Load', description: 'Desc', origin: 'Louisville, KY', destination: 'Nashville, TN',
      weightLbs: 500, budgetUsd: 300, requiredLengthFt: 10,
      originLat: 38.2527, originLng: -85.7585,
    });

    // Driver route: Memphis (35.1495, -90.0490) → Nashville (36.1627, -86.7816)
    const res = await request(app).get(
      '/api/loads/ltl-matches?availableLengthFt=53&originLat=35.1495&originLng=-90.0490&destLat=36.1627&destLng=-86.7816'
    );
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].title).toBe('On-Route Load');
  });

  test('GET /api/loads/ltl-matches - loads without coords included when driver coords given', async () => {
    const token = await registerAndLogin(shipper);

    // Load with no coordinates
    await request(app).post('/api/loads').set('Authorization', `Bearer ${token}`).send({
      title: 'No Coords Load', description: 'Desc', origin: 'Somewhere, TN', destination: 'Nashville, TN',
      weightLbs: 500, budgetUsd: 300, requiredLengthFt: 10,
    });

    const res = await request(app).get(
      '/api/loads/ltl-matches?availableLengthFt=53&originLat=35.1495&originLng=-90.0490&destLat=36.1627&destLng=-86.7816'
    );
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].title).toBe('No Coords Load');
  });
});

describe('Utility functions', () => {
  test('haversineDistanceMiles - same point is 0', () => {
    expect(haversineDistanceMiles(35.15, -90.05, 35.15, -90.05)).toBeCloseTo(0, 5);
  });

  test('haversineDistanceMiles - Memphis to Nashville ~210 miles', () => {
    const dist = haversineDistanceMiles(35.1495, -90.049, 36.1627, -86.7816);
    expect(dist).toBeGreaterThan(180);
    expect(dist).toBeLessThan(230);
  });

  test('distanceToSegmentMiles - point on segment is ~0', () => {
    // Midpoint of Memphis→Nashville
    const midLat = (35.1495 + 36.1627) / 2;
    const midLng = (-90.049 + -86.7816) / 2;
    const dist = distanceToSegmentMiles(midLat, midLng, 35.1495, -90.049, 36.1627, -86.7816);
    expect(dist).toBeLessThan(1);
  });

  test('distanceToSegmentMiles - off-route point Louisville is well beyond MAX_DETOUR_MILES', () => {
    // Louisville, KY is ~80 miles north of Nashville — far off the Memphis→Nashville route
    const dist = distanceToSegmentMiles(38.2527, -85.7585, 35.1495, -90.049, 36.1627, -86.7816);
    expect(dist).toBeGreaterThan(MAX_DETOUR_MILES);
  });

  test('MAX_DETOUR_MILES is 5', () => {
    expect(MAX_DETOUR_MILES).toBe(5);
  });
});
