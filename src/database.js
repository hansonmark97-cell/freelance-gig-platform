'use strict';

const Database = require('better-sqlite3');
const path = require('path');

// The platform retains this percentage of every sale as revenue.
const PLATFORM_FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT || '15');

function createDatabase(dbPath) {
  const db = new Database(dbPath || path.join(__dirname, '..', 'data', 'market.db'));

  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    -- Sellers who list and sell digital products
    CREATE TABLE IF NOT EXISTS sellers (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      username     TEXT    NOT NULL UNIQUE,
      email        TEXT    NOT NULL UNIQUE,
      display_name TEXT    NOT NULL DEFAULT '',
      bio          TEXT    NOT NULL DEFAULT '',
      created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    );

    -- Digital products listed for sale
    CREATE TABLE IF NOT EXISTS products (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id    INTEGER NOT NULL REFERENCES sellers(id),
      title        TEXT    NOT NULL,
      description  TEXT    NOT NULL DEFAULT '',
      category     TEXT    NOT NULL DEFAULT '',
      price        REAL    NOT NULL CHECK(price >= 0),
      file_url     TEXT    NOT NULL DEFAULT '',
      status       TEXT    NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','deleted')),
      created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    );

    -- Buyer accounts
    CREATE TABLE IF NOT EXISTS buyers (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      username     TEXT    NOT NULL UNIQUE,
      email        TEXT    NOT NULL UNIQUE,
      display_name TEXT    NOT NULL DEFAULT '',
      created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    );

    -- Orders placed by buyers
    CREATE TABLE IF NOT EXISTS orders (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      buyer_id     INTEGER NOT NULL REFERENCES buyers(id),
      status       TEXT    NOT NULL DEFAULT 'completed' CHECK(status IN ('completed','refunded')),
      total_amount REAL    NOT NULL DEFAULT 0,
      created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    );

    -- Line items within each order (one product per row)
    CREATE TABLE IF NOT EXISTS order_items (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id             INTEGER NOT NULL REFERENCES orders(id),
      product_id           INTEGER NOT NULL REFERENCES products(id),
      seller_id            INTEGER NOT NULL REFERENCES sellers(id),
      price_at_purchase    REAL    NOT NULL,
      platform_fee_percent REAL    NOT NULL DEFAULT ${PLATFORM_FEE_PERCENT},
      platform_fee_amount  REAL    NOT NULL,
      seller_payout        REAL    NOT NULL,
      UNIQUE(order_id, product_id)
    );

    -- Buyer reviews on purchased products
    CREATE TABLE IF NOT EXISTS reviews (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      buyer_id    INTEGER NOT NULL REFERENCES buyers(id),
      product_id  INTEGER NOT NULL REFERENCES products(id),
      order_id    INTEGER NOT NULL REFERENCES orders(id),
      rating      INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment     TEXT    NOT NULL DEFAULT '',
      created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      UNIQUE(buyer_id, product_id)
    );

    CREATE INDEX IF NOT EXISTS idx_products_seller_id       ON products(seller_id);
    CREATE INDEX IF NOT EXISTS idx_products_category_status ON products(category, status);
    CREATE INDEX IF NOT EXISTS idx_products_created_at      ON products(created_at);

    CREATE INDEX IF NOT EXISTS idx_orders_buyer_id          ON orders(buyer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at        ON orders(created_at);

    CREATE INDEX IF NOT EXISTS idx_order_items_order_id     ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_order_items_product_id   ON order_items(product_id);
    CREATE INDEX IF NOT EXISTS idx_order_items_seller_id    ON order_items(seller_id);

    CREATE INDEX IF NOT EXISTS idx_reviews_product_id       ON reviews(product_id);
  `);

  return db;
}

module.exports = { createDatabase, PLATFORM_FEE_PERCENT };
