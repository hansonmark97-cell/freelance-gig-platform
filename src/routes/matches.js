'use strict';

const express = require('express');
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/matches
 * Find active trucker routes whose origin/destination overlap with open loads.
 * Query params:
 *   load_id   — find matching routes for a specific load
 *   route_id  — find matching loads for a specific route
 *
 * Matching logic: case-insensitive substring match on origin + destination.
 */
router.get('/', authenticate, (req, res, next) => {
  try {
    const db             = getDb();
    const { load_id, route_id } = req.query;

    if (load_id) {
      const load = db.prepare('SELECT * FROM loads WHERE id = ? AND status = ?').get(load_id, 'open');
      if (!load) return res.status(404).json({ error: 'Open load not found' });

      const routes = db.prepare(`
        SELECT r.*, u.name AS trucker_name
        FROM routes r
        JOIN users u ON u.id = r.trucker_id
        WHERE r.status = 'active'
          AND r.avail_weight_lbs >= ?
          AND (LOWER(r.origin)      LIKE '%' || LOWER(?) || '%'
               OR LOWER(?) LIKE '%' || LOWER(r.origin) || '%')
          AND (LOWER(r.destination) LIKE '%' || LOWER(?) || '%'
               OR LOWER(?) LIKE '%' || LOWER(r.destination) || '%')
        ORDER BY r.departure_date ASC
      `).all(load.weight_lbs,
             load.origin,      load.origin,
             load.destination, load.destination);

      return res.json({ load, matching_routes: routes });
    }

    if (route_id) {
      const route = db.prepare('SELECT * FROM routes WHERE id = ? AND status = ?').get(route_id, 'active');
      if (!route) return res.status(404).json({ error: 'Active route not found' });

      const loads = db.prepare(`
        SELECT l.*, u.name AS shipper_name
        FROM loads l
        JOIN users u ON u.id = l.shipper_id
        WHERE l.status = 'open'
          AND l.weight_lbs <= ?
          AND (LOWER(l.origin)      LIKE '%' || LOWER(?) || '%'
               OR LOWER(?) LIKE '%' || LOWER(l.origin) || '%')
          AND (LOWER(l.destination) LIKE '%' || LOWER(?) || '%'
               OR LOWER(?) LIKE '%' || LOWER(l.destination) || '%')
        ORDER BY l.pay_usd DESC
      `).all(route.avail_weight_lbs,
             route.origin,      route.origin,
             route.destination, route.destination);

      return res.json({ route, matching_loads: loads });
    }

    // No filter: return a summary of all potential matches
    const matches = db.prepare(`
      SELECT
        l.id        AS load_id,
        l.origin    AS load_origin,
        l.destination AS load_destination,
        l.freight_type,
        l.weight_lbs,
        l.pay_usd,
        r.id        AS route_id,
        r.origin    AS route_origin,
        r.destination AS route_destination,
        r.route_type,
        r.avail_weight_lbs,
        r.departure_date,
        ul.name     AS shipper_name,
        ur.name     AS trucker_name
      FROM loads  l
      JOIN routes r ON (
        r.status = 'active'
        AND l.status = 'open'
        AND r.avail_weight_lbs >= l.weight_lbs
        AND (LOWER(r.origin)      LIKE '%' || LOWER(l.origin) || '%'
             OR LOWER(l.origin)   LIKE '%' || LOWER(r.origin) || '%')
        AND (LOWER(r.destination) LIKE '%' || LOWER(l.destination) || '%'
             OR LOWER(l.destination) LIKE '%' || LOWER(r.destination) || '%')
      )
      JOIN users ul ON ul.id = l.shipper_id
      JOIN users ur ON ur.id = r.trucker_id
      ORDER BY l.pay_usd DESC
    `).all();

    res.json(matches);
  } catch (err) { next(err); }
});

module.exports = router;
