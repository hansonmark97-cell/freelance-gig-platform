'use strict';

const { Router } = require('express');

function managersRouter(db) {
  const router = Router();

  // POST /managers — register a new manager
  router.post('/', (req, res) => {
    const { username, email, team_name } = req.body || {};
    if (!username || !email) return res.status(400).json({ error: 'username and email required' });

    try {
      const stmt = db.prepare(
        `INSERT INTO managers (username, email, team_name) VALUES (?,?,?) RETURNING *`
      );
      const manager = stmt.get(username, email, team_name || `${username}'s FC`);
      res.status(201).json(manager);
    } catch (e) {
      if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'username or email already exists' });
      throw e;
    }
  });

  // GET /managers — list all managers (leaderboard order: wins desc)
  router.get('/', (req, res) => {
    const rows = db.prepare(
      `SELECT id, username, team_name, coins, wins, losses, draws, goals_scored, created_at
       FROM managers ORDER BY wins DESC, goals_scored DESC`
    ).all();
    res.json(rows);
  });

  // GET /managers/:id
  router.get('/:id', (req, res) => {
    const manager = db.prepare('SELECT * FROM managers WHERE id=?').get(req.params.id);
    if (!manager) return res.status(404).json({ error: 'manager not found' });
    res.json(manager);
  });

  // PATCH /managers/:id — update team name
  router.patch('/:id', (req, res) => {
    const manager = db.prepare('SELECT * FROM managers WHERE id=?').get(req.params.id);
    if (!manager) return res.status(404).json({ error: 'manager not found' });
    const team_name = req.body?.team_name ?? manager.team_name;
    const updated = db.prepare(
      `UPDATE managers SET team_name=? WHERE id=? RETURNING *`
    ).get(team_name, req.params.id);
    res.json(updated);
  });

  return router;
}

module.exports = managersRouter;
