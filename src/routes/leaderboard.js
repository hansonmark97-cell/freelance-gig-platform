'use strict';

const { Router } = require('express');

function leaderboardRouter(db) {
  const router = Router();

  // GET /leaderboard — top managers by wins, then goals
  router.get('/', (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const rows = db.prepare(`
      SELECT id, username, team_name, wins, losses, draws, goals_scored,
             (wins * 3 + draws) AS points
      FROM managers
      ORDER BY points DESC, goals_scored DESC
      LIMIT ?
    `).all(limit);
    res.json(rows);
  });

  return router;
}

module.exports = leaderboardRouter;
