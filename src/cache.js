'use strict';

/**
 * Lightweight LRU (Least-Recently-Used) cache with per-entry TTL.
 *
 * Performance rationale:
 *  - JavaScript's built-in Map preserves insertion order, which makes it a
 *    natural structure for LRU eviction: the oldest entry is always at the
 *    front (Map.keys().next()).
 *  - Accessing an existing key deletes and re-inserts it, bumping it to the
 *    back (most-recently-used position) in O(1).
 *  - All operations (get / set / invalidate) are O(1).
 *  - TTL avoids serving stale data without requiring a background sweep job.
 */
class LRUCache {
  /**
   * @param {number} maxSize  Maximum number of entries before LRU eviction.
   * @param {number} ttlMs    Time-to-live in milliseconds for each entry.
   */
  constructor(maxSize = 200, ttlMs = 60_000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    /** @type {Map<string, {value: any, ts: number}>} */
    this._map = new Map();
  }

  /** Retrieve a cached value, or null if missing / expired. */
  get(key) {
    const entry = this._map.get(key);
    if (!entry) return null;

    if (Date.now() - entry.ts > this.ttlMs) {
      this._map.delete(key);
      return null;
    }

    // Promote to MRU position
    this._map.delete(key);
    this._map.set(key, entry);
    return entry.value;
  }

  /** Store a value.  Evicts the LRU entry if the cache is full. */
  set(key, value) {
    if (this._map.has(key)) {
      this._map.delete(key);
    } else if (this._map.size >= this.maxSize) {
      // Evict least-recently-used entry (first key in insertion-order Map)
      this._map.delete(this._map.keys().next().value);
    }
    this._map.set(key, { value, ts: Date.now() });
  }

  /** Remove a single entry (e.g. after a write that invalidates it). */
  invalidate(key) {
    this._map.delete(key);
  }

  /**
   * Remove all entries whose key contains the given substring.
   * Useful for bulk-invalidating a namespace, e.g. all keys starting with
   * "gig:" when a gig is updated.
   */
  invalidatePrefix(prefix) {
    for (const key of this._map.keys()) {
      if (key.startsWith(prefix)) {
        this._map.delete(key);
      }
    }
  }

  /** Current number of live (non-expired) entries (approximate). */
  get size() {
    return this._map.size;
  }
}

module.exports = { LRUCache };
