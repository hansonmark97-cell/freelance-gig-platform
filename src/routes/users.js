const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../database');

const router = express.Router();

// POST /api/users/login - must be before /:id
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const { password_hash, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    next(err);
  }
});

// POST /api/users
router.post('/', async (req, res, next) => {
  const { username, email, password, role, bio, hourly_rate } = req.body;
  if (!username || !email || !password || !role) {
    return res.status(400).json({ error: 'username, email, password, and role are required' });
  }
  if (!['freelancer', 'client'].includes(role)) {
    return res.status(400).json({ error: 'role must be freelancer or client' });
  }
  try {
    const password_hash = await bcrypt.hash(password, 10);
    const stmt = db.prepare(
      'INSERT INTO users (username, email, password_hash, role, bio, hourly_rate) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(username, email, password_hash, role, bio || null, hourly_rate || null);
    const user = db.prepare('SELECT id, username, email, role, bio, hourly_rate, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(user);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }
    next(err);
  }
});

// GET /api/users
router.get('/', (req, res) => {
  const users = db.prepare('SELECT id, username, email, role, bio, hourly_rate, created_at FROM users').all();
  res.json(users);
});

// GET /api/users/:id
router.get('/:id', (req, res) => {
  const user = db.prepare('SELECT id, username, email, role, bio, hourly_rate, created_at FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// PUT /api/users/:id
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'User not found' });

  const { username, email, bio, hourly_rate } = req.body;
  const updatedUsername = username !== undefined ? username : existing.username;
  const updatedEmail = email !== undefined ? email : existing.email;
  const updatedBio = bio !== undefined ? bio : existing.bio;
  const updatedHourlyRate = hourly_rate !== undefined ? hourly_rate : existing.hourly_rate;

  try {
    db.prepare(
      'UPDATE users SET username = ?, email = ?, bio = ?, hourly_rate = ? WHERE id = ?'
    ).run(updatedUsername, updatedEmail, updatedBio, updatedHourlyRate, req.params.id);
    const user = db.prepare('SELECT id, username, email, role, bio, hourly_rate, created_at FROM users WHERE id = ?').get(req.params.id);
    res.json(user);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }
    throw err;
  }
});

// DELETE /api/users/:id
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'User not found' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

module.exports = router;
