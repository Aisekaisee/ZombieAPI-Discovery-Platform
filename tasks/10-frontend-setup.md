# Task 10: Frontend Setup, Layout & Shared Components

> **Assignee:** Team Member 10
> **Dependencies:** Read `00-shared-contracts.md` for API contracts.
> **Estimated Effort:** Medium
> **Files Owned:**
> - `frontend/package.json`
> - `frontend/app/layout.jsx`
> - `frontend/app/globals.css`
> - `frontend/app/page.jsx` (root redirect)
> - `frontend/tailwind.config.js`
> - `frontend/next.config.js`
> - `frontend/lib/api.js`
> - `frontend/lib/socket.js`
> - `frontend/lib/utils.js`
> - `frontend/components/ui/` (Shadcn components)
> - `frontend/components/StatusBadge.jsx`
> - `frontend/components/RiskScoreGauge.jsx`
> - `frontend/components/APITable.jsx`
> - `frontend/components/ZombieCard.jsx`
> - `frontend/components/ScanProgress.jsx`
> - `frontend/components/Sidebar.jsx`

---

## Objective

Set up the Next.js 14 project with Tailwind CSS and Shadcn/ui, create the app layout with sidebar navigation, build all shared/reusable components, and set up the API client + WebSocket connection. Other frontend tasks will import these components.

---

## Project Setup

### 1. Initialize Next.js with Tailwind + Shadcn

```bash
npx create-next-app@14 frontend --tailwind --eslint --app --src-dir=false
cd frontend
npx shadcn-ui@latest init
# Choose: New York style, Slate base color, CSS variables: yes
npx shadcn-ui@latest add button card badge table input select dialog sheet tabs separator
npm install recharts reactflow socket.io-client swr lucide-react
```

### 2. `frontend/next.config.js`

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/:path*`,
      },
    ];
  },
};
module.exports = nextConfig;
```

This proxies `/api/*` calls to the backend, avoiding CORS issues in development.

---

## Files to Create

### 3. `frontend/lib/api.js` — API Client

```js
// Central API client for all backend calls
// Uses fetch (or axios) with the base URL from env

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

// Generic fetch wrapper
async function fetchApi(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `API error: ${res.status}`);
  }
  return res.json();
}

// ── Scan operations ──
export const startFullScan = () => fetchApi('/api/scans/run', { method: 'POST' });
export const startScan = (type) => fetchApi(`/api/scans/run/${type}`, { method: 'POST' });
export const getScanStatus = () => fetchApi('/api/scans/status');
export const getScanHistory = (page = 1, limit = 20) =>
  fetchApi(`/api/scans/history?page=${page}&limit=${limit}`);

// ── API registry ──
export const getApis = ({ status, risk, search, page = 1, limit = 20 } = {}) => {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (risk) params.set('risk', risk);
  if (search) params.set('search', search);
  params.set('page', page);
  params.set('limit', limit);
  return fetchApi(`/api/apis?${params}`);
};
export const getApi = (id) => fetchApi(`/api/apis/${id}`);
export const getZombieApis = () => fetchApi('/api/apis/zombies');
export const getShadowApis = () => fetchApi('/api/apis/shadow');
export const updateApiStatus = (id, status, performedBy = 'admin') =>
  fetchApi(`/api/apis/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, performed_by: performedBy }),
  });

// ── Security ──
export const assessApi = (id) => fetchApi(`/api/security/assess/${id}`, { method: 'POST' });
export const getFindings = ({ severity, tool, page = 1 } = {}) => {
  const params = new URLSearchParams({ page });
  if (severity) params.set('severity', severity);
  if (tool) params.set('tool', tool);
  return fetchApi(`/api/security/findings?${params}`);
};
export const getApiFindings = (apiId) => fetchApi(`/api/security/findings/${apiId}`);

// ── Decommission ──
export const initiateDecommission = (id, mode = 'assisted', performedBy = 'admin') =>
  fetchApi(`/api/decommission/${id}/initiate`, {
    method: 'POST',
    body: JSON.stringify({ mode, performed_by: performedBy }),
  });
export const approveDecommission = (id, performedBy = 'admin') =>
  fetchApi(`/api/decommission/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ performed_by: performedBy }),
  });
export const getDecommissionQueue = () => fetchApi('/api/decommission/queue');

// ── Stats ──
export const getOverviewStats = () => fetchApi('/api/stats/overview');
export const getTrend = () => fetchApi('/api/stats/trend');
export const getRiskDistribution = () => fetchApi('/api/stats/risk');
```

### 4. `frontend/lib/socket.js` — WebSocket Client

```js
// Socket.IO client for real-time scan updates
// Usage: import { socket, useSocket } from '@/lib/socket';

import { io } from 'socket.io-client';
import { useEffect, useState } from 'react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';

// Singleton socket instance
let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(WS_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

// React hook for listening to socket events
export function useSocket(event, callback) {
  useEffect(() => {
    const s = getSocket();
    s.on(event, callback);
    return () => s.off(event, callback);
  }, [event, callback]);
}

// Hook for scan progress state
export function useScanProgress() {
  const [scanState, setScanState] = useState({
    running: false,
    jobId: null,
    progress: {},  // { network: 'completed', git: 'running', ... }
    totalFound: 0,
  });

  useSocket('scan:started', (data) => {
    setScanState({ running: true, jobId: data.jobId, progress: {}, totalFound: 0 });
  });

  useSocket('scan:progress', (data) => {
    setScanState(prev => ({
      ...prev,
      progress: { ...prev.progress, [data.scanner]: data.status },
      totalFound: prev.totalFound + (data.found || 0),
    }));
  });

  useSocket('scan:completed', (data) => {
    setScanState(prev => ({ ...prev, running: false, totalFound: data.totalFound }));
  });

  useSocket('scan:error', () => {
    setScanState(prev => ({ ...prev, running: false }));
  });

  return scanState;
}
```

### 5. `frontend/lib/utils.js` — Utility Functions

```js
// Shared utility functions

import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Risk score → color
export function getRiskColor(score) {
  if (score === null || score === undefined) return 'gray';
  if (score >= 80) return 'green';
  if (score >= 50) return 'yellow';
  if (score >= 20) return 'orange';
  return 'red';
}

// Risk score → label
export function getRiskLabel(score) {
  if (score === null || score === undefined) return 'Unknown';
  if (score >= 80) return 'Low Risk';
  if (score >= 50) return 'Medium Risk';
  if (score >= 20) return 'High Risk';
  return 'Critical';
}

// Status → color
export function getStatusColor(status) {
  const colors = {
    ACTIVE: 'green',
    DEPRECATED: 'yellow',
    ZOMBIE: 'red',
    SHADOW: 'orange',
    ORPHANED: 'purple',
    UNKNOWN: 'gray',
  };
  return colors[status] || 'gray';
}

// Format date
export function formatDate(dateStr) {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
```

### 6. `frontend/app/layout.jsx` — Root Layout

```jsx
// Root layout with sidebar navigation
// - Dark theme by default (dark class on html)
// - Sidebar on the left (fixed, 250px wide)
// - Main content area fills remaining space
// - Use Tailwind for all styling

// Sidebar links:
// - Overview         → /dashboard          (icon: LayoutDashboard)
// - API Inventory    → /dashboard/apis     (icon: Database)
// - Zombie Center    → /dashboard/zombies  (icon: Skull)
// - Dependency Map   → /dashboard/map      (icon: GitBranch)
// - Scan History     → /dashboard/scans    (icon: History)

// Header area in sidebar:
// - ZombieGuard logo/title
// - Subtitle: "API Security Platform"

// Use lucide-react for icons
```

### 7. `frontend/app/page.jsx` — Root Page

```jsx
// Redirect to /dashboard
import { redirect } from 'next/navigation';
export default function Home() {
  redirect('/dashboard');
}
```

### 8. `frontend/components/Sidebar.jsx`

```jsx
// Sidebar navigation component
// Props: none (reads current path from usePathname())
//
// Visual design:
// - Dark background (bg-gray-900 or bg-slate-900)
// - Logo area at top with skull/shield icon + "ZombieGuard" text
// - Navigation links with icons, active state highlighted
// - Each link shows active state when pathname matches
// - Bottom: small text "Zombie API Security"
//
// Use 'use client' directive
// Import Link from next/link, usePathname from next/navigation
// Import icons from lucide-react
```

---

## Shared Components

### 9. `frontend/components/StatusBadge.jsx`

```jsx
// Colored badge for API status
// Props: { status: "ACTIVE" | "DEPRECATED" | "ZOMBIE" | "SHADOW" | "ORPHANED" }
//
// Colors:
//   ACTIVE     → green background, white text
//   DEPRECATED → yellow background, dark text
//   ZOMBIE     → red background, white text
//   SHADOW     → orange background, white text
//   ORPHANED   → purple background, white text
//   UNKNOWN    → gray background
//
// Use Shadcn Badge component or custom div with Tailwind classes
// Render: <span className={badgeClasses}>{status}</span>
```

### 10. `frontend/components/RiskScoreGauge.jsx`

```jsx
// Circular gauge showing risk score 0-100
// Props: { score: number, size?: "sm" | "md" | "lg" }
//
// Visual:
// - Circular progress indicator (SVG circle with stroke-dashoffset)
// - Score number in the center (large, bold)
// - Risk level label below (Low/Medium/High/Critical)
// - Color changes based on score:
//   80-100: green stroke
//   50-79:  yellow stroke
//   20-49:  orange stroke
//   0-19:   red stroke
//
// Implementation: SVG with two circles (background + progress)
// Use 'use client' directive for any animations
```

### 11. `frontend/components/APITable.jsx`

```jsx
// Reusable sortable table for API listings
// Props: {
//   apis: Array<API>,
//   onRowClick?: (api) => void,
//   showPagination?: boolean,
//   page?: number,
//   total?: number,
//   onPageChange?: (page) => void,
// }
//
// Columns:
// | Method | Path | Host:Port | Status | Risk Score | Last Seen | Owner |
//
// Features:
// - Method shown in colored badge (GET=blue, POST=green, PUT=yellow, DELETE=red)
// - Status column uses StatusBadge component
// - Risk score column shows number + colored background
// - Clickable rows (calls onRowClick)
// - Sortable column headers (client-side sort)
// - Pagination controls at bottom
//
// Use Shadcn Table component
// Use 'use client' directive
```

### 12. `frontend/components/ZombieCard.jsx`

```jsx
// Card component for zombie API display (used in Zombie Center)
// Props: {
//   api: API,
//   onBlock?: (id) => void,
//   onHoneypot?: (id) => void,
//   onAssign?: (id) => void,
//   selected?: boolean,
//   onSelect?: (id) => void,
// }
//
// Layout:
// - Card with red/dark border
// - Header: Method + Path, risk score gauge (small)
// - Body:
//   - Host:Port
//   - Risk factors list: "No Auth", "PII Exposed", "No HTTPS", "No Rate Limit"
//     (each as a red/orange chip)
//   - Discovery sources
//   - Last seen date
// - Footer action buttons:
//   - Block (red button, shield icon)
//   - Honeypot (amber button, bug icon)
//   - Assign Owner (blue button, user icon)
// - Checkbox for bulk select (top-right corner)
//
// Use Shadcn Card + Button components
```

### 13. `frontend/components/ScanProgress.jsx`

```jsx
// Real-time scan progress indicator
// Props: {
//   scanState: { running, jobId, progress, totalFound }
//   // (from useScanProgress hook)
// }
//
// When not running: hidden or shows "No scan in progress"
//
// When running:
// - Animated header: "Scan in Progress..."
// - 4 scanner rows, each showing:
//   - Scanner name (Network, Gateway, Git, Traffic)
//   - Status icon: spinner (running), checkmark (completed), dash (pending)
//   - APIs found count (if completed)
// - Total found counter at bottom
// - Pulsing animation on the active scanner
//
// Use 'use client' directive
// Import useScanProgress from @/lib/socket
```

---

## Color Theme Reference

```css
/* For dark mode (default) */
--background: slate-950
--card: slate-900
--text: slate-100
--muted: slate-400
--border: slate-800

/* Status colors */
--status-active: emerald-500
--status-deprecated: amber-500
--status-zombie: red-500
--status-shadow: orange-500
--status-orphaned: purple-500

/* Risk colors */
--risk-low: emerald-500
--risk-medium: amber-500
--risk-high: orange-500
--risk-critical: red-500
```

---

## Acceptance Criteria

1. `npm run dev` starts Next.js on port 3001 (or 3000 standalone)
2. Root path `/` redirects to `/dashboard`
3. Sidebar navigation renders with all 5 links and icons
4. Active sidebar link is highlighted based on current route
5. `StatusBadge` renders correct colors for all 6 statuses
6. `RiskScoreGauge` shows circular gauge with correct color by score range
7. `APITable` renders sortable, clickable table with pagination
8. `ZombieCard` shows all risk factors and action buttons
9. `ScanProgress` shows real-time scanner progress from WebSocket
10. API client functions (`lib/api.js`) match all backend API contracts from `00-shared-contracts.md`
11. WebSocket connection auto-connects and reconnects
12. Dark theme looks polished

---

## Does NOT Include

- Dashboard page content (Task 11)
- API Inventory page (Task 11)
- Zombie Center page (Task 11)
- Scan History page (Task 11)
- Dependency Map page (Task 12)
