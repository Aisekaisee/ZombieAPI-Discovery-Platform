# Task 00: Shared Contracts & Data Types (READ-ONLY REFERENCE)

> **This file is NOT a build task.** It is the single source of truth for all data structures, API contracts, and interfaces. Every other task file references this. Read this first before starting any task.

---

## Database Schema

### Table: `apis`

```sql
CREATE TABLE apis (
  id            SERIAL PRIMARY KEY,
  path          VARCHAR(500) NOT NULL,
  method        VARCHAR(10) NOT NULL DEFAULT 'GET',
  host          VARCHAR(255) NOT NULL,
  port          INTEGER NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN'
                CHECK (status IN ('ACTIVE','DEPRECATED','ZOMBIE','SHADOW','ORPHANED','UNKNOWN')),
  risk_score    INTEGER DEFAULT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  owner         VARCHAR(255) DEFAULT NULL,
  discovery_sources JSONB DEFAULT '[]',
  last_called_at    TIMESTAMPTZ DEFAULT NULL,
  auth_check        BOOLEAN DEFAULT NULL,
  https_check       BOOLEAN DEFAULT NULL,
  rate_limit_check  BOOLEAN DEFAULT NULL,
  pii_check         BOOLEAN DEFAULT NULL,
  pii_types         JSONB DEFAULT '[]',
  decommission_status VARCHAR(20) DEFAULT NULL
                CHECK (decommission_status IN ('PENDING','APPROVED','BLOCKED','HONEYPOT', NULL)),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(host, port, path, method)
);
```

### Table: `scan_runs`

```sql
CREATE TABLE scan_runs (
  id            SERIAL PRIMARY KEY,
  type          VARCHAR(30) NOT NULL
                CHECK (type IN ('network-scan','gateway-scan','git-scan','log-scan','full-scan')),
  status        VARCHAR(20) NOT NULL DEFAULT 'RUNNING'
                CHECK (status IN ('RUNNING','COMPLETED','FAILED')),
  apis_found    INTEGER DEFAULT 0,
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  completed_at  TIMESTAMPTZ DEFAULT NULL
);
```

### Table: `security_findings`

```sql
CREATE TABLE security_findings (
  id              SERIAL PRIMARY KEY,
  api_id          INTEGER NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
  tool            VARCHAR(50) NOT NULL,
  severity        VARCHAR(20) NOT NULL CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  owasp_category  VARCHAR(100) DEFAULT NULL,
  description     TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `audit_logs`

```sql
CREATE TABLE audit_logs (
  id            SERIAL PRIMARY KEY,
  api_id        INTEGER REFERENCES apis(id) ON DELETE SET NULL,
  action        VARCHAR(50) NOT NULL,
  old_value     JSONB DEFAULT NULL,
  new_value     JSONB DEFAULT NULL,
  performed_by  VARCHAR(255) DEFAULT 'system',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

**Valid `action` values:** `DISCOVERED`, `STATUS_CHANGED`, `SECURITY_ASSESSED`, `DECOMMISSION_INITIATED`, `DECOMMISSION_APPROVED`, `BLOCKED`, `HONEYPOT_ACTIVATED`, `OWNER_ASSIGNED`

---

## Data Types (JS Objects)

### API Object (returned by GET /api/apis/:id)

```js
{
  id: 1,
  path: "/api/v1/customers",
  method: "GET",
  host: "localhost",
  port: 3013,
  status: "ZOMBIE",           // ACTIVE | DEPRECATED | ZOMBIE | SHADOW | ORPHANED | UNKNOWN
  risk_score: 5,              // 0-100, null if not assessed
  owner: null,                // string or null
  discovery_sources: ["network", "git"],  // array of: "network", "gateway", "git", "traffic"
  last_called_at: null,       // ISO timestamp or null
  auth_check: false,          // true=pass, false=fail, null=not checked
  https_check: false,
  rate_limit_check: false,
  pii_check: true,            // true = PII found (bad)
  pii_types: ["aadhaar", "pan", "phone"],
  decommission_status: null,  // PENDING | APPROVED | BLOCKED | HONEYPOT | null
  created_at: "2026-03-29T...",
  updated_at: "2026-03-29T..."
}
```

### Scanner Result Object (returned by each scanner)

```js
{
  host: "localhost",
  port: 3013,
  path: "/api/v1/customers",
  method: "GET",
  source: "network",         // "network" | "gateway" | "git" | "traffic"
  metadata: {                // source-specific extra data
    httpStatus: 200,
    contentType: "application/json",
    // ... varies by scanner
  }
}
```

### Scan Run Object

```js
{
  id: 1,
  type: "full-scan",
  status: "COMPLETED",
  apis_found: 6,
  started_at: "2026-03-29T...",
  completed_at: "2026-03-29T..."
}
```

### Security Finding Object

```js
{
  id: 1,
  api_id: 3,
  tool: "zombieguard-auth-check",  // or "zap", "zombieguard-pii-check", etc.
  severity: "CRITICAL",
  owasp_category: "API9:2023",
  description: "Endpoint returns 200 with full response body when no auth header is sent",
  created_at: "2026-03-29T..."
}
```

### Audit Log Object

```js
{
  id: 1,
  api_id: 3,
  action: "BLOCKED",
  old_value: { status: "ZOMBIE" },
  new_value: { status: "ZOMBIE", decommission_status: "BLOCKED" },
  performed_by: "system",
  created_at: "2026-03-29T..."
}
```

---

## REST API Contracts

### Scan Routes (owned by Task 06)

| Method | Path | Request Body | Response |
|--------|------|-------------|----------|
| POST | `/api/scans/run` | `{}` | `{ jobId: "abc", message: "Full scan started" }` |
| POST | `/api/scans/run/:type` | `{}` | `{ jobId: "abc", message: "Network scan started" }` |
| GET | `/api/scans/status` | — | `{ running: true, type: "full-scan", progress: { network: "completed", git: "running", ... } }` |
| GET | `/api/scans/history` | query: `?page=1&limit=20` | `{ data: [ScanRun], total: 5, page: 1 }` |

### API Registry Routes (owned by Task 08)

| Method | Path | Request Body | Response |
|--------|------|-------------|----------|
| GET | `/api/apis` | query: `?status=ZOMBIE&risk=critical&search=customers&page=1&limit=20` | `{ data: [API], total: 50, page: 1 }` |
| GET | `/api/apis/:id` | — | `API` object |
| GET | `/api/apis/zombies` | — | `{ data: [API] }` |
| GET | `/api/apis/shadow` | — | `{ data: [API] }` |
| PATCH | `/api/apis/:id/status` | `{ status: "DEPRECATED", performed_by: "admin" }` | `{ success: true, api: API }` |

### Security Routes (owned by Task 08)

| Method | Path | Request Body | Response |
|--------|------|-------------|----------|
| POST | `/api/security/assess/:id` | `{}` | `{ api_id: 1, risk_score: 15, checks: { auth: false, https: false, rate_limit: false, pii: true } }` |
| GET | `/api/security/findings` | query: `?severity=CRITICAL&tool=zap` | `{ data: [SecurityFinding] }` |
| GET | `/api/security/findings/:apiId` | — | `{ data: [SecurityFinding] }` |

### Decommission Routes (owned by Task 09)

| Method | Path | Request Body | Response |
|--------|------|-------------|----------|
| POST | `/api/decommission/:id/initiate` | `{ mode: "auto"\|"assisted"\|"honeypot", performed_by: "admin" }` | `{ success: true, status: "BLOCKED"\|"PENDING"\|"HONEYPOT", dependents: [] }` |
| POST | `/api/decommission/:id/approve` | `{ performed_by: "admin" }` | `{ success: true, status: "APPROVED" }` |
| POST | `/api/decommission/:id/block` | `{ performed_by: "admin" }` | `{ success: true, status: "BLOCKED" }` |
| POST | `/api/decommission/:id/honeypot` | `{ performed_by: "admin" }` | `{ success: true, status: "HONEYPOT" }` |
| GET | `/api/decommission/queue` | — | `{ data: [{ api: API, requested_at, requested_by }] }` |

### Stats Routes (owned by Task 08)

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/stats/overview` | `{ total: 6, active: 2, deprecated: 1, zombie: 2, shadow: 1, orphaned: 0, avg_risk: 45, critical_count: 2 }` |
| GET | `/api/stats/trend` | `{ data: [{ scan_id, date, total_apis, zombies, avg_risk }] }` |
| GET | `/api/stats/risk` | `{ distribution: { low: 2, medium: 1, high: 0, critical: 3 } }` |

---

## WebSocket Events

Connection: `socket.io` on the backend server (port 3000)

| Event | Direction | Payload |
|-------|-----------|---------|
| `scan:started` | server → client | `{ jobId, type, startedAt }` |
| `scan:progress` | server → client | `{ jobId, scanner: "network", status: "running"\|"completed", found: 3 }` |
| `scan:completed` | server → client | `{ jobId, type, totalFound: 6, duration: 12000 }` |
| `scan:error` | server → client | `{ jobId, error: "message" }` |
| `api:classified` | server → client | `{ summary: { ACTIVE: 2, ZOMBIE: 2, ... } }` |
| `api:assessed` | server → client | `{ api_id, risk_score }` |
| `decommission:update` | server → client | `{ api_id, status: "BLOCKED" }` |

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://zombieguard:zombieguard@localhost:5432/zombieguard
PGHOST=localhost
PGPORT=5432
PGUSER=zombieguard
PGPASSWORD=zombieguard
PGDATABASE=zombieguard

# Redis
REDIS_URL=redis://localhost:6379

# Backend
PORT=3000
NODE_ENV=development

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=http://localhost:3000

# Mock API ports
MOCK_ACTIVE_1_PORT=3010
MOCK_ACTIVE_2_PORT=3011
MOCK_DEPRECATED_PORT=3012
MOCK_ZOMBIE_1_PORT=3013
MOCK_ZOMBIE_2_PORT=3014
MOCK_SHADOW_PORT=3015

# OWASP ZAP (optional)
ZAP_API_URL=http://localhost:8080
ZAP_API_KEY=zombieguard-zap-key

# Scan config
SCAN_TARGET_HOST=localhost
SCAN_PORT_RANGE=3010-3015
NGINX_CONFIG_PATH=./nginx/default.conf
NGINX_LOG_PATH=./nginx/access.log
MOCK_APIS_DIR=./mock-apis
```

---

## Risk Score Mapping

```
80-100  → Low Risk      (green)
50-79   → Medium Risk   (yellow)
20-49   → High Risk     (orange)
0-19    → Critical Risk (red)
```

---

## Classification Logic

```
if (inGateway && inCode && hasTraffic)     → ACTIVE
if (inGateway && inCode && !hasTraffic)    → DEPRECATED
if (!inGateway && !inCode && hasTraffic)   → SHADOW
if (!inGateway && !inCode && !hasTraffic)  → ZOMBIE  (but responds to network scan)
if (inGateway && !inCode && !hasTraffic)   → ORPHANED
```

Source mapping:
- `inGateway` = `"gateway"` in discovery_sources
- `inCode` = `"git"` in discovery_sources
- `hasTraffic` = `"traffic"` in discovery_sources

---

## Mock API Expected Behaviors

| Port | Path | Auth | PII | HTTPS | Rate Limit | Expected Status | Expected Risk |
|------|------|------|-----|-------|------------|----------------|--------------|
| 3010 | /api/v2/accounts | Yes (Bearer) | No | Yes | Yes | ACTIVE | 85-100 (Low) |
| 3011 | /api/v2/transfers | Yes (Bearer) | No | Yes | Yes | ACTIVE | 85-100 (Low) |
| 3012 | /api/v1/accounts | Yes (Bearer) | No | No | No | DEPRECATED | 50-65 (Medium) |
| 3013 | /api/v1/customers | No | Yes (Aadhaar, PAN, Phone) | No | No | ZOMBIE | 0-10 (Critical) |
| 3014 | /api/v1/loans | No | Yes (Aadhaar, Account#) | No | No | ZOMBIE | 0-10 (Critical) |
| 3015 | /internal/debug/users | No | Yes (Everything) | No | No | SHADOW | 0-10 (Critical) |

---

## NPM Packages

### Backend (`backend/package.json`)
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "pg": "^8.12.0",
    "bullmq": "^5.0.0",
    "ioredis": "^5.3.0",
    "socket.io": "^4.7.0",
    "node-cron": "^3.0.0",
    "cors": "^2.8.0",
    "dotenv": "^16.3.0",
    "axios": "^1.6.0"
  }
}
```

### Frontend (`frontend/package.json`)
```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "recharts": "^2.10.0",
    "reactflow": "^11.10.0",
    "socket.io-client": "^4.7.0",
    "tailwindcss": "^3.4.0",
    "@radix-ui/react-slot": "latest",
    "class-variance-authority": "latest",
    "clsx": "latest",
    "tailwind-merge": "latest",
    "lucide-react": "latest",
    "swr": "^2.2.0"
  }
}
```
