'use strict';

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'trucker.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      email       TEXT    NOT NULL UNIQUE,
      password    TEXT    NOT NULL,
      role        TEXT    NOT NULL CHECK(role IN ('trucker','shipper')),
      phone       TEXT,
      company     TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS loads (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      shipper_id    INTEGER NOT NULL REFERENCES users(id),
      origin        TEXT    NOT NULL,
      destination   TEXT    NOT NULL,
      freight_type  TEXT    NOT NULL,
      weight_lbs    REAL    NOT NULL,
      length_ft     REAL,
      pay_usd       REAL    NOT NULL,
      notes         TEXT,
      status        TEXT    NOT NULL DEFAULT 'open'
                            CHECK(status IN ('open','booked','completed','cancelled')),
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS routes (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      trucker_id       INTEGER NOT NULL REFERENCES users(id),
      origin           TEXT    NOT NULL,
      destination      TEXT    NOT NULL,
      departure_date   TEXT    NOT NULL,
      route_type       TEXT    NOT NULL CHECK(route_type IN ('deadmiles','partial')),
      avail_weight_lbs REAL    NOT NULL,
      avail_length_ft  REAL,
      notes            TEXT,
      status           TEXT    NOT NULL DEFAULT 'active'
                               CHECK(status IN ('active','completed','cancelled')),
      created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      load_id            INTEGER NOT NULL REFERENCES loads(id),
      route_id           INTEGER NOT NULL REFERENCES routes(id),
      trucker_id         INTEGER NOT NULL REFERENCES users(id),
      shipper_id         INTEGER NOT NULL REFERENCES users(id),
      pay_usd            REAL    NOT NULL,
      platform_fee_usd   REAL    NOT NULL,
      trucker_payout_usd REAL    NOT NULL,
      status             TEXT    NOT NULL DEFAULT 'pending'
                                 CHECK(status IN ('pending','accepted','completed','cancelled')),
      created_at         TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id  INTEGER NOT NULL REFERENCES bookings(id),
      reviewer_id INTEGER NOT NULL REFERENCES users(id),
      reviewee_id INTEGER NOT NULL REFERENCES users(id),
      rating      INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment     TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(booking_id, reviewer_id)
    );

    CREATE INDEX IF NOT EXISTS idx_loads_status    ON loads(status);
    CREATE INDEX IF NOT EXISTS idx_routes_status   ON routes(status);
    CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
  `);
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, closeDb };
