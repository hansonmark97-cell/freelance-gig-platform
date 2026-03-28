'use strict';

/**
 * Minimal O(1) LRU cache with TTL.
 * Used to cache hot list queries and avoid redundant DB hits.
 */
class LRUCache {
  constructor({ max = 200, ttlMs = 60_000 } = {}) {
    this.max = max;
    this.ttlMs = ttlMs;
    // Map preserves insertion order; we use that for LRU eviction.
    this._store = new Map();
  }

  get(key) {
    const entry = this._store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > this.ttlMs) {
      this._store.delete(key);
      return null;
    }
    // Refresh insertion order (move to end = most-recently-used).
    this._store.delete(key);
    this._store.set(key, entry);
    return entry.value;
  }

  set(key, value) {
    if (this._store.has(key)) this._store.delete(key);
    else if (this._store.size >= this.max) {
      // Evict the oldest (first) entry.
      this._store.delete(this._store.keys().next().value);
    }
    this._store.set(key, { value, ts: Date.now() });
  }

  invalidate(key) {
    this._store.delete(key);
  }

  invalidatePrefix(prefix) {
    for (const key of this._store.keys()) {
      if (key.startsWith(prefix)) this._store.delete(key);
    }
  }
}

module.exports = LRUCache;
