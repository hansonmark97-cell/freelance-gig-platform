'use strict';

const Database = require('better-sqlite3');
const path = require('path');

const PLATFORM_FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT || '10');

function createDatabase(dbPath) {
  const db = new Database(dbPath || path.join(__dirname, '..', 'data', 'platform.db'));

  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT    NOT NULL UNIQUE,
      email      TEXT    NOT NULL UNIQUE,
      role       TEXT    NOT NULL CHECK(role IN ('freelancer','client')),
      bio        TEXT    NOT NULL DEFAULT '',
      skills     TEXT    NOT NULL DEFAULT '',
      hourly_rate REAL   NOT NULL DEFAULT 0,
      created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    );

    CREATE TABLE IF NOT EXISTS gigs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id),
      title         TEXT    NOT NULL,
      description   TEXT    NOT NULL DEFAULT '',
      category      TEXT    NOT NULL DEFAULT '',
      price         REAL    NOT NULL DEFAULT 0,
      delivery_days INTEGER NOT NULL DEFAULT 1,
      status        TEXT    NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','deleted')),
      created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id   INTEGER NOT NULL REFERENCES users(id),
      title       TEXT    NOT NULL,
      description TEXT    NOT NULL DEFAULT '',
      category    TEXT    NOT NULL DEFAULT '',
      budget      REAL    NOT NULL DEFAULT 0,
      status      TEXT    NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','completed','cancelled')),
      created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    );

    CREATE TABLE IF NOT EXISTS bids (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id         INTEGER NOT NULL REFERENCES jobs(id),
      freelancer_id  INTEGER NOT NULL REFERENCES users(id),
      amount         REAL    NOT NULL,
      proposal       TEXT    NOT NULL DEFAULT '',
      delivery_days  INTEGER NOT NULL DEFAULT 1,
      status         TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','withdrawn')),
      created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      UNIQUE(job_id, freelancer_id)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      reviewer_id INTEGER NOT NULL REFERENCES users(id),
      reviewee_id INTEGER NOT NULL REFERENCES users(id),
      job_id      INTEGER NOT NULL REFERENCES jobs(id),
      rating      INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment     TEXT    NOT NULL DEFAULT '',
      created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      UNIQUE(reviewer_id, job_id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id               INTEGER NOT NULL REFERENCES jobs(id),
      bid_id               INTEGER NOT NULL UNIQUE REFERENCES bids(id),
      freelancer_id        INTEGER NOT NULL REFERENCES users(id),
      client_id            INTEGER NOT NULL REFERENCES users(id),
      gross_amount         REAL    NOT NULL,
      platform_fee_percent REAL    NOT NULL DEFAULT ${PLATFORM_FEE_PERCENT},
      platform_fee_amount  REAL    NOT NULL,
      net_amount           REAL    NOT NULL,
      status               TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','refunded')),
      created_at           TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    );

    CREATE INDEX IF NOT EXISTS idx_gigs_category_status   ON gigs(category, status);
    CREATE INDEX IF NOT EXISTS idx_gigs_user_id           ON gigs(user_id);
    CREATE INDEX IF NOT EXISTS idx_gigs_created_at        ON gigs(created_at);

    CREATE INDEX IF NOT EXISTS idx_jobs_category_status   ON jobs(category, status);
    CREATE INDEX IF NOT EXISTS idx_jobs_client_id         ON jobs(client_id);
    CREATE INDEX IF NOT EXISTS idx_jobs_created_at        ON jobs(created_at);

    CREATE INDEX IF NOT EXISTS idx_bids_job_id            ON bids(job_id);
    CREATE INDEX IF NOT EXISTS idx_bids_freelancer_id     ON bids(freelancer_id);

    CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id    ON reviews(reviewee_id);

    CREATE INDEX IF NOT EXISTS idx_transactions_freelancer ON transactions(freelancer_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_client     ON transactions(client_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_job_id     ON transactions(job_id);
  `);

  return db;
}

module.exports = { createDatabase, PLATFORM_FEE_PERCENT };
