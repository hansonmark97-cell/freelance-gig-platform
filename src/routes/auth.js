'use strict';

const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const { getDb } = require('../database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'trucker-secret-key';
const SALT_ROUNDS = 10;

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, role, phone, company } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'name, email, password, and role are required' });
    }
    if (!['trucker', 'shipper'].includes(role)) {
      return res.status(400).json({ error: 'role must be trucker or shipper' });
    }
    const db   = getDb();
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const stmt = db.prepare(
      'INSERT INTO users (name, email, password, role, phone, company) VALUES (?,?,?,?,?,?)'
    );
    let result;
    try {
      result = stmt.run(name, email, hash, role, phone || null, company || null);
    } catch (e) {
      if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email already registered' });
      throw e;
    }
    const user  = db.prepare('SELECT id, name, email, role, phone, company, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ user, token });
  } catch (err) { next(err); }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
    const db   = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match)  return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    const { password: _pw, ...safeUser } = user;
    res.json({ user: safeUser, token });
  } catch (err) { next(err); }
});

module.exports = router;
