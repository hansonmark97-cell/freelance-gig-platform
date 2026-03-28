'use strict';

const Database = require('better-sqlite3');
const path = require('path');

function createDatabase(dbPath) {
  const db = new Database(dbPath || path.join(__dirname, '..', 'data', 'soccer.db'));

  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    -- ─── Users ────────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS managers (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      username     TEXT    NOT NULL UNIQUE,
      email        TEXT    NOT NULL UNIQUE,
      team_name    TEXT    NOT NULL DEFAULT 'My FC',
      coins        INTEGER NOT NULL DEFAULT 0,
      wins         INTEGER NOT NULL DEFAULT 0,
      losses       INTEGER NOT NULL DEFAULT 0,
      draws        INTEGER NOT NULL DEFAULT 0,
      goals_scored INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    );

    -- ─── Player catalogue ────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS players (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      position   TEXT    NOT NULL CHECK(position IN ('GK','DEF','MID','FWD')),
      nationality TEXT   NOT NULL DEFAULT '',
      rating     INTEGER NOT NULL CHECK(rating BETWEEN 50 AND 99),
      pace       INTEGER NOT NULL DEFAULT 70,
      shooting   INTEGER NOT NULL DEFAULT 70,
      passing    INTEGER NOT NULL DEFAULT 70,
      defending  INTEGER NOT NULL DEFAULT 70,
      rarity     TEXT    NOT NULL DEFAULT 'common' CHECK(rarity IN ('common','rare','epic','legendary'))
    );

    -- ─── Manager-owned players ───────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS squad_players (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      manager_id   INTEGER NOT NULL REFERENCES managers(id),
      player_id    INTEGER NOT NULL REFERENCES players(id),
      in_squad     INTEGER NOT NULL DEFAULT 0 CHECK(in_squad IN (0,1)),
      squad_slot   INTEGER,
      acquired_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    );

    -- ─── Coin packs for sale (IAP catalogue) ────────────────────────────────
    CREATE TABLE IF NOT EXISTS coin_packs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      coins       INTEGER NOT NULL,
      price_usd   REAL    NOT NULL,
      bonus_pct   INTEGER NOT NULL DEFAULT 0,
      is_active   INTEGER NOT NULL DEFAULT 1
    );

    -- ─── Coin purchases (revenue) ────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS purchases (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      manager_id    INTEGER NOT NULL REFERENCES managers(id),
      coin_pack_id  INTEGER NOT NULL REFERENCES coin_packs(id),
      coins_awarded INTEGER NOT NULL,
      price_usd     REAL    NOT NULL,
      created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    );

    -- ─── Player pack openings ────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS pack_openings (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      manager_id   INTEGER NOT NULL REFERENCES managers(id),
      pack_type    TEXT    NOT NULL CHECK(pack_type IN ('standard','premium','elite')),
      coins_spent  INTEGER NOT NULL,
      created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    );

    -- ─── Matches ─────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS matches (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      home_manager_id INTEGER NOT NULL REFERENCES managers(id),
      away_manager_id INTEGER REFERENCES managers(id),
      home_goals      INTEGER NOT NULL DEFAULT 0,
      away_goals      INTEGER NOT NULL DEFAULT 0,
      home_rating     REAL    NOT NULL DEFAULT 0,
      away_rating     REAL    NOT NULL DEFAULT 0,
      result          TEXT    NOT NULL CHECK(result IN ('home_win','away_win','draw')),
      coins_earned    INTEGER NOT NULL DEFAULT 0,
      played_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    );

    -- ─── Indexes ─────────────────────────────────────────────────────────────
    CREATE INDEX IF NOT EXISTS idx_squad_players_manager ON squad_players(manager_id);
    CREATE INDEX IF NOT EXISTS idx_squad_players_player  ON squad_players(player_id);
    CREATE INDEX IF NOT EXISTS idx_purchases_manager     ON purchases(manager_id);
    CREATE INDEX IF NOT EXISTS idx_matches_home          ON matches(home_manager_id);
    CREATE INDEX IF NOT EXISTS idx_pack_openings_manager ON pack_openings(manager_id);
  `);

  return db;
}

module.exports = { createDatabase };
