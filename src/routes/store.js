'use strict';

const { Router } = require('express');

function storeRouter(db) {
  const router = Router();

  // GET /store/packs — list available coin packs (the things users buy)
  router.get('/packs', (req, res) => {
    const packs = db.prepare('SELECT * FROM coin_packs WHERE is_active=1 ORDER BY price_usd ASC').all();
    res.json(packs);
  });

  // POST /store/purchase — buy a coin pack (simulates payment; real impl adds a payment gateway)
  // Body: { manager_id, coin_pack_id }
  router.post('/purchase', (req, res) => {
    const { manager_id, coin_pack_id } = req.body || {};
    if (!manager_id || !coin_pack_id) return res.status(400).json({ error: 'manager_id and coin_pack_id required' });

    const manager = db.prepare('SELECT * FROM managers WHERE id=?').get(manager_id);
    if (!manager) return res.status(404).json({ error: 'manager not found' });

    const pack = db.prepare('SELECT * FROM coin_packs WHERE id=? AND is_active=1').get(coin_pack_id);
    if (!pack) return res.status(404).json({ error: 'coin pack not found' });

    const coins_awarded = Math.round(pack.coins * (1 + pack.bonus_pct / 100));

    const result = db.transaction(() => {
      const purchase = db.prepare(
        `INSERT INTO purchases (manager_id, coin_pack_id, coins_awarded, price_usd) VALUES (?,?,?,?) RETURNING *`
      ).get(manager_id, coin_pack_id, coins_awarded, pack.price_usd);

      db.prepare('UPDATE managers SET coins = coins + ? WHERE id=?').run(coins_awarded, manager_id);

      const updatedManager = db.prepare('SELECT * FROM managers WHERE id=?').get(manager_id);
      return { purchase, manager: updatedManager };
    })();

    res.status(201).json(result);
  });

  // GET /store/revenue — platform revenue dashboard
  router.get('/revenue', (req, res) => {
    const totals = db.prepare(`
      SELECT
        COUNT(*)          AS total_purchases,
        SUM(coins_awarded) AS total_coins_sold,
        SUM(price_usd)    AS total_revenue_usd,
        AVG(price_usd)    AS avg_purchase_usd
      FROM purchases
    `).get();

    const byPack = db.prepare(`
      SELECT cp.name, cp.price_usd AS pack_price,
             COUNT(p.id) AS times_purchased,
             SUM(p.price_usd) AS revenue_usd
      FROM purchases p
      JOIN coin_packs cp ON cp.id = p.coin_pack_id
      GROUP BY cp.id
      ORDER BY revenue_usd DESC
    `).all();

    const recentPurchases = db.prepare(`
      SELECT p.id, p.created_at, p.coins_awarded, p.price_usd,
             m.username, m.team_name, cp.name AS pack_name
      FROM purchases p
      JOIN managers m ON m.id = p.manager_id
      JOIN coin_packs cp ON cp.id = p.coin_pack_id
      ORDER BY p.created_at DESC LIMIT 20
    `).all();

    res.json({ totals, byPack, recentPurchases });
  });

  // GET /store/purchases/:managerId — a manager's purchase history
  router.get('/purchases/:managerId', (req, res) => {
    const manager = db.prepare('SELECT id FROM managers WHERE id=?').get(req.params.managerId);
    if (!manager) return res.status(404).json({ error: 'manager not found' });

    const rows = db.prepare(`
      SELECT p.*, cp.name AS pack_name
      FROM purchases p JOIN coin_packs cp ON cp.id = p.coin_pack_id
      WHERE p.manager_id = ? ORDER BY p.created_at DESC
    `).all(req.params.managerId);
    res.json(rows);
  });

  return router;
}

module.exports = storeRouter;
