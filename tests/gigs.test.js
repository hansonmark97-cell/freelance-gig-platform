process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/app');
const firestoreMock = require('./firestoreMock');

beforeEach(() => {
  firestoreMock.reset();
});

async function registerAndLogin(user) {
  const res = await request(app).post('/api/users/register').send(user);
  return res.body.token;
}

describe('Gigs API', () => {
  const freelancer = { name: 'Fred', email: 'fred@example.com', password: 'pass123', role: 'freelancer' };
  const client = { name: 'Carol', email: 'carol@example.com', password: 'pass456', role: 'client' };

  test('POST /api/gigs - freelancer can create gig', async () => {
    const token = await registerAndLogin(freelancer);
    const res = await request(app).post('/api/gigs').set('Authorization', `Bearer ${token}`).send({
      title: 'Logo Design',
      description: 'I design logos',
      category: 'design',
      priceUsd: 100,
      deliveryDays: 3,
    });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Logo Design');
    expect(res.body.status).toBe('active');
  });

  test('POST /api/gigs - client cannot create gig', async () => {
    const token = await registerAndLogin(client);
    const res = await request(app).post('/api/gigs').set('Authorization', `Bearer ${token}`).send({
      title: 'Logo Design',
      description: 'I design logos',
      category: 'design',
      priceUsd: 100,
      deliveryDays: 3,
    });
    expect(res.status).toBe(403);
  });

  test('POST /api/gigs - missing fields returns 400', async () => {
    const token = await registerAndLogin(freelancer);
    const res = await request(app).post('/api/gigs').set('Authorization', `Bearer ${token}`).send({ title: 'Only title' });
    expect(res.status).toBe(400);
  });

  test('GET /api/gigs - list active gigs', async () => {
    const token = await registerAndLogin(freelancer);
    await request(app).post('/api/gigs').set('Authorization', `Bearer ${token}`).send({
      title: 'Gig 1', description: 'desc', category: 'design', priceUsd: 50, deliveryDays: 2,
    });
    await request(app).post('/api/gigs').set('Authorization', `Bearer ${token}`).send({
      title: 'Gig 2', description: 'desc', category: 'writing', priceUsd: 80, deliveryDays: 5,
    });

    const res = await request(app).get('/api/gigs');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  test('GET /api/gigs - filter by category', async () => {
    const token = await registerAndLogin(freelancer);
    await request(app).post('/api/gigs').set('Authorization', `Bearer ${token}`).send({
      title: 'Gig 1', description: 'desc', category: 'design', priceUsd: 50, deliveryDays: 2,
    });
    await request(app).post('/api/gigs').set('Authorization', `Bearer ${token}`).send({
      title: 'Gig 2', description: 'desc', category: 'writing', priceUsd: 80, deliveryDays: 5,
    });

    const res = await request(app).get('/api/gigs?category=design');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].category).toBe('design');
  });

  test('GET /api/gigs - filter by price range', async () => {
    const token = await registerAndLogin(freelancer);
    await request(app).post('/api/gigs').set('Authorization', `Bearer ${token}`).send({
      title: 'Cheap Gig', description: 'desc', category: 'design', priceUsd: 20, deliveryDays: 2,
    });
    await request(app).post('/api/gigs').set('Authorization', `Bearer ${token}`).send({
      title: 'Expensive Gig', description: 'desc', category: 'design', priceUsd: 200, deliveryDays: 5,
    });

    const res = await request(app).get('/api/gigs?minPrice=50&maxPrice=250');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].title).toBe('Expensive Gig');
  });

  test('GET /api/gigs/:id - get single gig', async () => {
    const token = await registerAndLogin(freelancer);
    const created = await request(app).post('/api/gigs').set('Authorization', `Bearer ${token}`).send({
      title: 'My Gig', description: 'desc', category: 'dev', priceUsd: 150, deliveryDays: 7,
    });
    const id = created.body.id;
    const res = await request(app).get(`/api/gigs/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
  });

  test('GET /api/gigs/:id - not found returns 404', async () => {
    const res = await request(app).get('/api/gigs/nonexistent');
    expect(res.status).toBe(404);
  });

  test('PUT /api/gigs/:id - owner can update gig', async () => {
    const token = await registerAndLogin(freelancer);
    const created = await request(app).post('/api/gigs').set('Authorization', `Bearer ${token}`).send({
      title: 'Old Title', description: 'desc', category: 'dev', priceUsd: 100, deliveryDays: 3,
    });
    const id = created.body.id;
    const res = await request(app).put(`/api/gigs/${id}`).set('Authorization', `Bearer ${token}`).send({ title: 'New Title', priceUsd: 200 });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New Title');
    expect(res.body.priceUsd).toBe(200);
  });

  test('PUT /api/gigs/:id - non-owner cannot update gig', async () => {
    const ownerToken = await registerAndLogin(freelancer);
    const otherToken = await registerAndLogin({ name: 'Other', email: 'other@example.com', password: 'pass', role: 'freelancer' });
    const created = await request(app).post('/api/gigs').set('Authorization', `Bearer ${ownerToken}`).send({
      title: 'My Gig', description: 'desc', category: 'dev', priceUsd: 100, deliveryDays: 3,
    });
    const id = created.body.id;
    const res = await request(app).put(`/api/gigs/${id}`).set('Authorization', `Bearer ${otherToken}`).send({ title: 'Hijacked' });
    expect(res.status).toBe(403);
  });

  test('DELETE /api/gigs/:id - owner can delete (soft)', async () => {
    const token = await registerAndLogin(freelancer);
    const created = await request(app).post('/api/gigs').set('Authorization', `Bearer ${token}`).send({
      title: 'My Gig', description: 'desc', category: 'dev', priceUsd: 100, deliveryDays: 3,
    });
    const id = created.body.id;
    const res = await request(app).delete(`/api/gigs/${id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const check = await request(app).get(`/api/gigs/${id}`);
    expect(check.body.status).toBe('deleted');
  });

  test('DELETE /api/gigs/:id - non-owner cannot delete', async () => {
    const ownerToken = await registerAndLogin(freelancer);
    const otherToken = await registerAndLogin({ name: 'Other2', email: 'other2@example.com', password: 'pass', role: 'freelancer' });
    const created = await request(app).post('/api/gigs').set('Authorization', `Bearer ${ownerToken}`).send({
      title: 'My Gig', description: 'desc', category: 'dev', priceUsd: 100, deliveryDays: 3,
    });
    const id = created.body.id;
    const res = await request(app).delete(`/api/gigs/${id}`).set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
  });

  test('GET /api/gigs - search by title keyword', async () => {
    const token = await registerAndLogin(freelancer);
    await request(app).post('/api/gigs').set('Authorization', `Bearer ${token}`).send({
      title: 'Logo Design Pro', description: 'I make logos', category: 'design', priceUsd: 50, deliveryDays: 2,
    });
    await request(app).post('/api/gigs').set('Authorization', `Bearer ${token}`).send({
      title: 'React Development', description: 'Frontend work', category: 'dev', priceUsd: 200, deliveryDays: 5,
    });

    const res = await request(app).get('/api/gigs?search=logo');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].title).toBe('Logo Design Pro');
  });

  test('GET /api/gigs - search by description keyword', async () => {
    const token = await registerAndLogin(freelancer);
    await request(app).post('/api/gigs').set('Authorization', `Bearer ${token}`).send({
      title: 'Gig A', description: 'Expert in Photoshop editing', category: 'design', priceUsd: 50, deliveryDays: 2,
    });
    await request(app).post('/api/gigs').set('Authorization', `Bearer ${token}`).send({
      title: 'Gig B', description: 'Node.js backend developer', category: 'dev', priceUsd: 100, deliveryDays: 3,
    });

    const res = await request(app).get('/api/gigs?search=photoshop');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].description).toContain('Photoshop');
  });

  test('GET /api/gigs - search with no matches returns empty array', async () => {
    const token = await registerAndLogin(freelancer);
    await request(app).post('/api/gigs').set('Authorization', `Bearer ${token}`).send({
      title: 'Logo Design', description: 'I make logos', category: 'design', priceUsd: 50, deliveryDays: 2,
    });

    const res = await request(app).get('/api/gigs?search=blockchain');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(0);
  });

  test('GET /api/gigs - pagination slices results and sets headers', async () => {
    const token = await registerAndLogin(freelancer);
    for (let i = 1; i <= 5; i++) {
      await request(app).post('/api/gigs').set('Authorization', `Bearer ${token}`).send({
        title: `Gig ${i}`, description: 'desc', category: 'design', priceUsd: 50, deliveryDays: 2,
      });
    }

    const res = await request(app).get('/api/gigs?page=1&limit=2');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.headers['x-total-count']).toBe('5');
    expect(res.headers['x-page']).toBe('1');
    expect(res.headers['x-limit']).toBe('2');
  });

  test('GET /api/gigs - page 2 returns next slice', async () => {
    const token = await registerAndLogin(freelancer);
    for (let i = 1; i <= 5; i++) {
      await request(app).post('/api/gigs').set('Authorization', `Bearer ${token}`).send({
        title: `Gig ${i}`, description: 'desc', category: 'design', priceUsd: 50, deliveryDays: 2,
      });
    }

    const res = await request(app).get('/api/gigs?page=2&limit=2');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.headers['x-total-count']).toBe('5');
  });

  test('GET /api/gigs - X-Total-Count set even without pagination params', async () => {
    const token = await registerAndLogin(freelancer);
    await request(app).post('/api/gigs').set('Authorization', `Bearer ${token}`).send({
      title: 'A Gig', description: 'desc', category: 'design', priceUsd: 50, deliveryDays: 2,
    });

    const res = await request(app).get('/api/gigs');
    expect(res.status).toBe(200);
    expect(res.headers['x-total-count']).toBe('1');
  });
});
