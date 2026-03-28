'use strict';

const { Router } = require('express');

function playersRouter(db) {
  const router = Router();

  // GET /players — list catalogue with optional filters
  router.get('/', (req, res) => {
    const { position, rarity, min_rating, max_rating } = req.query;
    let sql = 'SELECT * FROM players WHERE 1=1';
    const params = [];
    if (position) { sql += ' AND position=?'; params.push(position); }
    if (rarity)   { sql += ' AND rarity=?';   params.push(rarity); }
    if (min_rating) { sql += ' AND rating>=?'; params.push(Number(min_rating)); }
    if (max_rating) { sql += ' AND rating<=?'; params.push(Number(max_rating)); }
    sql += ' ORDER BY rating DESC';
    res.json(db.prepare(sql).all(...params));
  });

  // GET /players/:id
  router.get('/:id', (req, res) => {
    const player = db.prepare('SELECT * FROM players WHERE id=?').get(req.params.id);
    if (!player) return res.status(404).json({ error: 'player not found' });
    res.json(player);
  });

  return router;
}

module.exports = playersRouter;
