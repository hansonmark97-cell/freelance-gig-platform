// In-memory Firestore mock

const store = {};
const { generateId } = require('../src/utils');

function reset() {
  Object.keys(store).forEach(k => delete store[k]);
}

class DocumentSnapshot {
  constructor(id, data) {
    this.id = id;
    this._data = data ? { ...data } : null;
    this.exists = data !== null && data !== undefined;
  }
  data() {
    return this._data ? { ...this._data } : undefined;
  }
}

class QuerySnapshot {
  constructor(docs) {
    this.docs = docs;
    this.empty = docs.length === 0;
  }
}

class DocumentRef {
  constructor(collectionName, id) {
    this.collectionName = collectionName;
    this.id = id;
  }

  async get() {
    const col = store[this.collectionName] || {};
    const data = col[this.id] || null;
    return new DocumentSnapshot(this.id, data);
  }

  async set(data) {
    if (!store[this.collectionName]) store[this.collectionName] = {};
    store[this.collectionName][this.id] = { ...data };
  }

  async update(data) {
    if (!store[this.collectionName]) store[this.collectionName] = {};
    if (!store[this.collectionName][this.id]) {
      throw new Error(`Document ${this.id} does not exist`);
    }
    store[this.collectionName][this.id] = {
      ...store[this.collectionName][this.id],
      ...data,
    };
  }

  async delete() {
    if (store[this.collectionName]) {
      delete store[this.collectionName][this.id];
    }
  }
}

function applyCondition(value, op, condValue) {
  switch (op) {
    case '==': return value === condValue;
    case '!=': return value !== condValue;
    case '<': return value < condValue;
    case '<=': return value <= condValue;
    case '>': return value > condValue;
    case '>=': return value >= condValue;
    case 'array-contains': return Array.isArray(value) && value.includes(condValue);
    default: return false;
  }
}

class Query {
  constructor(collectionName, conditions = [], orderByField = null, orderByDir = 'asc', limitCount = null) {
    this.collectionName = collectionName;
    this.conditions = conditions;
    this._orderByField = orderByField;
    this._orderByDir = orderByDir;
    this._limitCount = limitCount;
  }

  where(field, op, value) {
    return new Query(
      this.collectionName,
      [...this.conditions, { field, op, value }],
      this._orderByField,
      this._orderByDir,
      this._limitCount
    );
  }

  orderBy(field, dir = 'asc') {
    return new Query(this.collectionName, this.conditions, field, dir, this._limitCount);
  }

  limit(n) {
    return new Query(this.collectionName, this.conditions, this._orderByField, this._orderByDir, n);
  }

  async get() {
    const col = store[this.collectionName] || {};
    let docs = Object.entries(col).map(([id, data]) => new DocumentSnapshot(id, data));

    // Apply conditions
    for (const { field, op, value } of this.conditions) {
      docs = docs.filter(doc => {
        const docData = doc.data();
        if (docData === undefined) return false;
        return applyCondition(docData[field], op, value);
      });
    }

    // OrderBy
    if (this._orderByField) {
      docs.sort((a, b) => {
        const aVal = a.data()[this._orderByField];
        const bVal = b.data()[this._orderByField];
        if (aVal < bVal) return this._orderByDir === 'asc' ? -1 : 1;
        if (aVal > bVal) return this._orderByDir === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Limit
    if (this._limitCount !== null) {
      docs = docs.slice(0, this._limitCount);
    }

    return new QuerySnapshot(docs);
  }
}

class CollectionRef extends Query {
  constructor(name) {
    super(name);
  }

  doc(id) {
    return new DocumentRef(this.collectionName, id || generateId());
  }

  async add(data) {
    const id = generateId();
    const docRef = this.doc(id);
    await docRef.set(data);
    return docRef;
  }
}

function collection(name) {
  return new CollectionRef(name);
}

module.exports = { collection, reset };
