# Task 02: Mock Bank APIs

> **Assignee:** Team Member 2
> **Dependencies:** Read `00-shared-contracts.md` first
> **Estimated Effort:** Small-Medium
> **Files Owned:** `mock-apis/active-api.js`, `mock-apis/active-api-2.js`, `mock-apis/deprecated-api.js`, `mock-apis/zombie-api.js`, `mock-apis/zombie-api-2.js`, `mock-apis/shadow-api.js`

---

## Objective

Build 6 Express mock API servers simulating a real bank's API landscape — from properly secured active APIs to completely unsecured zombie APIs leaking PII. These are the targets that the scanners will discover.

---

## Files to Create

### 1. `mock-apis/active-api.js` (Port 3010)

**Endpoint:** `GET /api/v2/accounts`
**Behavior:** Properly secured, well-maintained active API

```js
// Requirements:
// - Listen on port 3010
// - Require Authorization header: "Bearer valid-token-123"
//   - If missing/invalid → respond 401 { error: "Unauthorized" }
// - Rate limiting: max 20 requests per 10 seconds per IP
//   - Return 429 with Retry-After header when exceeded
//   - Include X-RateLimit-Remaining header on every response
// - Return sanitized data (NO raw PII):
//   {
//     accounts: [
//       { id: "ACC001", holder: "V****l K***r", type: "savings", balance: 45000.00, branch: "Mumbai Main" },
//       { id: "ACC002", holder: "P****a S***a", type: "current", balance: 125000.00, branch: "Delhi North" },
//       { id: "ACC003", holder: "R***h G***a", type: "savings", balance: 78500.00, branch: "Bangalore Central" }
//     ]
//   }
// - Set response headers:
//   Content-Type: application/json
//   X-API-Version: 2.0
//   X-RateLimit-Remaining: <count>

// Health endpoint: GET /health → { status: "ok", service: "accounts-v2" }
```

### 2. `mock-apis/active-api-2.js` (Port 3011)

**Endpoint:** `POST /api/v2/transfers`
**Behavior:** Properly secured, active transfer API

```js
// Requirements:
// - Listen on port 3011
// - Require Authorization header: "Bearer valid-token-123"
//   - If missing/invalid → respond 401 { error: "Unauthorized" }
// - Rate limiting: max 10 requests per 10 seconds per IP
// - Accept POST body: { from: "ACC001", to: "ACC002", amount: 5000 }
// - Return:
//   {
//     transfer_id: "TXN" + Date.now(),
//     status: "completed",
//     from: "ACC001",
//     to: "ACC002",
//     amount: 5000,
//     timestamp: new Date().toISOString()
//   }
// - Also support GET /api/v2/transfers for listing recent transfers:
//   {
//     transfers: [
//       { id: "TXN001", from: "ACC001", to: "ACC002", amount: 5000, status: "completed", date: "2026-03-28" },
//       { id: "TXN002", from: "ACC003", to: "ACC001", amount: 12000, status: "completed", date: "2026-03-27" }
//     ]
//   }

// Health endpoint: GET /health → { status: "ok", service: "transfers-v2" }
```

### 3. `mock-apis/deprecated-api.js` (Port 3012)

**Endpoint:** `GET /api/v1/accounts`
**Behavior:** Old API version — has auth but is no longer used, still registered in gateway

```js
// Requirements:
// - Listen on port 3012
// - Require Authorization header: "Bearer valid-token-123"
//   - If missing/invalid → respond 401 { error: "Unauthorized" }
// - NO rate limiting (was never added to v1)
// - NO HTTPS (HTTP only)
// - Return old-format data (slightly more verbose, but still sanitized):
//   {
//     version: "1.0",
//     data: {
//       accounts: [
//         { account_number: "XXXX-XXXX-1234", name: "Vipul Kumar", type: "savings", balance: "45,000.00", branch_code: "MUM001" },
//         { account_number: "XXXX-XXXX-5678", name: "Priya Sharma", type: "current", balance: "1,25,000.00", branch_code: "DEL002" }
//       ]
//     },
//     deprecated: true,
//     message: "This API version is deprecated. Please migrate to /api/v2/accounts"
//   }

// Health endpoint: GET /health → { status: "ok", service: "accounts-v1", deprecated: true }
```

### 4. `mock-apis/zombie-api.js` (Port 3013) -- CRITICAL

**Endpoint:** `GET /api/v1/customers`
**Behavior:** Zombie API — NO auth, returns raw PII, HTTP only, no rate limit

```js
// Requirements:
// - Listen on port 3013
// - NO authentication at all — responds to any request
// - NO rate limiting
// - NO HTTPS
// - Return FULL UNMASKED PII (this is the vulnerability):
//   {
//     customers: [
//       {
//         id: 1,
//         name: "Rajesh Kumar Sharma",
//         aadhaar: "2345 6789 0123",
//         pan: "ABCPK1234M",
//         phone: "9876543210",
//         email: "rajesh.sharma@email.com",
//         account_number: "1234567890123456",
//         address: "42 MG Road, Mumbai 400001",
//         dob: "1985-03-15"
//       },
//       {
//         id: 2,
//         name: "Priya Patel",
//         aadhaar: "3456 7890 1234",
//         pan: "BCDPP5678N",
//         phone: "8765432109",
//         email: "priya.patel@email.com",
//         account_number: "2345678901234567",
//         address: "15 Anna Salai, Chennai 600002",
//         dob: "1990-07-22"
//       },
//       {
//         id: 3,
//         name: "Amit Singh Rathore",
//         aadhaar: "4567 8901 2345",
//         pan: "CDERS9012P",
//         phone: "7654321098",
//         email: "amit.rathore@email.com",
//         account_number: "3456789012345678",
//         address: "78 Connaught Place, New Delhi 110001",
//         dob: "1988-11-30"
//       }
//     ]
//   }

// Also respond to GET /health → { status: "ok", service: "customers-v1" }
// NOTE: This has NO security headers, NO CORS restrictions
```

### 5. `mock-apis/zombie-api-2.js` (Port 3014)

**Endpoint:** `GET /api/v1/loans`
**Behavior:** Another zombie — NO auth, returns loan data with PII

```js
// Requirements:
// - Listen on port 3014
// - NO authentication
// - NO rate limiting
// - NO HTTPS
// - Return loan data with PII:
//   {
//     loans: [
//       {
//         loan_id: "LN001",
//         borrower: "Rajesh Kumar Sharma",
//         aadhaar: "2345 6789 0123",
//         account_number: "1234567890123456",
//         loan_type: "home",
//         amount: 3500000,
//         emi: 28500,
//         outstanding: 2800000,
//         status: "active",
//         disbursement_date: "2022-06-15"
//       },
//       {
//         loan_id: "LN002",
//         borrower: "Sunita Devi",
//         aadhaar: "5678 9012 3456",
//         account_number: "4567890123456789",
//         loan_type: "personal",
//         amount: 500000,
//         emi: 12500,
//         outstanding: 375000,
//         status: "active",
//         disbursement_date: "2023-01-10"
//       }
//     ]
//   }

// Health endpoint: GET /health → { status: "ok", service: "loans-v1" }
```

### 6. `mock-apis/shadow-api.js` (Port 3015)

**Endpoint:** `GET /internal/debug/users`
**Behavior:** Shadow API — undocumented debug endpoint, no auth, returns everything

```js
// Requirements:
// - Listen on port 3015
// - NO authentication
// - NO rate limiting
// - NO HTTPS
// - Return debug dump with sensitive data:
//   {
//     _debug: true,
//     _warning: "INTERNAL USE ONLY",
//     users: [
//       {
//         id: 1,
//         username: "admin",
//         password_hash: "$2b$10$abcdef1234567890abcdef",
//         role: "superadmin",
//         name: "System Admin",
//         email: "admin@bank.internal",
//         phone: "9999999999",
//         last_login: "2025-12-01T10:00:00Z",
//         api_keys: ["sk-live-abc123", "sk-test-xyz789"]
//       },
//       {
//         id: 2,
//         username: "rksharma",
//         password_hash: "$2b$10$ghijkl1234567890ghijkl",
//         role: "branch_manager",
//         name: "Rajesh Kumar Sharma",
//         email: "rajesh.sharma@bank.internal",
//         phone: "9876543210",
//         aadhaar: "2345 6789 0123",
//         pan: "ABCPK1234M",
//         last_login: "2026-03-15T14:30:00Z"
//       }
//     ],
//     db_config: {
//       host: "db-primary.bank.internal",
//       port: 5432,
//       database: "core_banking",
//       username: "app_user"
//     }
//   }

// Also respond to GET /health → { status: "ok", service: "debug-users" }
// Also respond to GET / → same data (root path also exposes it)
```

---

## Implementation Notes

- Each file is a standalone Express app — minimal, no shared code needed
- Use simple in-memory rate limiting for active APIs (no Redis needed):
  ```js
  const rateLimit = {};
  function checkRateLimit(ip, max, windowMs) {
    const now = Date.now();
    if (!rateLimit[ip] || now - rateLimit[ip].start > windowMs) {
      rateLimit[ip] = { start: now, count: 1 };
      return true;
    }
    rateLimit[ip].count++;
    return rateLimit[ip].count <= max;
  }
  ```
- PII data should use realistic Indian formats (Aadhaar: 4-4-4 digits, PAN: 5 letters + 4 digits + 1 letter)
- All APIs should also respond to `GET /` with a basic info/health response so the network scanner can discover them

---

## Acceptance Criteria

1. Each API starts on its designated port
2. Active APIs (3010, 3011) reject requests without auth header with 401
3. Active APIs return 429 after exceeding rate limit
4. Zombie APIs (3013, 3014) return full data with NO auth required
5. Shadow API (3015) returns debug data with passwords, API keys, PII
6. Deprecated API (3012) requires auth but has no rate limiting
7. All APIs respond to GET /health
8. PII in zombie/shadow responses matches regex patterns:
   - Aadhaar: `\d{4}\s\d{4}\s\d{4}`
   - PAN: `[A-Z]{5}\d{4}[A-Z]`
   - Phone: `[6-9]\d{9}`
   - Email: standard email regex

---

## Does NOT Include

- Docker configuration (Task 01)
- Nginx gateway config (Task 01)
- Scanner code that discovers these APIs (Tasks 05)
