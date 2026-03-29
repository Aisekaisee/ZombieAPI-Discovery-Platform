# Task 09: Decommission Engine & Routes

> **Assignee:** Team Member 9
> **Dependencies:** Read `00-shared-contracts.md`. Needs Task 03 (db client), Task 04 (backend core).
> **Estimated Effort:** Medium
> **Files Owned:**
> - `backend/src/engine/decommission/autoBlock.js`
> - `backend/src/engine/decommission/assisted.js`
> - `backend/src/engine/decommission/honeypot.js`
> - `backend/src/engine/dependencyChecker.js`
> - `backend/src/routes/decommission.js`

---

## Objective

Build the defence engine — three decommission modes (auto-block, assisted, honeypot), dependency checking, and the API routes to trigger them. This is the "action" layer that turns zombie discoveries into concrete security fixes.

---

## Files to Create

### 1. `backend/src/engine/dependencyChecker.js`

```js
// Check if an API has active dependents before allowing decommission
// Export: async function checkDependents(apiId)
// Returns: { safe: boolean, dependents: [{ service, lastCalled, requestCount }] }

// const db = require('../db/client');

// async function checkDependents(apiId) {
//   const { rows: [api] } = await db.query('SELECT * FROM apis WHERE id = $1', [apiId]);
//   if (!api) throw new Error('API not found');
//
//   // Check if the API has recent traffic (from discovery_sources or last_called_at)
//   const hasRecentTraffic = api.discovery_sources?.includes('traffic');
//   const lastCalled = api.last_called_at;
//
//   // If last called within 30 days, there might be active dependents
//   const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
//   const isRecentlyUsed = lastCalled && new Date(lastCalled) > thirtyDaysAgo;
//
//   if (hasRecentTraffic || isRecentlyUsed) {
//     // For demo: return mock dependent services based on port
//     // In production: would query traffic logs for source IPs/services
//     const dependents = [];
//     if (api.port === 3010 || api.port === 3011) {
//       dependents.push(
//         { service: 'mobile-banking-app', lastCalled: new Date().toISOString(), requestCount: 1500 },
//         { service: 'payment-gateway', lastCalled: new Date().toISOString(), requestCount: 800 }
//       );
//     }
//     return { safe: dependents.length === 0, dependents };
//   }
//
//   // No recent traffic — safe to decommission
//   return { safe: true, dependents: [] };
// }
//
// module.exports = { checkDependents };
```

### 2. `backend/src/engine/decommission/autoBlock.js`

```js
// Auto-block mode: programmatically add DENY rule to Nginx and reload
// Export: async function autoBlock(apiId)

// const fs = require('fs');
// const { execSync } = require('child_process');
// const db = require('../../db/client');
// const auditLogger = require('../auditLogger');

// async function autoBlock(apiId) {
//   const { rows: [api] } = await db.query('SELECT * FROM apis WHERE id = $1', [apiId]);
//   if (!api) throw new Error('API not found');
//
//   // 1. Read Nginx config
//   const configPath = process.env.NGINX_CONFIG_PATH || './nginx/default.conf';
//   let config = fs.readFileSync(configPath, 'utf-8');
//
//   // 2. Add DENY rule before the DENY_RULES_END marker
//   const denyRule = `    # Blocked by ZombieGuard - API ID ${api.id}
//     location = ${api.path} {
//         deny all;
//         return 403 '{"error": "This API has been decommissioned by ZombieGuard", "api_id": ${api.id}}';
//         add_header Content-Type application/json;
//     }\n`;
//
//   config = config.replace(
//     '# DENY_RULES_END',
//     denyRule + '    # DENY_RULES_END'
//   );
//
//   // 3. Write updated config
//   fs.writeFileSync(configPath, config);
//
//   // 4. Reload Nginx (try docker exec, fall back to signal)
//   try {
//     execSync('docker exec zombieguard-nginx-1 nginx -s reload', { timeout: 5000 });
//   } catch (e) {
//     // If Docker exec fails (e.g., not running in Docker), try direct reload
//     try { execSync('nginx -s reload', { timeout: 5000 }); }
//     catch (e2) { console.warn('Could not reload Nginx:', e2.message); }
//   }
//
//   // 5. Update database
//   await db.query(
//     'UPDATE apis SET decommission_status = $1 WHERE id = $2',
//     ['BLOCKED', apiId]
//   );
//
//   // 6. Audit log
//   await auditLogger.log({
//     api_id: apiId,
//     action: 'BLOCKED',
//     old_value: { decommission_status: api.decommission_status },
//     new_value: { decommission_status: 'BLOCKED' },
//     performed_by: 'system-auto'
//   });
//
//   // 7. Verify block (optional — try to reach the API)
//   // const axios = require('axios');
//   // try {
//   //   await axios.get(`http://localhost:8888${api.path}`, { timeout: 2000 });
//   // } catch (e) {
//   //   if (e.response?.status === 403) console.log('Block verified!');
//   // }
//
//   return { success: true, api_id: apiId, status: 'BLOCKED' };
// }
//
// module.exports = { autoBlock };
```

### 3. `backend/src/engine/decommission/assisted.js`

```js
// Assisted mode: create a decommission request that requires human approval
// Export: async function initiate(apiId, requestedBy) and approve(apiId, approvedBy)

// const db = require('../../db/client');
// const auditLogger = require('../auditLogger');
// const autoBlock = require('./autoBlock');

// async function initiate(apiId, requestedBy = 'system') {
//   const { rows: [api] } = await db.query('SELECT * FROM apis WHERE id = $1', [apiId]);
//   if (!api) throw new Error('API not found');
//
//   // Set decommission status to PENDING
//   await db.query(
//     'UPDATE apis SET decommission_status = $1 WHERE id = $2',
//     ['PENDING', apiId]
//   );
//
//   await auditLogger.log({
//     api_id: apiId,
//     action: 'DECOMMISSION_INITIATED',
//     new_value: { decommission_status: 'PENDING', mode: 'assisted' },
//     performed_by: requestedBy
//   });
//
//   // In production: send Slack/email notification to API owner
//   // For demo: just log it
//   console.log(`[ALERT] Decommission requested for ${api.method} ${api.path} (${api.host}:${api.port})`);
//   console.log(`  Risk Score: ${api.risk_score}, Status: ${api.status}`);
//   console.log(`  Requested by: ${requestedBy}`);
//   console.log(`  Approve at: POST /api/decommission/${apiId}/approve`);
//
//   return { success: true, api_id: apiId, status: 'PENDING' };
// }
//
// async function approve(apiId, approvedBy = 'admin') {
//   const { rows: [api] } = await db.query('SELECT * FROM apis WHERE id = $1', [apiId]);
//   if (!api) throw new Error('API not found');
//   if (api.decommission_status !== 'PENDING') {
//     throw new Error(`Cannot approve — current status is ${api.decommission_status}`);
//   }
//
//   await db.query(
//     'UPDATE apis SET decommission_status = $1 WHERE id = $2',
//     ['APPROVED', apiId]
//   );
//
//   await auditLogger.log({
//     api_id: apiId,
//     action: 'DECOMMISSION_APPROVED',
//     old_value: { decommission_status: 'PENDING' },
//     new_value: { decommission_status: 'APPROVED' },
//     performed_by: approvedBy
//   });
//
//   // Now execute the actual block
//   const result = await autoBlock.autoBlock(apiId);
//   return result;
// }
//
// module.exports = { initiate, approve };
```

### 4. `backend/src/engine/decommission/honeypot.js`

```js
// Honeypot mode: keep the API alive but return fake data and log everything
// Export: async function activate(apiId)

// const db = require('../../db/client');
// const auditLogger = require('../auditLogger');
// const fs = require('fs');

// In-memory honeypot hit log (for demo; in production use a DB table)
// const honeypotHits = [];

// async function activate(apiId) {
//   const { rows: [api] } = await db.query('SELECT * FROM apis WHERE id = $1', [apiId]);
//   if (!api) throw new Error('API not found');
//
//   // 1. Modify Nginx config to redirect to honeypot endpoint on our backend
//   const configPath = process.env.NGINX_CONFIG_PATH || './nginx/default.conf';
//   let config = fs.readFileSync(configPath, 'utf-8');
//
//   const honeypotRule = `    # Honeypot by ZombieGuard - API ID ${api.id}
//     location = ${api.path} {
//         proxy_pass http://backend:3000/api/honeypot/${api.id};
//         proxy_set_header X-Real-IP $remote_addr;
//         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
//         proxy_set_header X-Original-URI $request_uri;
//     }\n`;
//
//   config = config.replace(
//     '# DENY_RULES_END',
//     honeypotRule + '    # DENY_RULES_END'
//   );
//   fs.writeFileSync(configPath, config);
//
//   // 2. Update database
//   await db.query(
//     'UPDATE apis SET decommission_status = $1 WHERE id = $2',
//     ['HONEYPOT', apiId]
//   );
//
//   // 3. Audit log
//   await auditLogger.log({
//     api_id: apiId,
//     action: 'HONEYPOT_ACTIVATED',
//     new_value: { decommission_status: 'HONEYPOT' },
//     performed_by: 'system'
//   });
//
//   return { success: true, api_id: apiId, status: 'HONEYPOT' };
// }

// // Honeypot request handler (mounted as GET /api/honeypot/:id in the routes)
// async function handleHoneypotRequest(req, res) {
//   const apiId = parseInt(req.params.id);
//
//   // Log the hit
//   const hit = {
//     api_id: apiId,
//     timestamp: new Date().toISOString(),
//     source_ip: req.headers['x-real-ip'] || req.ip,
//     user_agent: req.headers['user-agent'],
//     headers: req.headers,
//     method: req.method,
//     original_uri: req.headers['x-original-uri'] || req.path,
//   };
//   honeypotHits.push(hit);
//   console.log('[HONEYPOT HIT]', JSON.stringify(hit));
//
//   // Return fake data (sanitized — no real PII)
//   res.json({
//     customers: [
//       { id: 1, name: "Test User", aadhaar: "XXXX XXXX XXXX", pan: "XXXXX0000X", phone: "0000000000" },
//       { id: 2, name: "Demo User", aadhaar: "XXXX XXXX XXXX", pan: "XXXXX0000X", phone: "0000000000" },
//     ]
//   });
// }
//
// function getHoneypotHits(apiId) {
//   if (apiId) return honeypotHits.filter(h => h.api_id === apiId);
//   return honeypotHits;
// }
//
// module.exports = { activate, handleHoneypotRequest, getHoneypotHits };
```

### 5. `backend/src/routes/decommission.js`

```js
// Express router for decommission operations
// const router = require('express').Router();
// const db = require('../db/client');
// const dependencyChecker = require('../engine/dependencyChecker');
// const autoBlock = require('../engine/decommission/autoBlock');
// const assisted = require('../engine/decommission/assisted');
// const honeypot = require('../engine/decommission/honeypot');

// ─── POST /api/decommission/:id/initiate ─────────────────────
// Start decommission workflow
// Request body: { mode: "auto" | "assisted" | "honeypot", performed_by: "admin" }
//
// 1. Check dependencies first
//    const depCheck = await dependencyChecker.checkDependents(apiId);
//    if (!depCheck.safe) {
//      return res.status(409).json({
//        success: false,
//        message: 'API has active dependents',
//        dependents: depCheck.dependents
//      });
//    }
//
// 2. Execute based on mode:
//    - "auto": await autoBlock.autoBlock(apiId)
//    - "assisted": await assisted.initiate(apiId, body.performed_by)
//    - "honeypot": await honeypot.activate(apiId)
//
// 3. Emit WebSocket event:
//    req.app.get('io').emit('decommission:update', { api_id: apiId, status: result.status });
//
// 4. Return result

// ─── POST /api/decommission/:id/approve ──────────────────────
// Human approval for assisted mode
// Request body: { performed_by: "admin" }
//
// await assisted.approve(apiId, body.performed_by)

// ─── POST /api/decommission/:id/block ────────────────────────
// Direct block action (bypass workflow)
// Request body: { performed_by: "admin" }
//
// 1. Check dependencies
// 2. await autoBlock.autoBlock(apiId)

// ─── POST /api/decommission/:id/honeypot ─────────────────────
// Switch to honeypot mode
// Request body: { performed_by: "admin" }
//
// await honeypot.activate(apiId)

// ─── GET /api/decommission/queue ─────────────────────────────
// List pending decommissions
//
// SELECT a.*, al.created_at as requested_at, al.performed_by as requested_by
// FROM apis a
// LEFT JOIN audit_logs al ON a.id = al.api_id AND al.action = 'DECOMMISSION_INITIATED'
// WHERE a.decommission_status = 'PENDING'
// ORDER BY a.risk_score ASC

// ─── GET /api/honeypot/:id (mounted separately) ─────────────
// Honeypot catch-all endpoint
// This needs to be mounted in index.js:
//   app.all('/api/honeypot/:id', honeypot.handleHoneypotRequest);

// ─── GET /api/decommission/honeypot-hits ─────────────────────
// Get honeypot hit logs
// Query params: ?api_id=3
//
// const hits = honeypot.getHoneypotHits(req.query.api_id);
// res.json({ data: hits });

// module.exports = router;
```

---

## Integration Notes

**Nginx Config Modification:**
The auto-block and honeypot modes modify `nginx/default.conf`. They insert rules between the `# DENY_RULES_START` and `# DENY_RULES_END` markers. Task 01 must ensure these markers exist.

**Honeypot Route:**
The honeypot handler needs to be mounted at `/api/honeypot/:id` in `index.js` (Task 04). Add this to the Task 04 spec or use try/catch:
```js
try {
  const honeypot = require('./engine/decommission/honeypot');
  app.all('/api/honeypot/:id', honeypot.handleHoneypotRequest);
} catch(e) { /* not available yet */ }
```

---

## Acceptance Criteria

1. `POST /api/decommission/:id/initiate` with `mode: "auto"` blocks the API in Nginx config
2. `POST /api/decommission/:id/initiate` with `mode: "assisted"` sets status to PENDING
3. `POST /api/decommission/:id/approve` approves and blocks a PENDING decommission
4. `POST /api/decommission/:id/honeypot` activates honeypot mode
5. Dependency checker blocks decommission of active APIs with dependents (returns 409)
6. Dependency checker allows decommission of zombie APIs (no dependents)
7. Nginx config is correctly modified with deny rules
8. Honeypot endpoint returns fake data and logs the request
9. `GET /api/decommission/queue` lists pending decommissions
10. All actions create audit log entries
11. WebSocket events fire on decommission status changes

---

## Does NOT Include

- Nginx container setup (Task 01)
- Backend server / route mounting (Task 04)
- Security checks or classification (Task 07)
- Frontend UI (Tasks 10-12)
