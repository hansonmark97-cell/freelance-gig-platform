'use strict';

const express = require('express');
const router = express.Router();
const { db } = require('../firebase');

const COLLECTION = 'users';
const VALID_ROLES = ['freelancer', 'client'];

// GET /api/users
router.get('/', async (_req, res) => {
  try {
    const snapshot = await db.collection(COLLECTION).get();
    const users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:id
router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection(COLLECTION).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'User not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users
router.post('/', async (req, res) => {
  try {
    const { name, email, role, bio = '', skills = [], hourlyRate = null } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({ error: 'name, email, and role are required' });
    }
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: 'role must be freelancer or client' });
    }

    const existing = await db.collection(COLLECTION).where('email', '==', email).get();
    if (!existing.empty) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const data = {
      name,
      email,
      role,
      bio,
      skills,
      hourlyRate,
      createdAt: new Date().toISOString(),
    };
    const ref = await db.collection(COLLECTION).add(data);
    res.status(201).json({ id: ref.id, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id
router.put('/:id', async (req, res) => {
  try {
    const docRef = db.collection(COLLECTION).doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'User not found' });

    const allowed = ['name', 'bio', 'skills', 'hourlyRate'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    await docRef.update(updates);
    const updated = await docRef.get();
    res.json({ id: updated.id, ...updated.data() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:id
router.delete('/:id', async (req, res) => {
  try {
    const doc = await db.collection(COLLECTION).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'User not found' });
    await db.collection(COLLECTION).doc(req.params.id).delete();
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
