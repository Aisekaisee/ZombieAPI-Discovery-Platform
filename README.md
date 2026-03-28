# ZombieGuard

**Automated Zombie API Discovery & Defence Platform for Banking Infrastructure**

> iDEA 2.0 | PSBs Hackathon Series 2026 | PS9

---

## Problem Statement

Banks accumulate APIs over years — mobile apps get rebuilt, services get migrated, teams change — but old APIs rarely get shut down. These forgotten, unmaintained APIs (zombie APIs) remain live on the network, still responding to requests, with no monitoring, no auth updates, and often exposing sensitive customer data.

This is not hypothetical:

- **40%** of enterprise APIs are undocumented or abandoned (Gartner)
- Zombie/Shadow APIs rank in the **OWASP API Security Top 10** (API9:2023 — Improper Inventory Management)
- Average breach cost in Indian banking: **Rs.40 crore per incident** (IBM Security 2024)
- PSBs collectively manage thousands of APIs with no unified visibility

**ZombieGuard** solves this by discovering every API across the bank's infrastructure, classifying it, scoring its security risk, and providing automated decommissioning — all from a single dashboard.

---

## How It Works

The platform operates in four phases:

```
DISCOVER  -->  CLASSIFY  -->  ASSESS  -->  DEFEND
```

### Phase 1 — Discover

Four independent scanner agents run in parallel, each hunting for APIs from a different source:

| Scanner | Source | Method |
|---|---|---|
| **Network Scanner** | Live infrastructure | nmap port scan + HTTP probing on common API ports |
| **Git Scanner** | Code repositories | Static analysis of route definitions + git history for deleted routes |
| **Traffic Log Analyzer** | Nginx/server access logs | Parse request logs to find actually-called endpoints |
| **Gateway Scanner** | Kong/AWS API Gateway | Pull the official registered route list via admin APIs |

The key insight: **no single source tells the full story.** An API can exist in code but not the gateway (shadow), in the gateway but not in code (orphaned), or in neither but still responding on the network (zombie). Cross-referencing all four sources is what makes zombie detection possible.

### Phase 2 — Classify

The classification engine cross-references findings from all scanners:

| Status | In Gateway | In Code | Has Traffic | Action |
|---|---|---|---|---|
| **Active** | Yes | Yes | Yes | Monitor |
| **Deprecated** | Yes | Yes | No | Notify owner, plan removal |
| **Shadow** | No | No | Yes | Urgent investigation — unknown API with live traffic |
| **Zombie** | No | No | No | Decommission — responds but nobody owns or uses it |
| **Orphaned** | Yes | No | No | Review and clean up |

Shadow APIs are the most dangerous — they have active traffic but appear in no official registry or codebase.

### Phase 3 — Assess Security Posture

Every discovered API gets a security assessment producing a risk score (0-100):

| Check | Method | Score Impact |
|---|---|---|
| **Authentication** | Send request with no auth header; if 200 with data = no auth | -30 |
| **Encryption** | HTTP vs HTTPS | -20 |
| **Rate Limiting** | Send 100 requests in 5 seconds; if no 429 = no rate limit | -15 |
| **PII Exposure** | Scan response for aadhaar, account numbers, CVV, PAN, etc. | -25 |
| **OWASP ZAP Scan** | Automated 40+ vulnerability checks (BOLA, SQLi, misconfig) | -10 to -20 per finding |
| **Staleness** | Last code update > 1 year ago | -10 |
| **Ownership** | No team assigned | -5 |

**Score ranges:** 80-100 Low Risk | 50-79 Medium | 20-49 High | 0-19 Critical

### Phase 4 — Defend & Decommission

Three action modes for confirmed zombie APIs:

**Auto Mode** — For critical-risk zombies, the system automatically adds a DENY rule to Nginx or removes the route from Kong, logs the action, and notifies the team.

**Assisted Mode (Default)** — Sends an alert to the API owner (Slack/email) with risk details and one-click decommission. Human approves before any action executes. Full audit trail logged.

**Honeypot Mode** — Instead of blocking, the zombie endpoint stays alive but returns fake data while logging every request (source IP, headers, geolocation). If someone is probing a dead endpoint, it's likely reconnaissance — the security team gets alerted. Turns a vulnerability into a detection tool.

Before any decommission, the system checks traffic logs for active dependents. If another service still calls the API, decommission is blocked and those teams are notified.

---

## Architecture

```
                        BANK INFRASTRUCTURE
    Network (IPs)    GitHub Repos    Nginx Logs    Kong Gateway
         |                |               |              |
         v                v               v              v
    +---------------------------------------------------------+
    |                 SCANNER AGENTS LAYER                     |
    |  Network Scanner  Git Scanner  Log Analyzer  Gateway    |
    |     (nmap)       (Semgrep)     (Node.js)    (Kong API)  |
    +---------------------------------------------------------+
                          |
                   BullMQ Job Queue
                          |
                          v
    +---------------------------------------------------------+
    |               PROCESSING ENGINE                          |
    |                                                          |
    |   Classification Engine     Security Posture Checker     |
    |   (cross-reference logic)   (ZAP + auth/rate/PII)        |
    |                                                          |
    |   Risk Scorer (0-100)       AI Remediation Reports       |
    +---------------------------------------------------------+
                          |
                   PostgreSQL + Redis
                          |
                          v
    +---------------------------------------------------------+
    |              DEFENCE & ACTION ENGINE                      |
    |                                                          |
    |   Auto-block (Nginx/Kong)    Alerts (Slack/Email)        |
    |   Decommission Workflows     Honeypot Setup              |
    |   Audit Logger               Dependency Checker           |
    +---------------------------------------------------------+
                          |
                          v
    +---------------------------------------------------------+
    |                NEXT.JS DASHBOARD                          |
    |                                                          |
    |   API Inventory       Risk Overview      Zombie Center   |
    |   Dependency Map      Scan History       Alert Feed      |
    +---------------------------------------------------------+
```

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js 14, Tailwind CSS, Shadcn/ui | Dashboard UI with SSR |
| **Visualization** | Recharts, React Flow | Risk graphs, API dependency map |
| **Backend** | Node.js + Express | API server and scanner orchestration |
| **Job Queue** | BullMQ + Redis | Background scanner jobs |
| **Scheduling** | node-cron | Automated scans every 6 hours |
| **Database** | PostgreSQL | API registry, audit logs, scan history |
| **Cache/Queue** | Redis | BullMQ queues, scan result caching |
| **Security Scanning** | OWASP ZAP (Docker) | Automated vulnerability testing |
| **Static Analysis** | Semgrep (CLI) | Code scanning for route definitions |
| **Network Scanning** | nmap (CLI) | Port scanning and host discovery |
| **API Discovery** | Akto (Docker) | Traffic-based API discovery |
| **AI Reports** | Claude / OpenAI API | Remediation report generation |
| **Infrastructure** | Docker Compose | Packages the entire platform |
| **Gateway** | Nginx | Mock API gateway + decommission demo |

---

## Database Schema

Four core tables:

**`apis`** — The central registry. Every discovered API gets a row with: path, method, host, port, status (ACTIVE/DEPRECATED/ZOMBIE/SHADOW/ORPHANED), risk score, owner info, discovery sources, last-called timestamp, security check results (auth, HTTPS, rate limit, PII), and decommission status.

**`scan_runs`** — Log of every scan execution: type, status, APIs found, start/end time.

**`security_findings`** — Individual vulnerabilities found per API: tool that found it (ZAP/Akto), severity, OWASP category, description.

**`audit_logs`** — Every action taken on an API: discovery, status change, decommission, blocking. Stores old/new values and who performed the action. This is the compliance trail for RBI.

---

## Backend API

```
Scanners
  POST /api/scans/run              Trigger full scan
  POST /api/scans/run/:type        Trigger specific scanner
  GET  /api/scans/status           Current scan status
  GET  /api/scans/history          Past scan runs

API Registry
  GET  /api/apis                   List all APIs (filterable by status, risk)
  GET  /api/apis/:id               Single API detail
  GET  /api/apis/zombies           All zombie APIs
  GET  /api/apis/shadow            All shadow APIs
  PATCH /api/apis/:id/status       Update API status manually

Security
  POST /api/security/assess/:id    Run security assessment on one API
  GET  /api/security/findings      All findings
  GET  /api/security/findings/:id  Findings for one API

Decommission
  POST /api/decommission/:id/initiate   Start workflow
  POST /api/decommission/:id/approve    Human approval
  POST /api/decommission/:id/block      Execute block
  POST /api/decommission/:id/honeypot   Switch to honeypot
  GET  /api/decommission/queue          Pending decommissions

Dashboard Stats
  GET  /api/stats/overview         Counts by status, avg risk
  GET  /api/stats/trend            Discovery trend over time
  GET  /api/stats/risk             Risk score distribution
```

---

## Dashboard

| Page | URL | Purpose |
|---|---|---|
| **Overview** | `/dashboard` | Stat cards (total, active, zombie, shadow, critical), org risk score gauge, status pie chart, recent alerts, "Run Full Scan" button |
| **API Inventory** | `/dashboard/apis` | Searchable, filterable table of all APIs with status badges, risk scores, and row-click detail drawer |
| **API Detail** | `/dashboard/apis/:id` | Full metadata, traffic timeline, security checklist, ZAP findings, AI remediation report, source trace, decommission button |
| **Zombie Center** | `/dashboard/zombies` | All zombies ranked by risk, bulk decommission, individual actions (block/honeypot/snooze/assign) |
| **Dependency Map** | `/dashboard/map` | Interactive React Flow graph showing service-to-API connections; red nodes = services depending on zombies |
| **Scan History** | `/dashboard/scans` | Past scan runs with expandable details of what was discovered |

---

## Project Structure

```
zombieguard/
|-- docker-compose.yml
|-- README.md
|
|-- backend/
|   |-- src/
|   |   |-- index.js                  Entry point
|   |   |-- db/
|   |   |   |-- schema.sql            Database setup
|   |   |   |-- client.js             PostgreSQL connection
|   |   |-- scanners/
|   |   |   |-- networkScanner.js     nmap + HTTP probing
|   |   |   |-- gitScanner.js         GitHub API + Semgrep
|   |   |   |-- logAnalyzer.js        Nginx log parsing
|   |   |   |-- gatewayScanner.js     Kong admin API
|   |   |-- engine/
|   |   |   |-- classifier.js         Cross-reference classification
|   |   |   |-- riskScorer.js         Risk score calculation
|   |   |   |-- zapIntegration.js     OWASP ZAP API calls
|   |   |-- routes/
|   |   |   |-- apis.js
|   |   |   |-- scans.js
|   |   |   |-- security.js
|   |   |   |-- decommission.js
|   |   |-- jobs/
|   |       |-- scanQueue.js          BullMQ job definitions
|   |-- package.json
|
|-- frontend/
|   |-- app/
|   |   |-- dashboard/
|   |   |   |-- page.jsx              Overview
|   |   |   |-- apis/page.jsx         API Inventory
|   |   |   |-- zombies/page.jsx      Zombie Command Center
|   |   |   |-- map/page.jsx          Dependency Map
|   |   |   |-- scans/page.jsx        Scan History
|   |   |-- layout.jsx
|   |-- components/
|   |   |-- APITable.jsx
|   |   |-- RiskScoreGauge.jsx
|   |   |-- StatusBadge.jsx
|   |   |-- ZombieCard.jsx
|   |   |-- DependencyGraph.jsx
|   |-- package.json
|
|-- mock-apis/                         Fake bank APIs for demo
|   |-- active-api.js
|   |-- zombie-api.js
|   |-- shadow-api.js
|
|-- nginx/
    |-- default.conf                   Gateway + decommission config
```

---

## Demo Flow

Since we can't scan a real bank, the demo uses mock APIs running locally on ports 3001-3006 simulating a bank environment — including properly authenticated active APIs, zombie APIs returning PII with no auth, and undocumented shadow APIs.

**The demo in 5 minutes:**

1. Hit "Run Full Scan" on the dashboard
2. Watch scanner progress via real-time WebSocket updates
3. All 6 mock APIs appear in the inventory
4. Classification runs — 2 Active, 1 Deprecated, 2 Zombie, 1 Shadow
5. Click into a zombie API — risk score 8/100, PII exposed, no auth
6. Click "Decommission" — Nginx deny rule added automatically
7. Try calling the zombie API — `403 Forbidden`
8. Audit log records the entire action chain

---

## Build Priority

| Priority | Feature | Status |
|---|---|---|
| **P0 - Must ship** | Network Scanner, Classification Engine, Dashboard Inventory, Decommission button | Core demo |
| **P1 - Should have** | OWASP ZAP integration, Git Scanner, Traffic Log Analyzer | Can use hardcoded findings as fallback |
| **P2 - Nice to have** | AI remediation reports, Dependency map, Honeypot mode | Drop if time-constrained |

---

## OWASP API Security Relevance

ZombieGuard directly addresses three of the OWASP API Security Top 10:

- **API9:2023 — Improper Inventory Management**: This is the zombie API problem. ZombieGuard's multi-source discovery and continuous monitoring solve it at the infrastructure level.
- **API1:2023 — Broken Object Level Authorization (BOLA)**: Zombie APIs often run with no authentication at all, making every object accessible.
- **API3:2023 — Broken Object Property Level Authorization**: Zombie APIs typically return full data objects including PII fields that should be filtered.

---

## Key Differentiators

**Multi-source discovery** — Cross-referencing network, code, traffic logs, and gateway data. The gaps between these sources are exactly where zombies hide.

**End-to-end lifecycle** — Not just a scanner. Discover, classify, score, explain, and decommission — all in one platform.

**Industry-standard tooling** — Orchestrates Akto, Semgrep, OWASP ZAP, and nmap — tools already trusted in the security industry.

**Shift-left prevention** — Scans code repositories so teams get feedback before bad APIs deploy. Prevents the next generation of zombies.

**RBI compliance-ready** — Every action is human-approvable and audit-logged. Full trail for RBI's IT Risk & Cyber Security Framework.

**Honeypot innovation** — Dead APIs become attacker detection tripwires. Turns a vulnerability into a security asset.

---

*ZombieGuard — Because the most dangerous API is the one nobody remembers.*
