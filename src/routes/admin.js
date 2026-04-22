const express = require('express');
const { db } = require('../firebase');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireRole('admin'));

// GET /users — list all users
router.get('/users', async (req, res) => {
  try {
    const snapshot = await db.collection('users').get();
    const users = snapshot.docs.map(d => {
      const { passwordHash, ...user } = d.data();
      return user;
    });
    return res.json(users);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /users/:id/role — update user role
router.put('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!role) return res.status(400).json({ error: 'role is required' });
    const validRoles = ['freelancer', 'client', 'shipper', 'carrier', 'driver', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${validRoles.join(', ')}` });
    }

    const doc = await db.collection('users').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'User not found' });

    await db.collection('users').doc(req.params.id).update({ role });
    const updated = await db.collection('users').doc(req.params.id).get();
    const { passwordHash, ...user } = updated.data();
    return res.json(user);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /loads — list all loads
router.get('/loads', async (req, res) => {
  try {
    const { status } = req.query;
    let query = db.collection('loads');
    if (status) query = query.where('status', '==', status);
    const snapshot = await query.get();
    return res.json(snapshot.docs.map(d => d.data()));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /shipments — list all shipments
router.get('/shipments', async (req, res) => {
  try {
    const { status } = req.query;
    let query = db.collection('shipments');
    if (status) query = query.where('status', '==', status);
    const snapshot = await query.get();
    return res.json(snapshot.docs.map(d => d.data()));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /invoices — list all invoices
router.get('/invoices', async (req, res) => {
  try {
    const { status } = req.query;
    let query = db.collection('invoices');
    if (status) query = query.where('status', '==', status);
    const snapshot = await query.get();
    return res.json(snapshot.docs.map(d => d.data()));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /stats — platform summary stats
router.get('/stats', async (req, res) => {
  try {
    const [usersSnap, loadsSnap, shipmentsSnap, invoicesSnap] = await Promise.all([
      db.collection('users').get(),
      db.collection('loads').get(),
      db.collection('shipments').get(),
      db.collection('invoices').get(),
    ]);

    const invoices = invoicesSnap.docs.map(d => d.data());
    const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.platformFeeUsd || 0), 0);

    return res.json({
      totalUsers: usersSnap.docs.length,
      totalLoads: loadsSnap.docs.length,
      totalShipments: shipmentsSnap.docs.length,
      totalInvoices: invoices.length,
      totalRevenueUsd: +totalRevenue.toFixed(2),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
