process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/app');
const firestoreMock = require('./firestoreMock');

beforeEach(() => {
  firestoreMock.reset();
});

async function registerAndLogin(user) {
  const res = await request(app).post('/api/users/register').send(user);
  return { token: res.body.token, id: res.body.user.id };
}

describe('Document Verification API (Component 3)', () => {
  const carrier = { name: 'Carl Carrier', email: 'carl@example.com', password: 'pass456', role: 'carrier' };
  const driver = { name: 'Dave Driver', email: 'dave@example.com', password: 'pass789', role: 'driver' };
  const shipper = { name: 'Sam Shipper', email: 'sam@example.com', password: 'pass123', role: 'shipper' };

  test('POST /api/users/me/documents - carrier can submit all docs and gets verified instantly', async () => {
    const { token } = await registerAndLogin(carrier);
    const res = await request(app)
      .post('/api/users/me/documents')
      .set('Authorization', `Bearer ${token}`)
      .send({ insuranceUrl: 'https://example.com/insurance.pdf', mcNumber: 'MC-123456', dotNumber: 'DOT-987654' });

    expect(res.status).toBe(200);
    expect(res.body.documents.verificationStatus).toBe('verified');
    expect(res.body.documents.mcNumber).toBe('MC-123456');
    expect(res.body.documents.dotNumber).toBe('DOT-987654');
    expect(res.body.documents.insuranceUrl).toBe('https://example.com/insurance.pdf');
    expect(res.body.documents.verifiedAt).not.toBeNull();
    expect(res.body.documents.submittedAt).toBeDefined();
  });

  test('POST /api/users/me/documents - partial submission yields pending status', async () => {
    const { token } = await registerAndLogin(carrier);
    const res = await request(app)
      .post('/api/users/me/documents')
      .set('Authorization', `Bearer ${token}`)
      .send({ mcNumber: 'MC-123456' });

    expect(res.status).toBe(200);
    expect(res.body.documents.verificationStatus).toBe('pending');
    expect(res.body.documents.verifiedAt).toBeNull();
  });

  test('POST /api/users/me/documents - driver can submit docs', async () => {
    const { token } = await registerAndLogin(driver);
    const res = await request(app)
      .post('/api/users/me/documents')
      .set('Authorization', `Bearer ${token}`)
      .send({ insuranceUrl: 'https://example.com/ins.pdf', mcNumber: 'MC-111', dotNumber: 'DOT-222' });

    expect(res.status).toBe(200);
    expect(res.body.documents.verificationStatus).toBe('verified');
  });

  test('POST /api/users/me/documents - shipper cannot submit docs', async () => {
    const { token } = await registerAndLogin(shipper);
    const res = await request(app)
      .post('/api/users/me/documents')
      .set('Authorization', `Bearer ${token}`)
      .send({ mcNumber: 'MC-111' });

    expect(res.status).toBe(403);
  });

  test('POST /api/users/me/documents - no fields returns 400', async () => {
    const { token } = await registerAndLogin(carrier);
    const res = await request(app)
      .post('/api/users/me/documents')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  test('POST /api/users/me/documents - unauthenticated returns 401', async () => {
    const res = await request(app)
      .post('/api/users/me/documents')
      .send({ mcNumber: 'MC-111' });

    expect(res.status).toBe(401);
  });

  test('GET /api/users/me/documents - carrier can retrieve submitted docs', async () => {
    const { token } = await registerAndLogin(carrier);
    await request(app)
      .post('/api/users/me/documents')
      .set('Authorization', `Bearer ${token}`)
      .send({ insuranceUrl: 'https://example.com/ins.pdf', mcNumber: 'MC-123', dotNumber: 'DOT-456' });

    const res = await request(app)
      .get('/api/users/me/documents')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.documents.mcNumber).toBe('MC-123');
    expect(res.body.documents.verificationStatus).toBe('verified');
  });

  test('GET /api/users/me/documents - returns 404 when no docs submitted yet', async () => {
    const { token } = await registerAndLogin(carrier);
    const res = await request(app)
      .get('/api/users/me/documents')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  test('GET /api/users/me/documents - shipper cannot retrieve docs', async () => {
    const { token } = await registerAndLogin(shipper);
    const res = await request(app)
      .get('/api/users/me/documents')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});
