'use strict';

const path  = require('path');
const os    = require('os');
const fs    = require('fs');
const { createDatabase }  = require('../src/database');
const { seedDatabase }    = require('../src/seed');
const { createApp }       = require('../src/app');

function buildTestApp() {
  const tmp = path.join(os.tmpdir(), `soccer_test_${Date.now()}_${Math.random().toString(36).slice(2)}.db`);
  const db  = createDatabase(tmp);
  seedDatabase(db);
  const app = createApp(db);
  return { app, db, cleanup: () => { try { db.close(); fs.unlinkSync(tmp); } catch {} } };
}

module.exports = { buildTestApp };
