# Task 05: Scanner Agents

> **Assignee:** Team Member 5
> **Dependencies:** Read `00-shared-contracts.md` first. Mock APIs (Task 02) should be running to test against.
> **Estimated Effort:** Medium
> **Files Owned:** `backend/src/scanners/networkScanner.js`, `backend/src/scanners/gatewayScanner.js`, `backend/src/scanners/gitScanner.js`, `backend/src/scanners/logAnalyzer.js`

---

## Objective

Build the four scanner agents that discover APIs from different sources. Each scanner is a standalone module that exports an async function returning an array of discovered endpoints. They do NOT write to the database — the orchestrator (Task 06) handles that.

---

## Common Interface

Every scanner must export a single async function with this signature:

```js
/**
 * @param {Object} options - Scanner-specific config
 * @returns {Promise<Array<{host, port, path, method, source, metadata}>>}
 */
module.exports = async function scannerName(options) {
  // ... scan logic ...
  return [
    {
      host: "localhost",
      port: 3013,
      path: "/api/v1/customers",
      method: "GET",
      source: "network",  // "network" | "gateway" | "git" | "traffic"
      metadata: { /* scanner-specific data */ }
    }
  ];
};
```

---

## Files to Create

### 1. `backend/src/scanners/networkScanner.js`

**Source:** Network / HTTP probing
**Purpose:** Find every API that responds on the network, regardless of documentation

```js
// Input options:
// {
//   host: "localhost",          // default from env SCAN_TARGET_HOST
//   ports: [3010, 3011, 3012, 3013, 3014, 3015],  // from env SCAN_PORT_RANGE
//   probePaths: ["/", "/health", "/api", "/api/v1", "/api/v2",
//                "/api/v1/accounts", "/api/v2/accounts", "/api/v1/customers",
//                "/api/v1/loans", "/api/v2/transfers", "/internal/debug/users"]
// }
//
// Algorithm:
// 1. For each port in the range:
//    a. Try HTTP GET to each probe path using axios (with timeout 2s)
//    b. If response status is 200 and Content-Type includes 'json':
//       → Add to results
//    c. Catch connection errors (ECONNREFUSED) → port not open, skip
//
// 2. Return discovered endpoints
//
// Metadata to capture per endpoint:
// {
//   httpStatus: 200,
//   contentType: "application/json",
//   hasAuthHeader: false,       // true if response included WWW-Authenticate
//   responseSize: 1234,         // bytes
//   serverHeader: "Express",    // from Server response header
//   responseTimeMs: 45          // latency
// }
//
// IMPORTANT: Use axios with short timeout (2000ms) to avoid hanging on closed ports
// IMPORTANT: Don't send auth headers — we want to test unauthenticated access

// Example result:
// [
//   { host: "localhost", port: 3013, path: "/api/v1/customers", method: "GET",
//     source: "network", metadata: { httpStatus: 200, contentType: "application/json", ... } },
//   ...
// ]
```

### 2. `backend/src/scanners/gatewayScanner.js`

**Source:** Nginx config file
**Purpose:** Find APIs officially registered in the API gateway

```js
// Input options:
// {
//   configPath: "./nginx/default.conf"  // from env NGINX_CONFIG_PATH
// }
//
// Algorithm:
// 1. Read the Nginx config file (fs.readFileSync)
// 2. Parse location blocks using regex:
//    Pattern: /location\s+(\/\S+)\s*\{[^}]*proxy_pass\s+(https?:\/\/[^;]+)/g
// 3. For each match, extract:
//    - path: the location path (e.g., "/api/v2/accounts")
//    - upstream: the proxy_pass target (e.g., "http://mock-active-1:3010")
//    - Parse host and port from upstream URL
// 4. Return array of gateway-registered endpoints
//
// Metadata:
// {
//   upstream: "http://mock-active-1:3010",
//   registeredInGateway: true
// }
//
// Expected results for our nginx config:
// - /api/v2/accounts  → port 3010 (active)
// - /api/v2/transfers → port 3011 (active)
// - /api/v1/accounts  → port 3012 (deprecated)
// NOT found: /api/v1/customers, /api/v1/loans, /internal/debug/users

// NOTE: For the demo, we parse the static config file.
// In production, this would call Kong Admin API:
//   GET http://kong:8001/routes
//   GET http://kong:8001/services
```

### 3. `backend/src/scanners/gitScanner.js`

**Source:** Source code in mock-apis/ directory
**Purpose:** Find API endpoints defined in code

```js
// Input options:
// {
//   scanDir: "./mock-apis"  // from env MOCK_APIS_DIR
// }
//
// Algorithm:
// 1. Read all .js files in the scan directory (fs.readdirSync + fs.readFileSync)
// 2. For each file, use regex to find Express route definitions:
//    Patterns:
//    - /app\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi
//    - /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi
// 3. Also extract the port from: app.listen(PORT) or similar patterns
//    Pattern: /listen\s*\(\s*(\d+)/
// 4. For each found route, record:
//    - method: GET/POST/etc.
//    - path: the route path
//    - file: source file name
//    - line number (count newlines up to match index)
//
// Metadata:
// {
//   file: "zombie-api.js",
//   lineNumber: 15,
//   definedInCode: true
// }
//
// Expected results:
// - active-api.js → GET /api/v2/accounts (port 3010)
// - active-api-2.js → GET /api/v2/transfers, POST /api/v2/transfers (port 3011)
// - deprecated-api.js → GET /api/v1/accounts (port 3012)
// - zombie-api.js → GET /api/v1/customers (port 3013)
// - zombie-api-2.js → GET /api/v1/loans (port 3014)
// - shadow-api.js → GET /internal/debug/users (port 3015)
//
// NOTE: The git scanner finds ALL APIs in code, including zombies.
// The key insight is that zombie APIs ARE in code (old code) but NOT in gateway.
// However, for classification purposes, what matters is whether the code is
// in the CURRENT active codebase vs. deleted/archived.
//
// For demo simplicity: finding a route in mock-apis/ counts as "in code".
// The classifier will use this combined with gateway presence to determine status.
```

### 4. `backend/src/scanners/logAnalyzer.js`

**Source:** Nginx access logs
**Purpose:** Find APIs that have actual traffic

```js
// Input options:
// {
//   logPath: "./nginx/access.log"  // from env NGINX_LOG_PATH
// }
//
// Algorithm:
// 1. Read the access log file
// 2. Parse each line using Combined Log Format regex:
//    Pattern: /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+) [^"]*" (\d+) (\d+)/
//    Groups: ip, timestamp, method, path, status, bytes
// 3. Group by method+path
// 4. For each unique endpoint, calculate:
//    - requestCount: total number of requests
//    - lastAccessed: most recent timestamp
//    - statusCodes: { 200: 45, 404: 2, ... }
//    - uniqueIPs: count of distinct source IPs
// 5. Return endpoints with traffic metadata
//
// Metadata:
// {
//   requestCount: 45,
//   lastAccessed: "2026-03-28T10:15:30Z",
//   statusCodes: { "200": 40, "304": 5 },
//   uniqueIPs: 8,
//   hasTraffic: true
// }
//
// Expected results (based on sample access.log from Task 01):
// - GET /api/v2/accounts  → high traffic (active)
// - POST /api/v2/transfers → high traffic (active)
// - GET /api/v1/accounts  → zero or near-zero traffic (deprecated)
// NOT found: zombie and shadow APIs (no traffic through gateway)
//
// EDGE CASE: If log file doesn't exist or is empty, return empty array (don't crash)
```

---

## Testing Each Scanner

You can test each scanner independently:

```js
// test-scanner.js (not committed, just for local testing)
require('dotenv').config();
const networkScanner = require('./src/scanners/networkScanner');

(async () => {
  const results = await networkScanner({
    host: 'localhost',
    ports: [3010, 3011, 3012, 3013, 3014, 3015],
  });
  console.log('Found:', results.length, 'endpoints');
  results.forEach(r => console.log(`  ${r.method} ${r.host}:${r.port}${r.path} [${r.source}]`));
})();
```

---

## Acceptance Criteria

1. Network scanner discovers all 6 mock APIs when they're running
2. Gateway scanner finds exactly 3 APIs (the ones in nginx config)
3. Git scanner finds route definitions in all 6 mock-api files
4. Log analyzer finds traffic for active APIs only (from sample access.log)
5. Each scanner returns results in the standard `{ host, port, path, method, source, metadata }` format
6. Scanners handle errors gracefully (unreachable ports, missing files) without crashing
7. Each scanner is independently testable

---

## Does NOT Include

- BullMQ job queue / orchestration (Task 06)
- Database writes (Task 06 handles upserting results)
- WebSocket events (Task 06 emits them)
- Classification logic (Task 07)
