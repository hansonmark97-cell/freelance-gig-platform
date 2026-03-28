'use strict';

const express = require('express');
const path = require('path');

const managersRouter   = require('./routes/managers');
const playersRouter    = require('./routes/players');
const squadsRouter     = require('./routes/squads');
const storeRouter      = require('./routes/store');
const packRouter       = require('./routes/packs');
const matchesRouter    = require('./routes/matches');
const leaderboardRouter = require('./routes/leaderboard');

function createApp(db) {
  const app = express();

  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use('/managers',     managersRouter(db));
  app.use('/players',      playersRouter(db));
  app.use('/managers',     squadsRouter(db));   // nested: /managers/:id/squad
  app.use('/store',        storeRouter(db));
  app.use('/packs',        packRouter(db));
  app.use('/matches',      matchesRouter(db));
  app.use('/leaderboard',  leaderboardRouter(db));

  // Health check
  app.get('/health', (_, res) => res.json({ status: 'ok' }));

  return app;
}

module.exports = { createApp };
