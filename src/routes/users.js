const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { db } = require('../firebase');
const { authenticate } = require('../middleware/auth');
const { generateId } = require('../utils');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// POST /register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'name, email, password, and role are required' });
    }
    if (!['freelancer', 'client'].includes(role)) {
      return res.status(400).json({ error: 'role must be freelancer or client' });
    }

    // Check duplicate email
    const existing = await db.collection('users').where('email', '==', email).get();
    if (!existing.empty) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = generateId();
    const createdAt = new Date().toISOString();
    const user = { id, name, email, passwordHash, role, createdAt };

    await db.collection('users').doc(id).set(user);

    const token = jwt.sign({ id, email, role }, JWT_SECRET, { expiresIn: '7d' });
    return res.status(201).json({ token, user: { id, name, email, role, createdAt } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const snapshot = await db.collection('users').where('email', '==', email).get();
    if (snapshot.empty) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const userDoc = snapshot.docs[0];
    const user = userDoc.data();

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /me
router.get('/me', authenticate, async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.user.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'User not found' });
    const user = doc.data();
    const { passwordHash, ...profile } = user;
    return res.json(profile);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /me
router.put('/me', authenticate, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    await db.collection('users').doc(req.user.id).update({ name });
    const doc = await db.collection('users').doc(req.user.id).get();
    const user = doc.data();
    const { passwordHash, ...profile } = user;
    return res.json(profile);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
