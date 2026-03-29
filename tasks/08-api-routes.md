# Task 08: API Registry, Security & Stats Routes

> **Assignee:** Team Member 8
> **Dependencies:** Read `00-shared-contracts.md`. Needs Task 03 (db client), Task 04 (backend core).
> **Estimated Effort:** Medium
> **Files Owned:** `backend/src/routes/apis.js`, `backend/src/routes/security.js`, `backend/src/routes/stats.js`

---

## Objective

Build the REST API routes for the API registry (CRUD), security findings, and dashboard statistics. These routes read from and write to the database — they call into engine modules from Task 07 for security assessments.

---

## Files to Create

### 1. `backend/src/routes/apis.js`

```js
// Express router for API registry operations
// const router = require('express').Router();
// const db = require('../db/client');
// const auditLogger = require('../engine/auditLogger');

// ─── GET /api/apis ───────────────────────────────────────────
// List all APIs with filtering, search, and pagination
//
// Query params:
//   ?status=ZOMBIE          Filter by status (ACTIVE, DEPRECATED, ZOMBIE, SHADOW, ORPHANED)
//   ?risk=critical          Filter by risk level (low, medium, high, critical)
//   ?search=customers       Search in path field (ILIKE)
//   ?page=1&limit=20        Pagination
//   ?sort=risk_score&order=asc   Sort field and direction
//
// Build dynamic SQL:
//   let query = 'SELECT * FROM apis WHERE 1=1';
//   const params = [];
//   if (status) { query += ` AND status = $${params.push(status)}`; }
//   if (risk) {
//     // Map risk level to score range
//     const ranges = { critical: [0,19], high: [20,49], medium: [50,79], low: [80,100] };
//     const [min, max] = ranges[risk];
//     query += ` AND risk_score >= $${params.push(min)} AND risk_score <= $${params.push(max)}`;
//   }
//   if (search) { query += ` AND path ILIKE $${params.push('%' + search + '%')}`; }
//   // Add ORDER BY, LIMIT, OFFSET
//
// Response: { data: [API], total: number, page: number }

// ─── GET /api/apis/zombies ───────────────────────────────────
// Shortcut for status=ZOMBIE, sorted by risk_score ASC (worst first)
//
// SELECT * FROM apis WHERE status = 'ZOMBIE' ORDER BY risk_score ASC

// ─── GET /api/apis/shadow ────────────────────────────────────
// Shortcut for status=SHADOW
//
// SELECT * FROM apis WHERE status = 'SHADOW' ORDER BY risk_score ASC

// ─── GET /api/apis/:id ──────────────────────────────────────
// Single API with full detail
//
// Also fetch related data:
//   const api = await db.query('SELECT * FROM apis WHERE id = $1', [id]);
//   const findings = await db.query('SELECT * FROM security_findings WHERE api_id = $1 ORDER BY severity', [id]);
//   const auditLogs = await db.query('SELECT * FROM audit_logs WHERE api_id = $1 ORDER BY created_at DESC LIMIT 20', [id]);
//
// Response: { ...api, findings: [...], audit_logs: [...] }

// ─── PATCH /api/apis/:id/status ─────────────────────────────
// Manually update API status
//
// Request body: { status: "DEPRECATED", performed_by: "admin" }
// Validate status is valid enum value
//
// 1. Get current API
// 2. Update status
// 3. Create audit log entry
// 4. Return updated API
//
// Response: { success: true, api: API }

// IMPORTANT: Define /api/apis/zombies and /api/apis/shadow BEFORE /api/apis/:id
// Otherwise Express will treat "zombies" and "shadow" as :id parameters

// module.exports = router;
```

### 2. `backend/src/routes/security.js`

```js
// Express router for security operations
// const router = require('express').Router();
// const db = require('../db/client');

// ─── POST /api/security/assess/:id ──────────────────────────
// Run security assessment on a single API
//
// 1. Try to import securityRunner from Task 07:
//    const securityRunner = require('../engine/securityRunner');
// 2. Run assessment:
//    const result = await securityRunner.assessOne(parseInt(req.params.id));
// 3. Emit WebSocket event:
//    req.app.get('io').emit('api:assessed', { api_id: result.api_id, risk_score: result.risk_score });
// 4. Return result
//
// Handle case where Task 07 module doesn't exist yet (try/catch)
//
// Response: { api_id, risk_score, checks: { auth, https, rate_limit, pii } }

// ─── GET /api/security/findings ──────────────────────────────
// List all security findings with optional filters
//
// Query params:
//   ?severity=CRITICAL     Filter by severity
//   ?tool=zap              Filter by tool
//   ?page=1&limit=50       Pagination
//
// Join with apis table to include API path info:
//   SELECT sf.*, a.path, a.method, a.host, a.port
//   FROM security_findings sf
//   JOIN apis a ON sf.api_id = a.id
//   WHERE 1=1 ...
//
// Response: { data: [FindingWithApiInfo], total, page }

// ─── GET /api/security/findings/:apiId ───────────────────────
// Findings for a specific API
//
// SELECT * FROM security_findings WHERE api_id = $1 ORDER BY severity, created_at DESC
//
// Response: { data: [SecurityFinding] }

// module.exports = router;
```

### 3. `backend/src/routes/stats.js`

```js
// Express router for dashboard statistics
// const router = require('express').Router();
// const db = require('../db/client');

// ─── GET /api/stats/overview ─────────────────────────────────
// Counts by status, average risk score, critical count
//
// Queries:
//   SELECT status, count(*) as count FROM apis GROUP BY status
//   SELECT avg(risk_score) as avg_risk FROM apis WHERE risk_score IS NOT NULL
//   SELECT count(*) as critical_count FROM apis WHERE risk_score IS NOT NULL AND risk_score < 20
//   SELECT count(*) as total FROM apis
//
// Response:
// {
//   total: 6,
//   active: 2,
//   deprecated: 1,
//   zombie: 2,
//   shadow: 1,
//   orphaned: 0,
//   avg_risk: 40.8,
//   critical_count: 3
// }

// ─── GET /api/stats/trend ────────────────────────────────────
// Discovery counts and risk scores over time (per scan run)
//
// Query:
//   SELECT sr.id as scan_id, sr.started_at as date, sr.apis_found as total_apis,
//     (SELECT count(*) FROM apis WHERE status = 'ZOMBIE') as zombies,
//     (SELECT avg(risk_score) FROM apis WHERE risk_score IS NOT NULL) as avg_risk
//   FROM scan_runs sr
//   WHERE sr.status = 'COMPLETED'
//   ORDER BY sr.started_at DESC
//   LIMIT 20
//
// Response: { data: [{ scan_id, date, total_apis, zombies, avg_risk }] }

// ─── GET /api/stats/risk ─────────────────────────────────────
// Risk score distribution
//
// Query:
//   SELECT
//     count(*) FILTER (WHERE risk_score >= 80) as low,
//     count(*) FILTER (WHERE risk_score >= 50 AND risk_score < 80) as medium,
//     count(*) FILTER (WHERE risk_score >= 20 AND risk_score < 50) as high,
//     count(*) FILTER (WHERE risk_score < 20) as critical
//   FROM apis
//   WHERE risk_score IS NOT NULL
//
// Response: { distribution: { low: 2, medium: 1, high: 0, critical: 3 } }

// module.exports = router;
```

---

## Acceptance Criteria

1. `GET /api/apis` returns paginated list, filterable by status, risk, and search
2. `GET /api/apis/zombies` returns only ZOMBIE APIs sorted by risk (worst first)
3. `GET /api/apis/:id` returns full API detail including findings and audit logs
4. `PATCH /api/apis/:id/status` updates status and creates audit log
5. `POST /api/security/assess/:id` runs security checks and returns risk score
6. `GET /api/security/findings` returns findings with API metadata, filterable
7. `GET /api/stats/overview` returns correct counts matching actual database state
8. `GET /api/stats/risk` returns correct distribution of risk scores
9. All routes handle missing/invalid IDs with proper 404 responses
10. Routes work even if engine modules (Task 07) aren't available yet

---

## Does NOT Include

- Security check implementations (Task 07)
- Scan routes (Task 06)
- Decommission routes (Task 09)
- Database schema (Task 03)
