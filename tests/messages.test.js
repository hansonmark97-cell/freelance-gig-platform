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

describe('Messages API', () => {
  const sender = { name: 'Alice', email: 'alice@example.com', password: 'pass123', role: 'freelancer' };
  const recipient = { name: 'Bob', email: 'bob@example.com', password: 'pass456', role: 'client' };

  test('POST /api/messages - send a message', async () => {
    const { token: senderToken } = await registerAndLogin(sender);
    const { id: recipientId } = await registerAndLogin(recipient);

    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ recipientId, body: 'Hello, I am interested in your job!' });

    expect(res.status).toBe(201);
    expect(res.body.body).toBe('Hello, I am interested in your job!');
    expect(res.body.recipientId).toBe(recipientId);
    expect(res.body.read).toBe(false);
  });

  test('POST /api/messages - missing fields returns 400', async () => {
    const { token } = await registerAndLogin(sender);
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ body: 'No recipient' });
    expect(res.status).toBe(400);
  });

  test('POST /api/messages - cannot message yourself', async () => {
    const { token, id } = await registerAndLogin(sender);
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ recipientId: id, body: 'Talking to myself' });
    expect(res.status).toBe(400);
  });

  test('POST /api/messages - recipient not found returns 404', async () => {
    const { token } = await registerAndLogin(sender);
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ recipientId: 'nonexistent', body: 'Hello?' });
    expect(res.status).toBe(404);
  });

  test('POST /api/messages - without auth returns 401', async () => {
    const { id: recipientId } = await registerAndLogin(recipient);
    const res = await request(app)
      .post('/api/messages')
      .send({ recipientId, body: 'No auth' });
    expect(res.status).toBe(401);
  });

  test('GET /api/messages/inbox - returns received messages newest first', async () => {
    const { token: senderToken } = await registerAndLogin(sender);
    const { token: recipientToken, id: recipientId } = await registerAndLogin(recipient);

    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ recipientId, body: 'First message' });
    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ recipientId, body: 'Second message' });

    const res = await request(app)
      .get('/api/messages/inbox')
      .set('Authorization', `Bearer ${recipientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    // All messages should be addressed to the recipient
    expect(res.body.every(m => m.recipientId === recipientId)).toBe(true);
  });

  test('GET /api/messages/inbox - empty for user with no messages', async () => {
    const { token } = await registerAndLogin(sender);
    const res = await request(app)
      .get('/api/messages/inbox')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(0);
  });

  test('GET /api/messages/sent - returns sent messages', async () => {
    const { token: senderToken, id: senderId } = await registerAndLogin(sender);
    const { id: recipientId } = await registerAndLogin(recipient);

    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ recipientId, body: 'Hello from sender' });

    const res = await request(app)
      .get('/api/messages/sent')
      .set('Authorization', `Bearer ${senderToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].senderId).toBe(senderId);
  });

  test('GET /api/messages/conversation/:otherId - returns thread in order', async () => {
    const { token: senderToken, id: senderId } = await registerAndLogin(sender);
    const { token: recipientToken, id: recipientId } = await registerAndLogin(recipient);

    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ recipientId, body: 'Hi!' });
    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${recipientToken}`)
      .send({ recipientId: senderId, body: 'Hey back!' });
    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ recipientId, body: 'Interested in your project.' });

    const res = await request(app)
      .get(`/api/messages/conversation/${recipientId}`)
      .set('Authorization', `Bearer ${senderToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(3);
    // Messages sorted oldest to newest
    expect(res.body[0].body).toBe('Hi!');
    expect(res.body[1].body).toBe('Hey back!');
    expect(res.body[2].body).toBe('Interested in your project.');
  });

  test('GET /api/messages/conversation/:otherId - only shows own conversation', async () => {
    const { token: senderToken, id: senderId } = await registerAndLogin(sender);
    const { token: recipientToken, id: recipientId } = await registerAndLogin(recipient);
    const { token: thirdToken, id: thirdId } = await registerAndLogin({
      name: 'Third', email: 'third@example.com', password: 'pass', role: 'client',
    });

    // sender -> recipient
    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ recipientId, body: 'Message to Bob' });

    // sender -> third (should NOT appear in sender<->recipient conversation)
    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ recipientId: thirdId, body: 'Message to Third' });

    const res = await request(app)
      .get(`/api/messages/conversation/${recipientId}`)
      .set('Authorization', `Bearer ${senderToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].body).toBe('Message to Bob');
  });

  test('PUT /api/messages/:id/read - recipient can mark message as read', async () => {
    const { token: senderToken } = await registerAndLogin(sender);
    const { token: recipientToken, id: recipientId } = await registerAndLogin(recipient);

    const sendRes = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ recipientId, body: 'Please read this' });
    const msgId = sendRes.body.id;

    const res = await request(app)
      .put(`/api/messages/${msgId}/read`)
      .set('Authorization', `Bearer ${recipientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.read).toBe(true);
  });

  test('PUT /api/messages/:id/read - sender cannot mark as read', async () => {
    const { token: senderToken } = await registerAndLogin(sender);
    const { id: recipientId } = await registerAndLogin(recipient);

    const sendRes = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ recipientId, body: 'A message' });
    const msgId = sendRes.body.id;

    const res = await request(app)
      .put(`/api/messages/${msgId}/read`)
      .set('Authorization', `Bearer ${senderToken}`);

    expect(res.status).toBe(403);
  });

  test('PUT /api/messages/:id/read - not found returns 404', async () => {
    const { token } = await registerAndLogin(sender);
    const res = await request(app)
      .put('/api/messages/nonexistent/read')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
