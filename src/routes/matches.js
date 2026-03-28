'use strict';

const { Router } = require('express');

const COINS_PER_WIN  = 200;
const COINS_PER_DRAW = 75;
const COINS_PER_LOSS = 25;

function calcSquadRating(db, managerId) {
  const row = db.prepare(`
    SELECT AVG(p.rating) AS avg_rating, COUNT(*) AS count
    FROM squad_players sp
    JOIN players p ON p.id = sp.player_id
    WHERE sp.manager_id = ? AND sp.in_squad = 1
  `).get(managerId);
  // Fall back to average of all owned players if no squad set
  if (!row || row.count === 0) {
    const fallback = db.prepare(`
      SELECT AVG(p.rating) AS avg_rating
      FROM squad_players sp JOIN players p ON p.id = sp.player_id
      WHERE sp.manager_id = ?
    `).get(managerId);
    return fallback?.avg_rating || 60;
  }
  return row.avg_rating;
}

function simGoals(rating, opponentRating) {
  // Higher rating = better chance of scoring
  const strength = rating / (rating + opponentRating);
  const baseGoals = Math.random() * 4; // 0–4 raw goals
  return Math.max(0, Math.round(baseGoals * strength * 1.6));
}

function matchesRouter(db) {
  const router = Router();

  // POST /matches — play a match (vs AI or another manager)
  // Body: { home_manager_id, away_manager_id? }
  // If no away_manager_id, match is vs AI (rating 72 baseline)
  router.post('/', (req, res) => {
    const { home_manager_id, away_manager_id } = req.body || {};
    if (!home_manager_id) return res.status(400).json({ error: 'home_manager_id required' });

    const homeManager = db.prepare('SELECT * FROM managers WHERE id=?').get(home_manager_id);
    if (!homeManager) return res.status(404).json({ error: 'home manager not found' });

    let awayManager = null;
    if (away_manager_id) {
      awayManager = db.prepare('SELECT * FROM managers WHERE id=?').get(away_manager_id);
      if (!awayManager) return res.status(404).json({ error: 'away manager not found' });
      if (away_manager_id === home_manager_id) return res.status(400).json({ error: 'cannot play against yourself' });
    }

    const homeRating = calcSquadRating(db, home_manager_id);
    const awayRating = awayManager ? calcSquadRating(db, away_manager_id) : 72;

    const homeGoals = simGoals(homeRating, awayRating);
    const awayGoals = simGoals(awayRating, homeRating);

    const result = homeGoals > awayGoals ? 'home_win' : homeGoals < awayGoals ? 'away_win' : 'draw';

    const coinsEarned = result === 'home_win' ? COINS_PER_WIN :
                        result === 'draw'      ? COINS_PER_DRAW : COINS_PER_LOSS;

    const playMatch = db.transaction(() => {
      const match = db.prepare(`
        INSERT INTO matches (home_manager_id, away_manager_id, home_goals, away_goals,
                             home_rating, away_rating, result, coins_earned)
        VALUES (?,?,?,?,?,?,?,?) RETURNING *
      `).get(home_manager_id, away_manager_id || null,
             homeGoals, awayGoals, homeRating, awayRating, result, coinsEarned);

      // Update home manager stats + award coins
      if (result === 'home_win') {
        db.prepare('UPDATE managers SET wins=wins+1, goals_scored=goals_scored+?, coins=coins+? WHERE id=?')
          .run(homeGoals, coinsEarned, home_manager_id);
      } else if (result === 'draw') {
        db.prepare('UPDATE managers SET draws=draws+1, goals_scored=goals_scored+?, coins=coins+? WHERE id=?')
          .run(homeGoals, coinsEarned, home_manager_id);
      } else {
        db.prepare('UPDATE managers SET losses=losses+1, goals_scored=goals_scored+?, coins=coins+? WHERE id=?')
          .run(homeGoals, coinsEarned, home_manager_id);
      }

      // Update away manager stats if human
      if (awayManager) {
        if (result === 'away_win') {
          db.prepare('UPDATE managers SET wins=wins+1, goals_scored=goals_scored+? WHERE id=?')
            .run(awayGoals, away_manager_id);
        } else if (result === 'draw') {
          db.prepare('UPDATE managers SET draws=draws+1, goals_scored=goals_scored+? WHERE id=?')
            .run(awayGoals, away_manager_id);
        } else {
          db.prepare('UPDATE managers SET losses=losses+1, goals_scored=goals_scored+? WHERE id=?')
            .run(awayGoals, away_manager_id);
        }
      }

      return match;
    })();

    const updatedHome = db.prepare('SELECT * FROM managers WHERE id=?').get(home_manager_id);
    res.status(201).json({ match: playMatch, home_manager: updatedHome });
  });

  // GET /matches — list recent matches (optional ?manager_id=)
  router.get('/', (req, res) => {
    const { manager_id } = req.query;
    let sql = `
      SELECT m.*,
             hm.username AS home_username, hm.team_name AS home_team,
             am.username AS away_username, am.team_name AS away_team
      FROM matches m
      JOIN managers hm ON hm.id = m.home_manager_id
      LEFT JOIN managers am ON am.id = m.away_manager_id
    `;
    const params = [];
    if (manager_id) {
      sql += ' WHERE m.home_manager_id=? OR m.away_manager_id=?';
      params.push(manager_id, manager_id);
    }
    sql += ' ORDER BY m.played_at DESC LIMIT 50';
    res.json(db.prepare(sql).all(...params));
  });

  // GET /matches/:id
  router.get('/:id', (req, res) => {
    const match = db.prepare(`
      SELECT m.*,
             hm.username AS home_username, hm.team_name AS home_team,
             am.username AS away_username, am.team_name AS away_team
      FROM matches m
      JOIN managers hm ON hm.id = m.home_manager_id
      LEFT JOIN managers am ON am.id = m.away_manager_id
      WHERE m.id=?
    `).get(req.params.id);
    if (!match) return res.status(404).json({ error: 'match not found' });
    res.json(match);
  });

  return router;
}

module.exports = matchesRouter;
