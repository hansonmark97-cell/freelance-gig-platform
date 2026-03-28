'use strict';

const { Router } = require('express');

// Coin cost per pack type
const PACK_COSTS = { standard: 500, premium: 1500, elite: 4000 };
// Number of players per pack
const PACK_SIZES = { standard: 5, premium: 8, elite: 12 };
// Rarity weights per pack (common/rare/epic/legendary)
const RARITY_WEIGHTS = {
  standard: [70, 25, 4, 1],
  premium:  [40, 40, 15, 5],
  elite:    [10, 40, 35, 15],
};

function weightedRarity(weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  const rarities = ['common', 'rare', 'epic', 'legendary'];
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return rarities[i];
  }
  return 'common';
}

function packRouter(db) {
  const router = Router();

  // GET /packs/types — pack types, costs, and rarity odds
  router.get('/types', (req, res) => {
    res.json(
      Object.entries(PACK_COSTS).map(([type, cost]) => ({
        type,
        cost_coins: cost,
        players: PACK_SIZES[type],
        rarity_odds: {
          common: RARITY_WEIGHTS[type][0],
          rare:   RARITY_WEIGHTS[type][1],
          epic:   RARITY_WEIGHTS[type][2],
          legendary: RARITY_WEIGHTS[type][3],
        },
      }))
    );
  });

  // POST /packs/open — spend coins to open a pack
  // Body: { manager_id, pack_type }
  router.post('/open', (req, res) => {
    const { manager_id, pack_type } = req.body || {};
    if (!manager_id || !pack_type) return res.status(400).json({ error: 'manager_id and pack_type required' });
    if (!PACK_COSTS[pack_type]) return res.status(400).json({ error: `pack_type must be one of: ${Object.keys(PACK_COSTS).join(', ')}` });

    const manager = db.prepare('SELECT * FROM managers WHERE id=?').get(manager_id);
    if (!manager) return res.status(404).json({ error: 'manager not found' });

    const cost = PACK_COSTS[pack_type];
    if (manager.coins < cost) return res.status(402).json({ error: `insufficient coins — need ${cost}, have ${manager.coins}` });

    const size = PACK_SIZES[pack_type];
    const weights = RARITY_WEIGHTS[pack_type];

    const openPack = db.transaction(() => {
      // Deduct coins
      db.prepare('UPDATE managers SET coins = coins - ? WHERE id=?').run(cost, manager_id);

      // Record pack opening
      const opening = db.prepare(
        `INSERT INTO pack_openings (manager_id, pack_type, coins_spent) VALUES (?,?,?) RETURNING *`
      ).get(manager_id, pack_type, cost);

      // Draw players
      const drawn = [];
      for (let i = 0; i < size; i++) {
        const rarity = weightedRarity(weights);
        const player = db.prepare(
          'SELECT * FROM players WHERE rarity=? ORDER BY RANDOM() LIMIT 1'
        ).get(rarity) || db.prepare('SELECT * FROM players ORDER BY RANDOM() LIMIT 1').get();
        if (!player) continue;

        const sp = db.prepare(
          `INSERT INTO squad_players (manager_id, player_id) VALUES (?,?) RETURNING *`
        ).get(manager_id, player.id);

        drawn.push({ ...player, squad_player_id: sp.id });
      }

      const updatedManager = db.prepare('SELECT * FROM managers WHERE id=?').get(manager_id);
      return { opening, players_drawn: drawn, manager: updatedManager };
    })();

    res.status(201).json(openPack);
  });

  return router;
}

module.exports = packRouter;
