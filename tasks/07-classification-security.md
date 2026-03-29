# Task 07: Classification Engine, Security Checks & Risk Scorer

> **Assignee:** Team Member 7
> **Dependencies:** Read `00-shared-contracts.md`. Needs Task 03 (db client). Mock APIs (Task 02) should be running for security check testing.
> **Estimated Effort:** Medium-Large
> **Files Owned:**
> - `backend/src/engine/classifier.js`
> - `backend/src/engine/riskScorer.js`
> - `backend/src/engine/securityRunner.js`
> - `backend/src/engine/securityChecks/authCheck.js`
> - `backend/src/engine/securityChecks/httpsCheck.js`
> - `backend/src/engine/securityChecks/rateLimitCheck.js`
> - `backend/src/engine/securityChecks/piiCheck.js`
> - `backend/src/engine/zapIntegration.js`
> - `backend/src/engine/auditLogger.js`

---

## Objective

Build the brain of ZombieGuard — the classification engine that determines API status, the security checks that probe each API's posture, and the risk scorer that computes a 0-100 score.

---

## Files to Create

### 1. `backend/src/engine/classifier.js`

```js
// Classifies all APIs based on their discovery sources.
// Export: classifyAll() and classifySingle(apiId)

// const db = require('../db/client');
// const auditLogger = require('./auditLogger');

// async function classifyAll() {
//   const { rows: apis } = await db.query('SELECT * FROM apis');
//   const summary = { ACTIVE: 0, DEPRECATED: 0, ZOMBIE: 0, SHADOW: 0, ORPHANED: 0 };
//
//   for (const api of apis) {
//     const sources = api.discovery_sources || [];
//     const inGateway = sources.includes('gateway');
//     const inCode = sources.includes('git');
//     const hasTraffic = sources.includes('traffic');
//
//     let newStatus;
//     if (inGateway && inCode && hasTraffic)      newStatus = 'ACTIVE';
//     else if (inGateway && inCode && !hasTraffic) newStatus = 'DEPRECATED';
//     else if (!inGateway && !inCode && hasTraffic) newStatus = 'SHADOW';
//     else if (inGateway && !inCode && !hasTraffic) newStatus = 'ORPHANED';
//     else if (!inGateway && inCode && hasTraffic)  newStatus = 'ACTIVE';  // in code + traffic = active even without gateway
//     else if (!inGateway && inCode && !hasTraffic) newStatus = 'DEPRECATED'; // in code but no traffic/gateway
//     else if (inGateway && !inCode && hasTraffic)  newStatus = 'ORPHANED';  // in gateway with traffic but no code
//     else newStatus = 'ZOMBIE';  // responds to network scan but not in gateway, code, or traffic
//
//     if (api.status !== newStatus) {
//       const oldStatus = api.status;
//       await db.query('UPDATE apis SET status = $1 WHERE id = $2', [newStatus, api.id]);
//       await auditLogger.log({
//         api_id: api.id,
//         action: 'STATUS_CHANGED',
//         old_value: { status: oldStatus },
//         new_value: { status: newStatus },
//         performed_by: 'classifier'
//       });
//     }
//     summary[newStatus] = (summary[newStatus] || 0) + 1;
//   }
//
//   return summary;
// }
//
// module.exports = { classifyAll, classifySingle };
```

**Expected classification for our mock APIs:**

| API | Sources | Status |
|-----|---------|--------|
| /api/v2/accounts (3010) | network, gateway, git, traffic | ACTIVE |
| /api/v2/transfers (3011) | network, gateway, git, traffic | ACTIVE |
| /api/v1/accounts (3012) | network, gateway, git | DEPRECATED |
| /api/v1/customers (3013) | network, git | ZOMBIE* |
| /api/v1/loans (3014) | network, git | ZOMBIE* |
| /internal/debug/users (3015) | network, traffic | SHADOW |

*Note: The zombie APIs are found by network scanner and git scanner (code exists in mock-apis/) but NOT in gateway and NOT in traffic. With the classification logic above, `!inGateway && inCode && !hasTraffic` maps to DEPRECATED. To make them classify as ZOMBIE, either:
- Don't count mock-apis/ files as "inCode" for these (treat only actively maintained code as "in code")
- OR adjust classification: if inCode but NOT inGateway AND NOT in traffic AND responds on network → ZOMBIE
- **Recommended approach:** Add a heuristic — if the file path contains "zombie" or the route is /v1/ and there's a /v2/ equivalent, treat as ZOMBIE. Or simpler: let the git scanner mark old/unmaintained files differently in metadata.

**Simplest fix for demo:** Have the git scanner only scan files that represent "active" code (active-api.js, active-api-2.js, deprecated-api.js) and NOT zombie/shadow files. This simulates the real scenario where zombie code has been deleted from the main codebase.

### 2. `backend/src/engine/securityChecks/authCheck.js`

```js
// Check if an API requires authentication
// Export: async function checkAuth(host, port, path)
// Returns: { passed: boolean, details: string }

// Algorithm:
// 1. Send GET request to http://{host}:{port}{path} with NO auth header
// 2. If response is 401 or 403 → passed: true (auth required)
// 3. If response is 200 with body data → passed: false (no auth!)
// 4. If connection error → passed: null (inconclusive)
//
// Use axios with timeout 3000ms
// Return: { passed: true/false/null, details: "Returns 200 with data without authentication" }
```

### 3. `backend/src/engine/securityChecks/httpsCheck.js`

```js
// Check if an API supports HTTPS
// Export: async function checkHttps(host, port, path)
// Returns: { passed: boolean, details: string }

// Algorithm:
// 1. Try HTTPS request to https://{host}:{port}{path}
// 2. If successful → passed: true
// 3. If fails (ECONNREFUSED, self-signed cert error) → passed: false
//
// For demo: all mock APIs run HTTP only, so this will return false for all.
// Active APIs would normally have HTTPS in production — we'll flag this but
// the risk scorer can give partial credit if the API is behind the Nginx gateway
// (which could terminate TLS).
//
// Simplified for demo: check if port is behind Nginx (gateway-registered).
// If yes → passed: true (gateway handles TLS). If no → passed: false.
```

### 4. `backend/src/engine/securityChecks/rateLimitCheck.js`

```js
// Check if an API has rate limiting
// Export: async function checkRateLimit(host, port, path)
// Returns: { passed: boolean, details: string }

// Algorithm:
// 1. Send 25 rapid requests to http://{host}:{port}{path}
//    (Use Promise.all for parallel requests, or a tight loop)
// 2. Check if any response has status 429
// 3. Check for rate limit headers: X-RateLimit-Remaining, Retry-After
// 4. If 429 received OR rate limit headers present → passed: true
// 5. If all 25 return 200 → passed: false (no rate limiting)
//
// IMPORTANT: Use a reasonable burst (25, not 100) to keep demo fast
// IMPORTANT: Requests may return 401 if auth is required — that's okay,
//   rate limiting should apply regardless of auth status
```

### 5. `backend/src/engine/securityChecks/piiCheck.js`

```js
// Scan API response for PII (Personally Identifiable Information)
// Export: async function checkPii(host, port, path)
// Returns: { found: boolean, types: string[], details: string }

// Algorithm:
// 1. Send GET request to http://{host}:{port}{path} (no auth)
// 2. If 200, get response body as string
// 3. Scan with regex patterns for Indian PII:
//
//    const patterns = {
//      aadhaar:        /\d{4}\s\d{4}\s\d{4}/g,
//      pan:            /[A-Z]{5}\d{4}[A-Z]/g,
//      phone:          /[6-9]\d{9}/g,
//      email:          /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
//      account_number: /\d{12,18}/g,                    // 12-18 digit numbers
//      // cvv:         /\b\d{3}\b/g,                    // too many false positives
//    };
//
// 4. For each pattern, if matches found → add to types array
// 5. Return { found: types.length > 0, types, details: `Found: ${types.join(', ')}` }
//
// If response is 401/403 (auth required), return { found: false, types: [], details: "Auth required - cannot scan" }
// This is actually GOOD — means PII is protected behind auth
```

### 6. `backend/src/engine/securityRunner.js`

```js
// Orchestrates all security checks for one or all APIs
// Export: assessAll() and assessOne(apiId)

// const db = require('../db/client');
// const authCheck = require('./securityChecks/authCheck');
// const httpsCheck = require('./securityChecks/httpsCheck');
// const rateLimitCheck = require('./securityChecks/rateLimitCheck');
// const piiCheck = require('./securityChecks/piiCheck');
// const riskScorer = require('./riskScorer');
// const auditLogger = require('./auditLogger');

// async function assessOne(apiId) {
//   const { rows: [api] } = await db.query('SELECT * FROM apis WHERE id = $1', [apiId]);
//   if (!api) throw new Error('API not found');
//
//   // Run all checks
//   const auth = await authCheck(api.host, api.port, api.path);
//   const https = await httpsCheck(api.host, api.port, api.path);
//   const rateLimit = await rateLimitCheck(api.host, api.port, api.path);
//   const pii = await piiCheck(api.host, api.port, api.path);
//
//   // Update API record
//   await db.query(
//     `UPDATE apis SET auth_check = $1, https_check = $2, rate_limit_check = $3,
//      pii_check = $4, pii_types = $5 WHERE id = $6`,
//     [auth.passed, https.passed, rateLimit.passed, pii.found, JSON.stringify(pii.types), apiId]
//   );
//
//   // Store security findings
//   if (!auth.passed) await insertFinding(apiId, 'zombieguard-auth-check', 'CRITICAL', 'API1:2023', auth.details);
//   if (!https.passed) await insertFinding(apiId, 'zombieguard-https-check', 'HIGH', 'API8:2023', https.details);
//   if (!rateLimit.passed) await insertFinding(apiId, 'zombieguard-ratelimit-check', 'MEDIUM', 'API4:2023', rateLimit.details);
//   if (pii.found) await insertFinding(apiId, 'zombieguard-pii-check', 'CRITICAL', 'API3:2023', pii.details);
//
//   // Calculate risk score
//   const riskScore = await riskScorer.calculate(apiId);
//
//   // Audit log
//   await auditLogger.log({ api_id: apiId, action: 'SECURITY_ASSESSED', new_value: { risk_score: riskScore } });
//
//   return { api_id: apiId, risk_score: riskScore, checks: { auth: auth.passed, https: https.passed, rate_limit: rateLimit.passed, pii: pii.found } };
// }
//
// async function assessAll() {
//   const { rows: apis } = await db.query('SELECT id FROM apis');
//   const results = [];
//   for (const api of apis) {
//     try {
//       results.push(await assessOne(api.id));
//     } catch (e) {
//       console.error(`Assessment failed for API ${api.id}:`, e.message);
//     }
//   }
//   return results;
// }
//
// async function insertFinding(apiId, tool, severity, owasp, description) {
//   // Check if finding already exists (avoid duplicates)
//   const existing = await db.query(
//     'SELECT id FROM security_findings WHERE api_id = $1 AND tool = $2', [apiId, tool]
//   );
//   if (existing.rows.length === 0) {
//     await db.query(
//       'INSERT INTO security_findings (api_id, tool, severity, owasp_category, description) VALUES ($1,$2,$3,$4,$5)',
//       [apiId, tool, severity, owasp, description]
//     );
//   }
// }
```

### 7. `backend/src/engine/riskScorer.js`

```js
// Calculate risk score for an API (0-100, higher = safer)
// Export: calculate(apiId)

// const db = require('../db/client');

// async function calculate(apiId) {
//   const { rows: [api] } = await db.query('SELECT * FROM apis WHERE id = $1', [apiId]);
//   if (!api) throw new Error('API not found');
//
//   let score = 100;
//
//   // Deductions
//   if (api.auth_check === false)        score -= 30;  // No authentication
//   if (api.https_check === false)       score -= 20;  // No HTTPS
//   if (api.rate_limit_check === false)  score -= 15;  // No rate limiting
//   if (api.pii_check === true)          score -= 25;  // PII exposed
//   if (!api.owner)                      score -= 5;   // No owner assigned
//
//   // Staleness check (if last_called_at is > 1 year ago or null for non-active)
//   if (api.last_called_at) {
//     const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
//     if (new Date(api.last_called_at) < oneYearAgo) score -= 10;
//   } else if (api.status !== 'ACTIVE') {
//     score -= 10;  // No traffic data for non-active API
//   }
//
//   // ZAP findings deductions
//   const { rows: findings } = await db.query(
//     'SELECT severity FROM security_findings WHERE api_id = $1 AND tool = $2',
//     [apiId, 'zap']
//   );
//   for (const f of findings) {
//     if (f.severity === 'CRITICAL') score -= 20;
//     else if (f.severity === 'HIGH') score -= 15;
//     else if (f.severity === 'MEDIUM') score -= 10;
//     else if (f.severity === 'LOW') score -= 5;
//   }
//
//   // Clamp to 0-100
//   score = Math.max(0, Math.min(100, score));
//
//   // Update in database
//   await db.query('UPDATE apis SET risk_score = $1 WHERE id = $2', [score, apiId]);
//
//   return score;
// }
//
// // Helper: map score to risk level string
// function getRiskLevel(score) {
//   if (score >= 80) return 'low';
//   if (score >= 50) return 'medium';
//   if (score >= 20) return 'high';
//   return 'critical';
// }
//
// module.exports = { calculate, getRiskLevel };
```

### 8. `backend/src/engine/zapIntegration.js`

```js
// OWASP ZAP integration (optional — uses hardcoded fallback for demo)
// Export: scanApi(host, port, path)

// const axios = require('axios');
// const ZAP_URL = process.env.ZAP_API_URL || 'http://localhost:8080';
// const ZAP_KEY = process.env.ZAP_API_KEY || 'zombieguard-zap-key';

// async function scanApi(host, port, path) {
//   const targetUrl = `http://${host}:${port}${path}`;
//
//   try {
//     // 1. Start spider
//     await axios.get(`${ZAP_URL}/JSON/spider/action/scan/`, {
//       params: { apikey: ZAP_KEY, url: targetUrl }
//     });
//
//     // 2. Wait for spider to complete (poll status)
//     // ... poll /JSON/spider/view/status/ until status === '100' ...
//
//     // 3. Start active scan
//     const { data } = await axios.get(`${ZAP_URL}/JSON/ascan/action/scan/`, {
//       params: { apikey: ZAP_KEY, url: targetUrl }
//     });
//     const scanId = data.scan;
//
//     // 4. Poll for completion
//     // ... poll /JSON/ascan/view/status/ until status === '100' ...
//
//     // 5. Get alerts
//     const { data: alertData } = await axios.get(`${ZAP_URL}/JSON/core/view/alerts/`, {
//       params: { apikey: ZAP_KEY, baseurl: targetUrl }
//     });
//
//     // 6. Map to our format
//     return alertData.alerts.map(alert => ({
//       tool: 'zap',
//       severity: mapZapRisk(alert.risk),  // 0=Info, 1=Low, 2=Medium, 3=High
//       owasp_category: alert.cweid ? `CWE-${alert.cweid}` : null,
//       description: `${alert.name}: ${alert.description}`
//     }));
//
//   } catch (error) {
//     console.warn('ZAP not available, using hardcoded findings');
//     return getHardcodedFindings(host, port, path);
//   }
// }

// function getHardcodedFindings(host, port, path) {
//   // Hardcoded findings for demo when ZAP is not running
//   // Return different findings based on whether this is a zombie/shadow API
//   const isUnsecured = [3013, 3014, 3015].includes(port);
//   if (isUnsecured) {
//     return [
//       { tool: 'zap', severity: 'HIGH', owasp_category: 'API1:2023', description: 'Broken Object Level Authorization - No authentication required' },
//       { tool: 'zap', severity: 'MEDIUM', owasp_category: 'API7:2023', description: 'Security Misconfiguration - Missing security headers' },
//       { tool: 'zap', severity: 'HIGH', owasp_category: 'API3:2023', description: 'Broken Object Property Level Authorization - Full PII in response' },
//     ];
//   }
//   return [];
// }

// module.exports = { scanApi };
```

### 9. `backend/src/engine/auditLogger.js`

```js
// Centralized audit logging
// Export: log({ api_id, action, old_value, new_value, performed_by })

// const db = require('../db/client');

// async function log({ api_id, action, old_value = null, new_value = null, performed_by = 'system' }) {
//   await db.query(
//     `INSERT INTO audit_logs (api_id, action, old_value, new_value, performed_by)
//      VALUES ($1, $2, $3, $4, $5)`,
//     [api_id, action, JSON.stringify(old_value), JSON.stringify(new_value), performed_by]
//   );
// }
//
// module.exports = { log };
```

---

## Acceptance Criteria

1. `classifyAll()` correctly classifies all 6 mock APIs into expected statuses
2. Auth check returns `passed: false` for zombie APIs (3013, 3014, 3015) and `passed: true` for active/deprecated APIs
3. PII check detects Aadhaar, PAN, phone, email in zombie API responses
4. Rate limit check detects rate limiting on active APIs and no rate limiting on zombie APIs
5. Risk scorer produces:
   - Active APIs: 80-100 (Low Risk)
   - Deprecated API: 50-65 (Medium Risk)
   - Zombie APIs: 0-15 (Critical Risk)
   - Shadow API: 0-10 (Critical Risk)
6. Security findings are stored in the database with correct severity and OWASP categories
7. Audit logs are created for every status change and security assessment
8. ZAP integration gracefully falls back to hardcoded findings when ZAP isn't running

---

## Does NOT Include

- Scan orchestration / job queue (Task 06)
- API routes that expose these functions (Task 08)
- Decommission logic (Task 09)
- Frontend (Tasks 10-12)
