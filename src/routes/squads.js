'use strict';

const { Router } = require('express');

function squadsRouter(db) {
  const router = Router();

  // GET /managers/:managerId/squad — all owned players + squad status
  router.get('/:managerId/squad', (req, res) => {
    const manager = db.prepare('SELECT id FROM managers WHERE id=?').get(req.params.managerId);
    if (!manager) return res.status(404).json({ error: 'manager not found' });

    const rows = db.prepare(`
      SELECT sp.id AS squad_player_id, sp.in_squad, sp.squad_slot, sp.acquired_at,
             p.id AS player_id, p.name, p.position, p.nationality,
             p.rating, p.pace, p.shooting, p.passing, p.defending, p.rarity
      FROM squad_players sp
      JOIN players p ON p.id = sp.player_id
      WHERE sp.manager_id = ?
      ORDER BY sp.in_squad DESC, p.rating DESC
    `).all(req.params.managerId);
    res.json(rows);
  });

  // PUT /managers/:managerId/squad — set starting XI
  // Body: { slots: [ { squad_player_id, squad_slot } ] }  (up to 11 entries)
  router.put('/:managerId/squad', (req, res) => {
    const manager = db.prepare('SELECT id FROM managers WHERE id=?').get(req.params.managerId);
    if (!manager) return res.status(404).json({ error: 'manager not found' });

    const { slots } = req.body || {};
    if (!Array.isArray(slots)) return res.status(400).json({ error: 'slots array required' });
    if (slots.length > 11) return res.status(400).json({ error: 'max 11 players in squad' });

    const update = db.transaction(() => {
      // Clear existing squad
      db.prepare('UPDATE squad_players SET in_squad=0, squad_slot=NULL WHERE manager_id=?')
        .run(req.params.managerId);

      for (const { squad_player_id, squad_slot } of slots) {
        const sp = db.prepare(
          'SELECT id FROM squad_players WHERE id=? AND manager_id=?'
        ).get(squad_player_id, req.params.managerId);
        if (!sp) throw Object.assign(new Error(`squad_player ${squad_player_id} not owned`), { status: 400 });
        db.prepare('UPDATE squad_players SET in_squad=1, squad_slot=? WHERE id=?')
          .run(squad_slot ?? null, squad_player_id);
      }
    });

    try {
      update();
    } catch (e) {
      return res.status(e.status || 500).json({ error: e.message });
    }

    // Return updated squad
    const rows = db.prepare(`
      SELECT sp.id AS squad_player_id, sp.in_squad, sp.squad_slot, sp.acquired_at,
             p.id AS player_id, p.name, p.position, p.rating, p.rarity
      FROM squad_players sp JOIN players p ON p.id = sp.player_id
      WHERE sp.manager_id = ? ORDER BY sp.squad_slot ASC
    `).all(req.params.managerId);
    res.json(rows);
  });

  return router;
}

module.exports = squadsRouter;
