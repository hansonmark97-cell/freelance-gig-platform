const express = require('express');
const { db } = require('../firebase');
const { authenticate } = require('../middleware/auth');
const { generateId } = require('../utils');

const router = express.Router();

// POST / — send a message to another user (authenticated)
router.post('/', authenticate, async (req, res) => {
  try {
    const { recipientId, body } = req.body;
    if (!recipientId || !body) {
      return res.status(400).json({ error: 'recipientId and body are required' });
    }
    if (recipientId === req.user.id) {
      return res.status(400).json({ error: 'Cannot send a message to yourself' });
    }

    const recipientDoc = await db.collection('users').doc(recipientId).get();
    if (!recipientDoc.exists) return res.status(404).json({ error: 'Recipient not found' });

    const id = generateId();
    const createdAt = new Date().toISOString();
    const message = {
      id,
      senderId: req.user.id,
      recipientId,
      body,
      read: false,
      createdAt,
    };

    await db.collection('messages').doc(id).set(message);
    return res.status(201).json(message);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /inbox — messages received by the current user (newest first)
router.get('/inbox', authenticate, async (req, res) => {
  try {
    const snapshot = await db.collection('messages')
      .where('recipientId', '==', req.user.id)
      .orderBy('createdAt', 'desc')
      .get();
    const messages = snapshot.docs.map(d => d.data());
    return res.json(messages);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /sent — messages sent by the current user (newest first)
router.get('/sent', authenticate, async (req, res) => {
  try {
    const snapshot = await db.collection('messages')
      .where('senderId', '==', req.user.id)
      .orderBy('createdAt', 'desc')
      .get();
    const messages = snapshot.docs.map(d => d.data());
    return res.json(messages);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /conversation/:otherId — full thread between current user and another user (oldest first)
router.get('/conversation/:otherId', authenticate, async (req, res) => {
  try {
    const otherId = req.params.otherId;
    const myId = req.user.id;

    const [sentSnap, receivedSnap] = await Promise.all([
      db.collection('messages').where('senderId', '==', myId).where('recipientId', '==', otherId).get(),
      db.collection('messages').where('senderId', '==', otherId).where('recipientId', '==', myId).get(),
    ]);

    const messages = [
      ...sentSnap.docs.map(d => d.data()),
      ...receivedSnap.docs.map(d => d.data()),
    ].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

    return res.json(messages);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /:id/read — mark a received message as read
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    const doc = await db.collection('messages').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Message not found' });
    const message = doc.data();
    if (message.recipientId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await db.collection('messages').doc(req.params.id).update({ read: true });
    const updated = await db.collection('messages').doc(req.params.id).get();
    return res.json(updated.data());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
