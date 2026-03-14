'use strict';

const Database = require('better-sqlite3');
const path = require('path');

/** Return a configured SQLite database instance.
 *
 * Performance decisions:
 *  - WAL journal mode: readers never block writers, writers never block readers,
 *    giving much better throughput under concurrent load compared to the default
 *    DELETE journal.
 *  - Synchronous = NORMAL: durable enough for most workloads while avoiding the
 *    full fsync on every transaction that FULL mode imposes.
 *  - Foreign-key enforcement: keeps referential integrity without application-
 *    level round-trips.
 *  - Composite indexes on (category, status) and (user_id) allow the database to
 *    satisfy filtered + sorted list queries with a single index scan instead of a
 *    full table scan followed by an in-memory sort.
 */
function createDatabase(dbPath) {
  const resolvedPath =
    dbPath ||
    (process.env.NODE_ENV === 'test'
      ? ':memory:'
      : path.join(__dirname, '..', 'data', 'platform.db'));

  const db = new Database(resolvedPath);

  // ── Pragmas ──────────────────────────────────────────────────────────────
  // WAL mode: concurrent reads without blocking writes
  db.pragma('journal_mode = WAL');
  // Slightly relaxed sync: still crash-safe, but avoids per-transaction fsync
  db.pragma('synchronous = NORMAL');
  // Enforce FK constraints at the DB level
  db.pragma('foreign_keys = ON');

  // ── Schema ───────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      username    TEXT    UNIQUE NOT NULL,
      email       TEXT    UNIQUE NOT NULL,
      role        TEXT    NOT NULL CHECK(role IN ('freelancer', 'client')),
      bio         TEXT,
      skills      TEXT,
      hourly_rate REAL,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS gigs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL,
      title         TEXT    NOT NULL,
      description   TEXT    NOT NULL,
      category      TEXT    NOT NULL,
      price         REAL    NOT NULL CHECK(price > 0),
      delivery_days INTEGER NOT NULL CHECK(delivery_days > 0),
      status        TEXT    NOT NULL DEFAULT 'active'
                    CHECK(status IN ('active', 'paused', 'deleted')),
      created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at    INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id   INTEGER NOT NULL,
      title       TEXT    NOT NULL,
      description TEXT    NOT NULL,
      category    TEXT    NOT NULL,
      budget      REAL    NOT NULL CHECK(budget > 0),
      status      TEXT    NOT NULL DEFAULT 'open'
                  CHECK(status IN ('open', 'in_progress', 'completed', 'cancelled')),
      created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (client_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS bids (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id        INTEGER NOT NULL,
      freelancer_id INTEGER NOT NULL,
      amount        REAL    NOT NULL CHECK(amount > 0),
      proposal      TEXT    NOT NULL,
      delivery_days INTEGER NOT NULL CHECK(delivery_days > 0),
      status        TEXT    NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
      created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at    INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (job_id)        REFERENCES jobs(id),
      FOREIGN KEY (freelancer_id) REFERENCES users(id),
      -- Prevent duplicate bids from the same freelancer on the same job
      UNIQUE(job_id, freelancer_id)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      reviewer_id INTEGER NOT NULL,
      reviewee_id INTEGER NOT NULL,
      job_id      INTEGER NOT NULL,
      rating      INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment     TEXT,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (reviewer_id) REFERENCES users(id),
      FOREIGN KEY (reviewee_id) REFERENCES users(id),
      FOREIGN KEY (job_id)      REFERENCES jobs(id),
      -- One review per reviewer per job
      UNIQUE(reviewer_id, job_id)
    );

    -- ── Indexes ──────────────────────────────────────────────────────────
    -- Performance: composite index satisfies WHERE category = ? AND status = ?
    -- queries on gigs without a full-table scan, also used by ORDER BY created_at.
    CREATE INDEX IF NOT EXISTS idx_gigs_category_status
      ON gigs(category, status);

    -- Performance: covers "fetch all gigs by a given user" queries.
    CREATE INDEX IF NOT EXISTS idx_gigs_user_id
      ON gigs(user_id);

    -- Performance: covers time-ordered listing of all active gigs.
    CREATE INDEX IF NOT EXISTS idx_gigs_created_at
      ON gigs(created_at DESC);

    -- Performance: composite index for filtered job listing.
    CREATE INDEX IF NOT EXISTS idx_jobs_category_status
      ON jobs(category, status);

    -- Performance: covers "fetch all jobs posted by a given client" queries.
    CREATE INDEX IF NOT EXISTS idx_jobs_client_id
      ON jobs(client_id);

    -- Performance: covers time-ordered job listing.
    CREATE INDEX IF NOT EXISTS idx_jobs_created_at
      ON jobs(created_at DESC);

    -- Performance: covers "fetch all bids on a job" queries (very common).
    CREATE INDEX IF NOT EXISTS idx_bids_job_id
      ON bids(job_id);

    -- Performance: covers "fetch all bids by a freelancer" queries.
    CREATE INDEX IF NOT EXISTS idx_bids_freelancer_id
      ON bids(freelancer_id);

    -- Performance: covers "fetch reviews for a user" queries and AVG(rating).
    CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id
      ON reviews(reviewee_id);
  `);

  return db;
}

module.exports = { createDatabase };
