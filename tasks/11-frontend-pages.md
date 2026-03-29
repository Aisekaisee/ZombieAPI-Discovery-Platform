# Task 11: Frontend Dashboard Pages

> **Assignee:** Team Member 11
> **Dependencies:** Read `00-shared-contracts.md`. Needs Task 10 (frontend setup, layout, shared components).
> **Estimated Effort:** Large
> **Files Owned:**
> - `frontend/app/dashboard/page.jsx` (Overview)
> - `frontend/app/dashboard/apis/page.jsx` (API Inventory)
> - `frontend/app/dashboard/apis/[id]/page.jsx` (API Detail)
> - `frontend/app/dashboard/zombies/page.jsx` (Zombie Center)
> - `frontend/app/dashboard/scans/page.jsx` (Scan History)

---

## Objective

Build all dashboard pages that consume the backend API and display data using the shared components from Task 10. Each page is a Next.js app router page component.

---

## Pages to Create

### 1. `frontend/app/dashboard/page.jsx` — Overview / Home

This is the main dashboard page — the first thing users see.

```
┌─────────────────────────────────────────────────────────────────┐
│  ZombieGuard Dashboard                           [Run Full Scan]│
├────────┬────────┬────────┬────────┬────────┬───────────────────┤
│ Total  │ Active │ Zombie │ Shadow │ Dep.   │ Critical Risk     │
│   6    │   2    │   2    │   1    │   1    │      3            │
├────────┴────────┴────────┴────────┴────────┴───────────────────┤
│                                                                 │
│  ┌─────────────────────┐  ┌──────────────────────────────────┐ │
│  │  Org Risk Score     │  │  Status Distribution (Pie Chart) │ │
│  │     [Gauge: 41]     │  │  ● Active  ● Zombie  ● Shadow   │ │
│  │     Medium Risk     │  │  ● Deprecated  ● Orphaned       │ │
│  └─────────────────────┘  └──────────────────────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Risk Trend Over Time (Line Chart)                          ││
│  │  Shows avg risk score per scan run                          ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Recent Alerts (last 10 audit log entries)                  ││
│  │  • ZOMBIE detected: /api/v1/customers — 2 min ago           ││
│  │  • SECURITY_ASSESSED: /api/v1/loans — Risk: 10 — 3 min ago ││
│  │  • BLOCKED: /api/v1/customers — 5 min ago                   ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

**Implementation:**

```jsx
'use client';
// Imports: SWR for data fetching, Recharts for charts, shared components

// Data fetching (use SWR for auto-refresh):
//   const { data: stats } = useSWR('/api/stats/overview', fetcher);
//   const { data: trend } = useSWR('/api/stats/trend', fetcher);
//   const { data: risk } = useSWR('/api/stats/risk', fetcher);

// Stat cards row:
// - Total APIs (stats.total)
// - Active (stats.active) — green
// - Zombie (stats.zombie) — red
// - Shadow (stats.shadow) — orange
// - Critical Risk (stats.critical_count) — red pulsing

// Org Risk Score:
// - Use RiskScoreGauge component with stats.avg_risk
// - Size: "lg"

// Status Distribution Pie:
// - Recharts PieChart with 5 segments
// - Data: [{ name: 'Active', value: stats.active, fill: '#10b981' }, ...]
// - Legend below chart

// Risk Trend Line Chart:
// - Recharts LineChart
// - X-axis: scan date, Y-axis: avg_risk
// - Data from /api/stats/trend

// "Run Full Scan" button:
// - Calls startFullScan() from lib/api.js
// - Shows ScanProgress component while scan is running
// - After scan completes, SWR auto-revalidates data

// Recent Alerts:
// - Fetch from /api/apis + audit_logs (or a dedicated endpoint)
// - Show last 10 entries with action, API path, timestamp
// - Relative time ("2 min ago", "1 hour ago")
```

### 2. `frontend/app/dashboard/apis/page.jsx` — API Inventory

```
┌─────────────────────────────────────────────────────────────────┐
│  API Inventory                                                   │
├─────────────────────────────────────────────────────────────────┤
│  [Search: ________________]  Status: [All ▼]  Risk: [All ▼]    │
├─────────────────────────────────────────────────────────────────┤
│  Method │ Path              │ Host:Port      │ Status   │ Risk  │
│─────────┼───────────────────┼────────────────┼──────────┼───────│
│  GET    │ /api/v2/accounts  │ localhost:3010 │ ACTIVE   │  90   │
│  GET    │ /api/v2/transfers │ localhost:3011 │ ACTIVE   │  85   │
│  GET    │ /api/v1/accounts  │ localhost:3012 │ DEPR.    │  55   │
│  GET    │ /api/v1/customers │ localhost:3013 │ ZOMBIE   │   5   │
│  GET    │ /api/v1/loans     │ localhost:3014 │ ZOMBIE   │  10   │
│  GET    │ /internal/debug   │ localhost:3015 │ SHADOW   │   0   │
├─────────────────────────────────────────────────────────────────┤
│  Showing 1-6 of 6                              [< 1 >]          │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation:**

```jsx
'use client';
// State: status filter, risk filter, search query, page number
// Fetch: useSWR with dynamic key based on filters
//   const { data } = useSWR(`/api/apis?status=${status}&risk=${risk}&search=${search}&page=${page}`, fetcher);

// Search bar: controlled input with debounce (300ms)
// Filter dropdowns: Shadcn Select for status and risk
// Table: Use APITable component from Task 10
// Row click: router.push(`/dashboard/apis/${api.id}`)
```

### 3. `frontend/app/dashboard/apis/[id]/page.jsx` — API Detail

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back    GET /api/v1/customers    [ZOMBIE]    Risk: 5/100     │
├──────────────────────────────────┬──────────────────────────────┤
│  Metadata                        │  Security Checklist          │
│  Host: localhost                 │  ✗ Authentication  (FAIL)    │
│  Port: 3013                      │  ✗ HTTPS           (FAIL)    │
│  Discovery: network              │  ✗ Rate Limiting   (FAIL)    │
│  First seen: 29 Mar 2026         │  ✗ PII Exposure    (FAIL)    │
│  Last called: Never              │    → aadhaar, pan, phone     │
│  Owner: Unassigned               │                              │
├──────────────────────────────────┴──────────────────────────────┤
│  Security Findings                                               │
│  ┌──────────┬──────────┬─────────────────────────────────────┐  │
│  │ Severity │ OWASP    │ Description                          │  │
│  ├──────────┼──────────┼─────────────────────────────────────┤  │
│  │ CRITICAL │ API1:2023│ No authentication required           │  │
│  │ CRITICAL │ API3:2023│ PII exposed in response              │  │
│  │ HIGH     │ API8:2023│ No HTTPS encryption                  │  │
│  └──────────┴──────────┴─────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  Source Trace                                                    │
│  • Network Scanner: Found 29 Mar 2026 10:30 AM                  │
│  • Git Scanner: Not found                                        │
│  • Gateway Scanner: Not registered                               │
│  • Traffic Logs: No traffic                                      │
├─────────────────────────────────────────────────────────────────┤
│  Audit Log                                                       │
│  • DISCOVERED by network-scanner — 29 Mar 2026                   │
│  • STATUS_CHANGED to ZOMBIE by classifier — 29 Mar 2026          │
│  • SECURITY_ASSESSED risk_score: 5 — 29 Mar 2026                 │
├─────────────────────────────────────────────────────────────────┤
│  Actions                                                         │
│  [🔴 Decommission]  [🟡 Honeypot]  [👤 Assign Owner]           │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation:**

```jsx
'use client';
// Fetch: useSWR(`/api/apis/${params.id}`, fetcher)
// Response includes: api object, findings array, audit_logs array

// Back button: router.back() or Link to /dashboard/apis

// Header: method badge + path + StatusBadge + RiskScoreGauge (sm)

// Metadata card: grid of key-value pairs
// Security checklist: 4 items with pass/fail icons (Check/X from lucide)
// If pii_check is true, show pii_types list

// Security findings table: severity (colored), owasp_category, description
// Severity badges: CRITICAL=red, HIGH=orange, MEDIUM=yellow, LOW=green

// Source trace: show which scanners found this API
// Map discovery_sources array to scanner names

// Audit log: timeline view of audit_logs, most recent first

// Action buttons:
// - Decommission: opens confirmation dialog → calls initiateDecommission(id, 'auto')
// - Honeypot: opens dialog → calls initiateDecommission(id, 'honeypot')
// - Assign Owner: opens dialog with text input → calls updateApiStatus or custom endpoint
```

### 4. `frontend/app/dashboard/zombies/page.jsx` — Zombie Center

```
┌─────────────────────────────────────────────────────────────────┐
│  ☠ Zombie Command Center                                         │
├────────────────┬────────────────┬────────────────────────────────┤
│ Total Zombies  │ Avg Risk Score │ PII Exposed                    │
│      2         │      7.5       │      2                         │
├────────────────┴────────────────┴────────────────────────────────┤
│  Filter: [All ▼]  Risk: [All ▼]     [☐ Select All] [Bulk Block] │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────┐ ┌─────────────────────────────┐│
│  │ ☐ GET /api/v1/customers     │ │ ☐ GET /api/v1/loans          ││
│  │ localhost:3013               │ │ localhost:3014               ││
│  │ Risk: [5/100] CRITICAL      │ │ Risk: [10/100] CRITICAL     ││
│  │ ⚠ No Auth  ⚠ PII  ⚠ HTTP   │ │ ⚠ No Auth  ⚠ PII  ⚠ HTTP   ││
│  │ ⚠ No Rate Limit             │ │ ⚠ No Rate Limit             ││
│  │ [Block] [Honeypot] [Assign] │ │ [Block] [Honeypot] [Assign] ││
│  └─────────────────────────────┘ └─────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

**Implementation:**

```jsx
'use client';
// Fetch: useSWR('/api/apis/zombies', fetcher)

// Stats banner: total zombies, avg risk score, count with PII exposed
// Calculate from fetched zombie API list

// Bulk selection:
// - State: selectedIds (Set)
// - Select All checkbox
// - Bulk Block button: calls initiateDecommission for each selected

// Zombie cards: grid layout (2 columns on desktop, 1 on mobile)
// Use ZombieCard component from Task 10

// Card actions:
// - Block: calls initiateDecommission(id, 'auto') with confirmation dialog
// - Honeypot: calls initiateDecommission(id, 'honeypot')
// - Assign: opens owner assignment dialog

// After any action: mutate/revalidate SWR data
// Show toast/notification on success
```

### 5. `frontend/app/dashboard/scans/page.jsx` — Scan History

```
┌─────────────────────────────────────────────────────────────────┐
│  Scan History                                    [Run Full Scan] │
├─────────────────────────────────────────────────────────────────┤
│  [ScanProgress component — shown when scan is running]           │
├─────────────────────────────────────────────────────────────────┤
│  Type       │ Status    │ APIs Found │ Duration │ Date           │
│─────────────┼───────────┼────────────┼──────────┼────────────────│
│  full-scan  │ COMPLETED │     6      │  12s     │ 29 Mar 10:30  │
│  full-scan  │ COMPLETED │     6      │  15s     │ 28 Mar 14:00  │
│  network    │ COMPLETED │     6      │   8s     │ 27 Mar 09:00  │
│  full-scan  │ FAILED    │     0      │   2s     │ 26 Mar 16:00  │
├─────────────────────────────────────────────────────────────────┤
│  [< 1 >]                                                         │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation:**

```jsx
'use client';
// Fetch: useSWR('/api/scans/history?page=1&limit=20', fetcher)

// "Run Full Scan" button at top right
// ScanProgress component visible when scan is running (from useScanProgress hook)

// Table:
// - Type: badge with scan type
// - Status: COMPLETED (green), FAILED (red), RUNNING (yellow/animated)
// - APIs Found: number
// - Duration: calculate from started_at and completed_at (show as "12s", "1m 5s")
// - Date: formatted timestamp

// Pagination: page controls at bottom
```

---

## Data Fetching Pattern

All pages should use SWR for data fetching:

```jsx
import useSWR from 'swr';

const fetcher = (url) => fetch(url).then(res => res.json());

// In component:
const { data, error, isLoading, mutate } = useSWR('/api/stats/overview', fetcher, {
  refreshInterval: 30000,  // Auto-refresh every 30s
});

if (isLoading) return <LoadingSkeleton />;
if (error) return <ErrorState message={error.message} />;
```

---

## Loading & Error States

Every page should handle:
- **Loading**: Show skeleton/shimmer UI (use Shadcn Skeleton component)
- **Error**: Show error message with retry button
- **Empty**: Show "No data" message with appropriate icon

---

## Acceptance Criteria

1. Overview page shows stat cards with correct numbers from backend
2. Pie chart renders status distribution
3. Line chart renders risk trend over time
4. "Run Full Scan" button triggers scan and shows real-time progress
5. API Inventory shows filterable, searchable, paginated table
6. Clicking a table row navigates to API detail page
7. API Detail page shows all metadata, security checklist, findings, and audit log
8. Decommission and honeypot buttons work with confirmation dialogs
9. Zombie Center shows zombie APIs as cards with action buttons
10. Bulk selection and bulk block works
11. Scan History shows past scans with duration calculation
12. All pages have loading, error, and empty states
13. SWR auto-refreshes data periodically
14. Dark theme looks consistent across all pages

---

## Does NOT Include

- Shared components (Task 10)
- Layout/sidebar (Task 10)
- API client/WebSocket (Task 10)
- Dependency Map page (Task 12)
- Backend API (Tasks 06-09)
