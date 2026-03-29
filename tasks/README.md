# ZombieGuard — Task Distribution Guide

> 13 task files designed for parallel development with zero merge conflicts.

---

## Task Index

| # | Task | Files Owned | Effort | Assignee |
|---|------|-------------|--------|----------|
| [00](00-shared-contracts.md) | **Shared Contracts** (READ-ONLY reference) | — | — | Everyone reads this |
| [01](01-docker-infrastructure.md) | Docker & Infrastructure | `docker-compose.yml`, `nginx/`, `.env`, Dockerfiles | Small | |
| [02](02-mock-apis.md) | Mock Bank APIs | `mock-apis/*.js` | Small-Med | |
| [03](03-database.md) | Database Schema & Client | `backend/src/db/*` | Small | |
| [04](04-backend-core.md) | Backend Core Server | `backend/src/index.js`, `backend/package.json` | Small | |
| [05](05-scanners.md) | Scanner Agents (4 scanners) | `backend/src/scanners/*` | Medium | |
| [06](06-scan-orchestrator.md) | Scan Orchestrator & Routes | `backend/src/jobs/*`, `backend/src/routes/scans.js` | Medium | |
| [07](07-classification-security.md) | Classification & Security Engine | `backend/src/engine/*` | Med-Large | |
| [08](08-api-routes.md) | API Registry & Stats Routes | `backend/src/routes/apis.js`, `security.js`, `stats.js` | Medium | |
| [09](09-decommission-engine.md) | Decommission Engine & Routes | `backend/src/engine/decommission/*`, `routes/decommission.js` | Medium | |
| [10](10-frontend-setup.md) | Frontend Setup & Components | `frontend/` setup, `components/*`, `lib/*` | Medium | |
| [11](11-frontend-pages.md) | Frontend Dashboard Pages | `frontend/app/dashboard/**` pages | Large | |
| [12](12-dependency-map.md) | Dependency Map Page | `frontend/app/dashboard/map/*`, `DependencyGraph.jsx` | Medium | |

---

## Dependency Graph (Build Order)

```
                    ┌──────────────────┐
                    │ 00 Shared Contracts│  ← Everyone reads this first
                    └────────┬─────────┘
                             │
          ┌──────────────────┼──────────────────────────────┐
          │                  │                              │
          ▼                  ▼                              ▼
   ┌─────────────┐  ┌──────────────┐                ┌───────────────┐
   │ 01 Docker   │  │ 02 Mock APIs │                │ 10 Frontend   │
   │ Infra       │  │              │                │ Setup         │
   └─────────────┘  └──────────────┘                └───────┬───────┘
          │                                                 │
          ▼                                          ┌──────┴──────┐
   ┌─────────────┐                                   │             │
   │ 03 Database │                                   ▼             ▼
   └──────┬──────┘                            ┌───────────┐ ┌───────────┐
          │                                   │ 11 Pages  │ │ 12 Dep Map│
          ▼                                   └───────────┘ └───────────┘
   ┌─────────────┐
   │ 04 Backend  │
   │ Core        │
   └──────┬──────┘
          │
   ┌──────┴──────────────────────┐
   │              │              │
   ▼              ▼              ▼
┌────────┐ ┌───────────┐ ┌───────────┐
│05 Scan-│ │ 08 API    │ │ 09 Decom- │
│ ners   │ │ Routes    │ │ mission   │
└───┬────┘ └───────────┘ └───────────┘
    │
    ▼
┌─────────────┐
│06 Orchestr- │
│ ator        │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│07 Classif.  │
│ & Security  │
└─────────────┘
```

---

## What Can Run in Parallel

### Tier 0 — Start Immediately (no dependencies between them)
- **Task 01** — Docker & Infrastructure
- **Task 02** — Mock APIs
- **Task 03** — Database Schema & Client
- **Task 04** — Backend Core Server
- **Task 10** — Frontend Setup & Components

### Tier 1 — After Tier 0 basics exist
- **Task 05** — Scanners (needs mock APIs running to test)
- **Task 08** — API Routes (needs db client + backend core)
- **Task 09** — Decommission (needs db client + backend core)
- **Task 11** — Frontend Pages (needs frontend setup)
- **Task 12** — Dependency Map (needs frontend setup)

### Tier 2 — After scanners exist
- **Task 06** — Scan Orchestrator (needs scanners + db + backend)
- **Task 07** — Classification & Security (needs db, ideally after scanners populate data)

---

## File Ownership Matrix (No Conflicts)

```
docker-compose.yml          → Task 01
.env                        → Task 01
nginx/default.conf          → Task 01 (modified by Task 09 at runtime)
nginx/access.log            → Task 01
mock-apis/*.js              → Task 02
mock-apis/package.json      → Task 01 (Dockerfile) + Task 02 (code)
backend/package.json        → Task 04
backend/src/index.js        → Task 04
backend/src/db/schema.sql   → Task 03
backend/src/db/client.js    → Task 03
backend/src/db/seed.js      → Task 03
backend/src/scanners/*      → Task 05
backend/src/jobs/*          → Task 06
backend/src/routes/scans.js → Task 06
backend/src/routes/apis.js  → Task 08
backend/src/routes/security.js    → Task 08
backend/src/routes/stats.js       → Task 08
backend/src/routes/decommission.js→ Task 09
backend/src/engine/classifier.js  → Task 07
backend/src/engine/riskScorer.js  → Task 07
backend/src/engine/securityRunner.js → Task 07
backend/src/engine/securityChecks/*  → Task 07
backend/src/engine/zapIntegration.js → Task 07
backend/src/engine/auditLogger.js    → Task 07
backend/src/engine/dependencyChecker.js → Task 09
backend/src/engine/decommission/*     → Task 09
frontend/package.json       → Task 10
frontend/app/layout.jsx     → Task 10
frontend/app/page.jsx       → Task 10
frontend/lib/*              → Task 10
frontend/components/*       → Task 10 (shared) + Task 12 (DependencyGraph)
frontend/app/dashboard/page.jsx          → Task 11
frontend/app/dashboard/apis/**           → Task 11
frontend/app/dashboard/zombies/page.jsx  → Task 11
frontend/app/dashboard/scans/page.jsx    → Task 11
frontend/app/dashboard/map/page.jsx      → Task 12
```

---

## Integration Points

These are the places where one task's output feeds into another. Coordinate here.

| Producer Task | Consumer Task | Interface |
|--------------|---------------|-----------|
| 03 (db client) | 06, 07, 08, 09 | `require('../db/client')` → `{ query, pool }` |
| 04 (backend core) | 06, 08, 09 | Route mounting in `index.js`, `req.app.get('io')` for WebSocket |
| 05 (scanners) | 06 (orchestrator) | `async function(options) → Array<{host, port, path, method, source, metadata}>` |
| 06 (orchestrator) | 07 (classifier) | Calls `classifier.classifyAll()` after scan completes |
| 07 (security) | 08 (routes) | `securityRunner.assessOne(apiId)` called from security routes |
| 07 (audit logger) | 06, 08, 09 | `auditLogger.log({ api_id, action, old_value, new_value, performed_by })` |
| 10 (API client) | 11, 12 (pages) | `import { getApis, startFullScan, ... } from '@/lib/api'` |
| 10 (socket) | 11 (pages) | `import { useScanProgress } from '@/lib/socket'` |
| 10 (components) | 11, 12 (pages) | `import { StatusBadge, RiskScoreGauge, APITable, ... }` |

---

## Quick Start for Each Team Member

1. Read `00-shared-contracts.md` completely
2. Read your assigned task file
3. Create ONLY the files listed in your task's "Files Owned" section
4. Use the interfaces/contracts from `00-shared-contracts.md` for any cross-task communication
5. Test your code independently where possible
6. When importing from another task, use try/catch to handle missing modules gracefully

---

## Tips for AI Model Vibe-Coding

When feeding a task to an AI coding model:

1. **Always include** `00-shared-contracts.md` as context — it has all data types and API contracts
2. **Include the specific task file** for the work to be done
3. **Prompt format:**
   ```
   You are building part of the ZombieGuard platform.

   Here are the shared contracts and data types:
   [paste 00-shared-contracts.md]

   Here is your specific task:
   [paste task-XX.md]

   Please implement all files listed in "Files Owned".
   Follow the specifications exactly.
   Use the exact file paths specified.
   Do not create files outside your owned list.
   ```
4. **For frontend tasks**, also include `10-frontend-setup.md` so the AI knows what shared components are available
5. **For backend tasks that need db**, also mention that `db/client.js` exports `{ query, pool }`
