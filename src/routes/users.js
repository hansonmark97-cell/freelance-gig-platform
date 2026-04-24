const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { db } = require('../firebase');
const { authenticate } = require('../middleware/auth');
const { generateId } = require('../utils');
const { JWT_SECRET } = require('../config');

const router = express.Router();

// POST /register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'name, email, password, and role are required' });
    }
    if (!['freelancer', 'client', 'shipper', 'carrier', 'driver', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'role must be freelancer, client, shipper, carrier, driver, or admin' });
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

// POST /me/documents — submit insurance/MC/DOT documents for AI verification (Component 3)
// Simulates an AI document scanner (e.g. Google Cloud Vision) that verifies carrier credentials.
// All required fields present → instantly marked 'verified'; otherwise 'pending'.
router.post('/me/documents', authenticate, async (req, res) => {
  try {
    if (!['carrier', 'driver'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only carriers and drivers can submit verification documents' });
    }

    const { insuranceUrl, mcNumber, dotNumber } = req.body;
    if (!insuranceUrl && !mcNumber && !dotNumber) {
      return res.status(400).json({ error: 'At least one of insuranceUrl, mcNumber, or dotNumber is required' });
    }

    // AI verification stub: if all three fields are supplied, instantly verify
    const allPresent = !!(insuranceUrl && mcNumber && dotNumber);
    const verificationStatus = allPresent ? 'verified' : 'pending';
    const submittedAt = new Date().toISOString();

    const documents = {
      insuranceUrl: insuranceUrl || null,
      mcNumber: mcNumber || null,
      dotNumber: dotNumber || null,
      verificationStatus,
      submittedAt,
      verifiedAt: allPresent ? submittedAt : null,
    };

    await db.collection('users').doc(req.user.id).update({ documents });
    return res.status(200).json({ documents });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /me/documents — get current verification status (Component 3)
router.get('/me/documents', authenticate, async (req, res) => {
  try {
    if (!['carrier', 'driver'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only carriers and drivers can view verification documents' });
    }

    const doc = await db.collection('users').doc(req.user.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'User not found' });
    const { documents } = doc.data();
    if (!documents) return res.status(404).json({ error: 'No documents submitted yet' });
    return res.json({ documents });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
