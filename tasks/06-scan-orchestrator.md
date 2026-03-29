# Task 06: Scan Orchestrator & Scan Routes

> **Assignee:** Team Member 6
> **Dependencies:** Read `00-shared-contracts.md`. Needs Task 03 (db client), Task 04 (backend core), Task 05 (scanners).
> **Estimated Effort:** Medium
> **Files Owned:** `backend/src/jobs/scanQueue.js`, `backend/src/routes/scans.js`

---

## Objective

Build the BullMQ job queue that orchestrates scanner execution, writes results to the database, and emits WebSocket progress events. Also build the scan API routes.

---

## Files to Create

### 1. `backend/src/jobs/scanQueue.js`

This is the core orchestration layer. It manages background jobs for running scans.

```js
// Dependencies:
// const { Queue, Worker } = require('bullmq');
// const IORedis = require('ioredis');
// const db = require('../db/client');
// const networkScanner = require('../scanners/networkScanner');
// const gatewayScanner = require('../scanners/gatewayScanner');
// const gitScanner = require('../scanners/gitScanner');
// const logAnalyzer = require('../scanners/logAnalyzer');

// Redis connection (shared between Queue and Worker):
// const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
//   maxRetriesPerRequest: null  // required by BullMQ
// });

// Create queue:
// const scanQueue = new Queue('scan-queue', { connection: redisConnection });

// ============================================================
// EXPORTED FUNCTIONS
// ============================================================

// addScanJob(type) — Enqueue a scan job
// type: 'network-scan' | 'gateway-scan' | 'git-scan' | 'log-scan' | 'full-scan'
// Returns: { jobId: string }
//
// For 'full-scan':
//   1. Create a scan_runs entry (type: 'full-scan', status: 'RUNNING')
//   2. Add a job to the queue with { type: 'full-scan', scanRunId }
//
// For individual scans:
//   1. Create a scan_runs entry for that type
//   2. Add job to queue

// getScanStatus() — Returns current queue status
// Returns: { running: boolean, jobs: [{ id, type, status }] }

// ============================================================
// WORKER LOGIC
// ============================================================

// Worker processes jobs from the 'scan-queue':
//
// const worker = new Worker('scan-queue', async (job) => {
//   const { type, scanRunId } = job.data;
//   const io = getIO();  // get socket.io instance
//
//   try {
//     if (type === 'full-scan') {
//       io.emit('scan:started', { jobId: job.id, type, startedAt: new Date() });
//
//       // Run all 4 scanners (can be parallel or sequential)
//       // For each scanner:
//       //   1. Emit 'scan:progress' with scanner name and status 'running'
//       //   2. Execute scanner
//       //   3. Upsert results into apis table
//       //   4. Emit 'scan:progress' with scanner name and status 'completed' + count
//
//       const scanners = [
//         { name: 'network', fn: networkScanner, opts: { host: process.env.SCAN_TARGET_HOST, ports: parsePortRange(process.env.SCAN_PORT_RANGE) } },
//         { name: 'gateway', fn: gatewayScanner, opts: { configPath: process.env.NGINX_CONFIG_PATH } },
//         { name: 'git',     fn: gitScanner,     opts: { scanDir: process.env.MOCK_APIS_DIR } },
//         { name: 'traffic', fn: logAnalyzer,    opts: { logPath: process.env.NGINX_LOG_PATH } },
//       ];
//
//       let totalFound = 0;
//       for (const scanner of scanners) {
//         io.emit('scan:progress', { jobId: job.id, scanner: scanner.name, status: 'running' });
//
//         const results = await scanner.fn(scanner.opts);
//
//         // Upsert each result into apis table
//         for (const endpoint of results) {
//           await upsertApi(endpoint);
//         }
//
//         totalFound += results.length;
//         io.emit('scan:progress', { jobId: job.id, scanner: scanner.name, status: 'completed', found: results.length });
//       }
//
//       // Update scan_runs entry
//       await db.query(
//         'UPDATE scan_runs SET status = $1, apis_found = $2, completed_at = NOW() WHERE id = $3',
//         ['COMPLETED', totalFound, scanRunId]
//       );
//
//       io.emit('scan:completed', { jobId: job.id, type, totalFound, duration: Date.now() - new Date(job.timestamp) });
//
//     } else {
//       // Individual scanner job — run just one scanner
//       // Similar logic but only for the specified type
//     }
//   } catch (error) {
//     await db.query('UPDATE scan_runs SET status = $1, completed_at = NOW() WHERE id = $2', ['FAILED', scanRunId]);
//     io.emit('scan:error', { jobId: job.id, error: error.message });
//     throw error;
//   }
// }, { connection: redisConnection });

// ============================================================
// HELPER: upsertApi(endpoint)
// ============================================================

// Upsert an API into the apis table.
// If an API with the same (host, port, path, method) exists:
//   - Merge discovery_sources (append new source if not already present)
//   - Update last_called_at if traffic data provides it
//   - Update metadata fields
// If not exists:
//   - INSERT new row with status 'UNKNOWN' (classifier will set real status later)
//
// SQL for upsert:
// INSERT INTO apis (host, port, path, method, discovery_sources)
// VALUES ($1, $2, $3, $4, $5)
// ON CONFLICT (host, port, path, method)
// DO UPDATE SET
//   discovery_sources = (
//     SELECT jsonb_agg(DISTINCT value)
//     FROM jsonb_array_elements(apis.discovery_sources || $5)
//   ),
//   updated_at = NOW()
// RETURNING *;

// ============================================================
// HELPER: parsePortRange(rangeStr)
// ============================================================
// "3010-3015" → [3010, 3011, 3012, 3013, 3014, 3015]

// ============================================================
// HELPER: getIO()
// ============================================================
// Get socket.io instance. Options:
//   1. Accept io as constructor param when initializing the worker
//   2. Require('../index').io
//   3. Use a shared singleton module
// Choose option 1 for cleanest architecture:
//
// function initWorker(io) { ... create worker with io reference ... }
// Export initWorker and call it from index.js after server starts.

// ============================================================
// EXPORTS
// ============================================================
// module.exports = {
//   scanQueue,
//   addScanJob,
//   getScanStatus,
//   initWorker,
// };
```

### 2. `backend/src/routes/scans.js`

```js
// Express router for scan operations
// const router = require('express').Router();
// const { addScanJob, getScanStatus } = require('../jobs/scanQueue');
// const db = require('../db/client');

// POST /api/scans/run
// Trigger a full scan
// Handler:
//   const { jobId } = await addScanJob('full-scan');
//   res.json({ jobId, message: 'Full scan started' });

// POST /api/scans/run/:type
// Trigger a specific scanner
// Validate type is one of: 'network-scan', 'gateway-scan', 'git-scan', 'log-scan'
// Handler:
//   const { jobId } = await addScanJob(req.params.type);
//   res.json({ jobId, message: `${req.params.type} started` });

// GET /api/scans/status
// Return current running scan status
// Handler:
//   const status = await getScanStatus();
//   res.json(status);

// GET /api/scans/history
// Return past scan runs from database (paginated)
// Query params: ?page=1&limit=20
// Handler:
//   const page = parseInt(req.query.page) || 1;
//   const limit = parseInt(req.query.limit) || 20;
//   const offset = (page - 1) * limit;
//   const { rows } = await db.query(
//     'SELECT * FROM scan_runs ORDER BY started_at DESC LIMIT $1 OFFSET $2',
//     [limit, offset]
//   );
//   const { rows: [{ count }] } = await db.query('SELECT count(*) FROM scan_runs');
//   res.json({ data: rows, total: parseInt(count), page });

// module.exports = router;
```

---

## Post-Scan Pipeline Hook

After a full scan completes, the orchestrator should trigger the classification and security assessment pipeline. This is the integration point with Task 07.

```js
// After all scanners complete in a full-scan job:
// 1. Run classifier: const classifier = require('../engine/classifier');
//    await classifier.classifyAll();
// 2. Run security assessments: const securityRunner = require('../engine/securityRunner');
//    await securityRunner.assessAll();
// 3. Emit summary: io.emit('api:classified', { summary: classificationResult });
//
// If classifier/securityRunner modules aren't available yet (Task 07 not done),
// wrap in try/catch so the scan still completes.
```

---

## Acceptance Criteria

1. `POST /api/scans/run` enqueues a full-scan job and returns a jobId
2. Full scan runs all 4 scanners and upserts discovered APIs into the database
3. WebSocket events fire for each scanner's progress: started → running → completed
4. Duplicate APIs (same host+port+path+method) are merged, not duplicated
5. `discovery_sources` accumulates sources from multiple scanners (e.g., `["network", "gateway", "git"]`)
6. `GET /api/scans/history` returns paginated scan run history
7. Failed scans are marked as FAILED in scan_runs
8. Post-scan pipeline attempts classification (gracefully skips if Task 07 not ready)

---

## Does NOT Include

- Scanner implementations (Task 05)
- Classification / risk scoring logic (Task 07)
- API registry routes (Task 08)
- Database schema (Task 03)
