'use strict';

// ---------------------------------------------------------------------------
// Lightweight in-memory Firestore mock for Jest tests.
// Supports: collection, doc, add, set, update, delete, get,
//           where (==, !=, <, <=, >, >=, array-contains), orderBy, limit.
// ---------------------------------------------------------------------------

class MockDocumentSnapshot {
  constructor(id, data) {
    this.id = id;
    this._data = data !== undefined ? { ...data } : undefined;
    this.exists = data !== undefined;
  }

  data() {
    return this._data ? { ...this._data } : undefined;
  }
}

class MockQuerySnapshot {
  constructor(docs) {
    this.docs = docs;
    this.empty = docs.length === 0;
    this.size = docs.length;
  }

  forEach(fn) {
    this.docs.forEach(fn);
  }
}

class MockQuery {
  constructor(store, collectionName, filters = [], orders = [], limitVal = null) {
    this._store = store;
    this._collectionName = collectionName;
    this._filters = filters;
    this._orders = orders;
    this._limit = limitVal;
  }

  where(field, op, value) {
    return new MockQuery(
      this._store,
      this._collectionName,
      [...this._filters, { field, op, value }],
      this._orders,
      this._limit
    );
  }

  orderBy(field, dir = 'asc') {
    return new MockQuery(
      this._store,
      this._collectionName,
      this._filters,
      [...this._orders, { field, dir }],
      this._limit
    );
  }

  limit(n) {
    return new MockQuery(this._store, this._collectionName, this._filters, this._orders, n);
  }

  async get() {
    const raw = this._store[this._collectionName] || {};
    let docs = Object.entries(raw).map(([id, d]) => new MockDocumentSnapshot(id, d));

    for (const { field, op, value } of this._filters) {
      docs = docs.filter((doc) => {
        const docData = doc.data();
        const val = docData ? docData[field] : undefined;
        switch (op) {
          case '==':
            return val === value;
          case '!=':
            return val !== value;
          case '>':
            return val > value;
          case '>=':
            return val >= value;
          case '<':
            return val < value;
          case '<=':
            return val <= value;
          case 'array-contains':
            return Array.isArray(val) && val.includes(value);
          default:
            return true;
        }
      });
    }

    for (const { field, dir } of this._orders) {
      docs.sort((a, b) => {
        const aVal = a.data()?.[field];
        const bVal = b.data()?.[field];
        if (aVal === bVal) return 0;
        if (dir === 'asc') return aVal > bVal ? 1 : -1;
        return aVal < bVal ? 1 : -1;
      });
    }

    if (this._limit !== null) {
      docs = docs.slice(0, this._limit);
    }

    return new MockQuerySnapshot(docs);
  }
}

class MockDocumentRef {
  constructor(store, collectionName, id) {
    this._store = store;
    this._collectionName = collectionName;
    this.id = id;
  }

  async get() {
    const data = (this._store[this._collectionName] || {})[this.id];
    return new MockDocumentSnapshot(this.id, data);
  }

  async set(data) {
    if (!this._store[this._collectionName]) this._store[this._collectionName] = {};
    this._store[this._collectionName][this.id] = { ...data };
  }

  async update(data) {
    const existing = (this._store[this._collectionName] || {})[this.id];
    if (existing === undefined) throw new Error(`Document ${this.id} does not exist`);
    this._store[this._collectionName][this.id] = { ...existing, ...data };
  }

  async delete() {
    if (this._store[this._collectionName]) {
      delete this._store[this._collectionName][this.id];
    }
  }
}

class MockCollectionRef {
  constructor(store, name) {
    this._store = store;
    this._name = name;
    this._idCounter = 0;
  }

  doc(id) {
    return new MockDocumentRef(this._store, this._name, id);
  }

  async add(data) {
    const id = `mock-${this._name}-${++this._idCounter}`;
    if (!this._store[this._name]) this._store[this._name] = {};
    this._store[this._name][id] = { ...data };
    return { id };
  }

  where(field, op, value) {
    return new MockQuery(this._store, this._name, [{ field, op, value }]);
  }

  orderBy(field, dir = 'asc') {
    return new MockQuery(this._store, this._name, [], [{ field, dir }]);
  }

  async get() {
    return new MockQuery(this._store, this._name).get();
  }
}

class MockFirestore {
  constructor() {
    this._store = {};
    this._collections = {};
  }

  collection(name) {
    if (!this._collections[name]) {
      this._collections[name] = new MockCollectionRef(this._store, name);
    }
    return this._collections[name];
  }

  reset() {
    Object.keys(this._store).forEach((k) => delete this._store[k]);
    Object.values(this._collections).forEach((c) => {
      c._idCounter = 0;
    });
  }
}

const mockDb = new MockFirestore();

module.exports = { mockDb };
