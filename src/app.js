'use strict';

const express = require('express');
const { createDatabase } = require('./database');
const { LRUCache } = require('./cache');

const usersRouter = require('./routes/users');
const gigsRouter = require('./routes/gigs');
const jobsRouter = require('./routes/jobs');
const bidsRouter = require('./routes/bids');
const reviewsRouter = require('./routes/reviews');

/**
 * Create and configure the Express application.
 *
 * Accepts an optional pre-configured `db` instance so that tests can inject an
 * in-memory database without touching the filesystem.
 *
 * @param {import('better-sqlite3').Database} [db]
 * @returns {import('express').Express}
 */
function createApp(db) {
  if (!db) {
    db = createDatabase();
  }

  // Shared LRU cache — kept on the app so routes can access via req.app.locals
  const cache = new LRUCache(200, 60_000);

  const app = express();
  app.use(express.json());

  // Attach shared resources to app locals so routers can access them
  app.locals.db = db;
  app.locals.cache = cache;

  // ── Routes ───────────────────────────────────────────────────────────────
  app.use('/api/users', usersRouter);
  app.use('/api/gigs', gigsRouter);
  app.use('/api/jobs', jobsRouter);
  app.use('/api/bids', bidsRouter);
  app.use('/api/reviews', reviewsRouter);

  // ── 404 handler ──────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // ── Error handler ────────────────────────────────────────────────────────
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };
