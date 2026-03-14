# freelance-gig-platform

A modern freelance gig work platform — Node.js / Express / SQLite REST API.

---

## Getting started

```bash
npm install
npm start          # listens on port 3000 (override with PORT env-var)
```

Run tests:

```bash
npm test
```

---

## API reference

All list endpoints support `?limit=<n>&offset=<n>` (limit clamped to 1–100, default 20).

### Users

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/users` | Create a user (`freelancer` or `client`) |
| `GET` | `/api/users` | List users (filter: `?role=freelancer\|client`) |
| `GET` | `/api/users/:id` | Get user profile with aggregated review stats |
| `PATCH` | `/api/users/:id` | Update `bio`, `skills`, `hourly_rate` |

### Gigs

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/gigs` | Create a gig (freelancers only) |
| `GET` | `/api/gigs` | List active gigs (filter: `?category=<cat>`) |
| `GET` | `/api/gigs/:id` | Get a single gig |
| `PATCH` | `/api/gigs/:id` | Update gig fields / status |
| `DELETE` | `/api/gigs/:id` | Soft-delete a gig |

### Jobs

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/jobs` | Post a job (clients only) |
| `GET` | `/api/jobs` | List jobs (filter: `?category=<cat>&status=<s>`) |
| `GET` | `/api/jobs/:id` | Get a job with bid count and lowest pending bid |
| `PATCH` | `/api/jobs/:id` | Update job fields / status |

### Bids

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/bids` | Submit a bid (freelancers only, job must be `open`) |
| `GET` | `/api/bids` | List bids (filter: `?job_id=<n>&freelancer_id=<n>`) |
| `GET` | `/api/bids/:id` | Get a single bid |
| `PATCH` | `/api/bids/:id` | Update bid status (`pending/accepted/rejected/withdrawn`) |

### Reviews

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/reviews` | Submit a review (rating 1–5, one per reviewer per job) |
| `GET` | `/api/reviews` | List reviews (filter: `?reviewee_id=<n>`) |
| `GET` | `/api/reviews/summary/:userId` | Aggregated rating (avg / min / max / count) |
| `GET` | `/api/reviews/:id` | Get a single review |

---

## Performance design decisions

### 1. Database pragmas — WAL mode + NORMAL sync

```js
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
```

WAL (Write-Ahead Log) allows readers and writers to proceed concurrently without blocking each other, giving significantly higher throughput than the default DELETE journal under concurrent load. `NORMAL` sync is still crash-safe but skips the per-transaction `fsync` that `FULL` mode requires.

### 2. Composite indexes for filtered listing queries

```sql
CREATE INDEX idx_gigs_category_status ON gigs(category, status);
CREATE INDEX idx_jobs_category_status  ON jobs(category, status);
CREATE INDEX idx_gigs_created_at       ON gigs(created_at DESC);
```

Every `GET /api/gigs?category=…` or `GET /api/jobs?status=…` query can be satisfied with a single index scan rather than a full table scan followed by an in-memory filter.

### 3. JOIN instead of N+1 queries

All list endpoints fetch related data (owner username, client username, freelancer username) in a single `JOIN` query rather than issuing one follow-up query per row.

```sql
-- One query — no per-row follow-up
SELECT g.*, u.username, u.hourly_rate
FROM   gigs g
JOIN   users u ON g.user_id = u.id
WHERE  g.status = 'active'
ORDER  BY g.created_at DESC
LIMIT  :limit OFFSET :offset
```

### 4. DB-layer aggregates — no in-JS computation

`AVG(rating)`, `COUNT(bids)`, `MIN(amount)` are all computed inside SQL rather than fetching all rows into JS and iterating.

```sql
SELECT COUNT(*) AS bid_count, MIN(amount) AS lowest_bid
FROM   bids WHERE job_id = ?
```

The `idx_reviews_reviewee_id` and `idx_bids_job_id` indexes make these aggregates O(log n + k) rather than O(n).

### 5. Pagination enforced at every list endpoint

`limit` is clamped to `[1, 100]` and `offset` is validated, preventing unbounded full-table scans through the query layer.

### 6. LRU cache with TTL for hot list data

Gig and job list results are cached in a process-level LRU cache (max 200 entries, 60 s TTL). Cache entries are invalidated on every write so data is never stale longer than the TTL.  All cache operations are O(1) using an insertion-ordered `Map`.

### 7. Schema-level unique constraints eliminate duplicate-check round-trips

```sql
UNIQUE(job_id, freelancer_id)   -- bids table
UNIQUE(reviewer_id, job_id)     -- reviews table
```

Instead of `SELECT … WHERE … THEN INSERT`, a single `INSERT` is issued and the database enforces uniqueness atomically, saving a round-trip per operation.

### 8. Selective `SELECT` — no `SELECT *` on hot paths

List queries name only the columns the response actually uses, reducing I/O and serialization work.

---

## Project structure

```
src/
  server.js          Entry point
  app.js             Express wiring
  database.js        SQLite schema + pragmas + indexes
  cache.js           O(1) LRU cache
  routes/
    users.js
    gigs.js
    jobs.js
    bids.js
    reviews.js
tests/
  users.test.js
  gigs.test.js
  jobs.test.js
  bids.test.js
  reviews.test.js
```
