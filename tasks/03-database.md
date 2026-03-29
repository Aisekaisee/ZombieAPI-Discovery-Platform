# Task 03: Database Schema & Client

> **Assignee:** Team Member 3
> **Dependencies:** Read `00-shared-contracts.md` first
> **Estimated Effort:** Small
> **Files Owned:** `backend/src/db/schema.sql`, `backend/src/db/client.js`, `backend/src/db/seed.js`

---

## Objective

Create the PostgreSQL database schema, connection pool client, and seed script. This is the data layer that every backend module depends on.

---

## Files to Create

### 1. `backend/src/db/schema.sql`

Copy the exact schema from `00-shared-contracts.md`. Add:

```sql
-- Drop tables if exist (for easy re-initialization)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS security_findings CASCADE;
DROP TABLE IF EXISTS scan_runs CASCADE;
DROP TABLE IF EXISTS apis CASCADE;

-- Create tables (copy from 00-shared-contracts.md)
-- ... apis table ...
-- ... scan_runs table ...
-- ... security_findings table ...
-- ... audit_logs table ...

-- Indexes for common queries
CREATE INDEX idx_apis_status ON apis(status);
CREATE INDEX idx_apis_risk_score ON apis(risk_score);
CREATE INDEX idx_apis_host_port ON apis(host, port);
CREATE INDEX idx_security_findings_api_id ON security_findings(api_id);
CREATE INDEX idx_security_findings_severity ON security_findings(severity);
CREATE INDEX idx_audit_logs_api_id ON audit_logs(api_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_scan_runs_type ON scan_runs(type);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER apis_updated_at
  BEFORE UPDATE ON apis
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

### 2. `backend/src/db/client.js`

```js
// PostgreSQL connection pool using 'pg' library
// Export:
//   pool     - raw pg.Pool instance (for transactions if needed)
//   query(text, params)  - shorthand for pool.query(text, params)
//
// Usage by other modules:
//   const db = require('./db/client');
//   const result = await db.query('SELECT * FROM apis WHERE status = $1', ['ZOMBIE']);
//   const rows = result.rows;

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // OR individual params:
  // host: process.env.PGHOST,
  // port: process.env.PGPORT,
  // user: process.env.PGUSER,
  // password: process.env.PGPASSWORD,
  // database: process.env.PGDATABASE,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Log connection errors
pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL error:', err);
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};
```

### 3. `backend/src/db/seed.js`

A script to pre-populate the database with realistic data for demo purposes. Run with `node src/db/seed.js`.

```js
// Seed script that:
// 1. Clears all tables (TRUNCATE CASCADE)
// 2. Inserts 6 API entries matching the mock APIs (see 00-shared-contracts.md Mock API Expected Behaviors)
// 3. Inserts 3-5 historical scan_runs entries (dated over the past week)
// 4. Inserts security findings for the zombie/shadow APIs
// 5. Inserts audit log entries (DISCOVERED events for each API)
//
// This is for demo polish — so the dashboard isn't empty before the first live scan.

// Seed API data:
const seedApis = [
  {
    path: '/api/v2/accounts', method: 'GET', host: 'localhost', port: 3010,
    status: 'ACTIVE', risk_score: 90, owner: 'accounts-team',
    discovery_sources: ['network', 'gateway', 'git', 'traffic'],
    auth_check: true, https_check: true, rate_limit_check: true, pii_check: false,
  },
  {
    path: '/api/v2/transfers', method: 'GET', host: 'localhost', port: 3011,
    status: 'ACTIVE', risk_score: 85, owner: 'payments-team',
    discovery_sources: ['network', 'gateway', 'git', 'traffic'],
    auth_check: true, https_check: true, rate_limit_check: true, pii_check: false,
  },
  {
    path: '/api/v1/accounts', method: 'GET', host: 'localhost', port: 3012,
    status: 'DEPRECATED', risk_score: 55, owner: 'accounts-team',
    discovery_sources: ['network', 'gateway', 'git'],
    auth_check: true, https_check: false, rate_limit_check: false, pii_check: false,
  },
  {
    path: '/api/v1/customers', method: 'GET', host: 'localhost', port: 3013,
    status: 'ZOMBIE', risk_score: 5, owner: null,
    discovery_sources: ['network'],
    auth_check: false, https_check: false, rate_limit_check: false, pii_check: true,
    pii_types: ['aadhaar', 'pan', 'phone', 'email'],
  },
  {
    path: '/api/v1/loans', method: 'GET', host: 'localhost', port: 3014,
    status: 'ZOMBIE', risk_score: 10, owner: null,
    discovery_sources: ['network'],
    auth_check: false, https_check: false, rate_limit_check: false, pii_check: true,
    pii_types: ['aadhaar', 'account_number'],
  },
  {
    path: '/internal/debug/users', method: 'GET', host: 'localhost', port: 3015,
    status: 'SHADOW', risk_score: 0, owner: null,
    discovery_sources: ['network', 'traffic'],
    auth_check: false, https_check: false, rate_limit_check: false, pii_check: true,
    pii_types: ['aadhaar', 'pan', 'phone', 'email', 'password_hash', 'api_keys'],
  },
];

// Also seed 3-5 scan_runs with timestamps over the past week
// Also seed security findings (CRITICAL for zombies, LOW for active)
// Also seed audit logs showing discovery events
```

---

## Acceptance Criteria

1. Running `schema.sql` against a fresh database creates all 4 tables with correct constraints
2. The UNIQUE constraint on `apis(host, port, path, method)` prevents duplicate API entries
3. `client.js` exports `query()` and `pool` — works with DATABASE_URL env var
4. `seed.js` populates all tables with realistic demo data
5. After seeding, `SELECT count(*) FROM apis` returns 6
6. The `updated_at` trigger fires on API row updates

---

## Does NOT Include

- Docker/PostgreSQL container setup (Task 01)
- Backend Express server (Task 04)
- Any route or engine code
