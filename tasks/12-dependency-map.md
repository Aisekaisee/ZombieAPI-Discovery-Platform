# Task 12: Dependency Map Page

> **Assignee:** Team Member 12
> **Dependencies:** Read `00-shared-contracts.md`. Needs Task 10 (frontend setup, shared components).
> **Estimated Effort:** Medium
> **Files Owned:**
> - `frontend/app/dashboard/map/page.jsx`
> - `frontend/components/DependencyGraph.jsx`

---

## Objective

Build the interactive dependency map using React Flow that visualizes service-to-API connections. This is a P2 feature — build it last, only if time permits.

---

## Files to Create

### 1. `frontend/components/DependencyGraph.jsx`

```jsx
// Interactive graph showing service → API dependencies
// Props: { apis: Array<API> }
//
// Uses: reactflow (React Flow library)
//
// Node types:
//   1. Service nodes (left side) — represent mock bank services
//      - "Mobile Banking App"
//      - "Payment Gateway"
//      - "Internal Admin"
//      - "Legacy System"
//   2. API nodes (right side) — represent discovered APIs
//      - Each API from the apis list
//
// Edge types:
//   - Service → API connections (based on traffic/usage patterns)
//   - Color: green if API is healthy, red if API is zombie/critical
//
// Node styling:
//   - Service nodes: rounded rectangle, blue/gray
//   - API nodes: colored by status (green=active, red=zombie, orange=shadow, etc.)
//   - Size proportional to traffic volume (optional)
//
// Layout:
//   - Left column: Service nodes
//   - Right column: API nodes
//   - Edges connect services to the APIs they depend on
//
// Interactions:
//   - Click a node → show details panel (sidebar or tooltip)
//   - Hover → highlight connected edges
//   - Zoom/pan support (built into React Flow)
//   - Minimap in corner

// Mock dependency data (since we don't have real traffic correlation):
const mockDependencies = [
  { service: 'Mobile Banking App', apis: ['/api/v2/accounts', '/api/v2/transfers'] },
  { service: 'Payment Gateway', apis: ['/api/v2/transfers', '/api/v1/accounts'] },
  { service: 'Internal Admin', apis: ['/api/v2/accounts', '/internal/debug/users'] },
  { service: 'Legacy System', apis: ['/api/v1/customers', '/api/v1/loans', '/api/v1/accounts'] },
];

// The "Legacy System" node should be highlighted in RED because it depends on zombie APIs.
// This visually demonstrates the risk of zombie dependencies.

// Implementation:
// 1. Create service nodes (left column, y-spaced evenly)
// 2. Create API nodes from apis prop (right column, y-spaced)
// 3. Create edges from mockDependencies, coloring red if target API is zombie
// 4. Use dagre or custom layout for positioning
// 5. Render with ReactFlow component

// import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
// import 'reactflow/dist/style.css';
```

### 2. `frontend/app/dashboard/map/page.jsx`

```jsx
'use client';
// Dependency Map page

// Layout:
// ┌──────────────────────────────────────────────────────────┐
// │  Dependency Map                                           │
// │  Shows which services depend on which APIs                │
// │  Red connections = service depends on zombie/critical API  │
// ├──────────────────────────────────────────────────────────┤
// │                                                          │
// │  ┌─────────────────────────────────────────────────────┐ │
// │  │                                                     │ │
// │  │    [Mobile App] ──────── [/api/v2/accounts ✓]      │ │
// │  │         │                                           │ │
// │  │         └──────────── [/api/v2/transfers ✓]        │ │
// │  │                              │                      │ │
// │  │    [Payment GW] ─────────────┘                      │ │
// │  │         │                                           │ │
// │  │         └──────────── [/api/v1/accounts ⚠]         │ │
// │  │                              │                      │ │
// │  │    [Internal Admin] ──── [/internal/debug ☠]       │ │
// │  │                                                     │ │
// │  │    [Legacy System] ─── [/api/v1/customers ☠]       │ │
// │  │         │                                           │ │
// │  │         └──────────── [/api/v1/loans ☠]            │ │
// │  │                                                     │ │
// │  └─────────────────────────────────────────────────────┘ │
// │                                                          │
// │  Legend: ✓ Active  ⚠ Deprecated  ☠ Zombie/Shadow         │
// │                                                          │
// │  ┌─ Selected Node Details ────────────────────────────┐  │
// │  │  Legacy System                                      │  │
// │  │  Depends on: 3 APIs (2 ZOMBIE, 1 DEPRECATED)       │  │
// │  │  ⚠ HIGH RISK: This service uses zombie APIs        │  │
// │  └────────────────────────────────────────────────────┘  │
// └──────────────────────────────────────────────────────────┘

// Fetch APIs: useSWR('/api/apis', fetcher)
// Pass to DependencyGraph component
// Add selected node details panel below or as sidebar

// Selected node state:
// const [selectedNode, setSelectedNode] = useState(null);
// On node click → set selectedNode
// Show details panel with:
//   - Node name (service or API)
//   - If service: list dependent APIs with status
//   - If API: full metadata, risk score, status badge
//   - Link to API detail page if it's an API node
```

---

## React Flow Setup

```bash
npm install reactflow
```

Key React Flow concepts used:
- `nodes` array: position, data, type, style
- `edges` array: source, target, animated, style
- Custom node components for services and APIs
- `onNodeClick` handler for selection
- `Background`, `Controls`, `MiniMap` utility components

---

## Custom Node Components

```jsx
// ServiceNode — blue rounded rectangle
function ServiceNode({ data }) {
  return (
    <div className={`px-4 py-3 rounded-lg border-2 ${data.hasZombieDep ? 'border-red-500 bg-red-950' : 'border-blue-500 bg-blue-950'}`}>
      <div className="font-semibold text-white">{data.label}</div>
      <div className="text-xs text-gray-400">{data.apiCount} APIs</div>
      {data.hasZombieDep && <div className="text-xs text-red-400 mt-1">⚠ Zombie dependency</div>}
    </div>
  );
}

// ApiNode — colored by status
function ApiNode({ data }) {
  return (
    <div className={`px-3 py-2 rounded border-2 ${statusBorderColor(data.status)}`}>
      <div className="text-xs font-mono text-white">{data.method} {data.path}</div>
      <StatusBadge status={data.status} />
      <div className="text-xs text-gray-400">Risk: {data.risk_score}</div>
    </div>
  );
}
```

---

## Acceptance Criteria

1. Dependency map renders with service nodes on left, API nodes on right
2. Edges connect services to their dependent APIs
3. Zombie/critical API nodes are colored red
4. Services that depend on zombie APIs are highlighted with red border
5. Clicking a node shows its details in a panel
6. Zoom, pan, and minimap work
7. Legend explains the color coding
8. Graph renders correctly for 6 APIs and 4 services
9. Page handles loading and empty states

---

## Does NOT Include

- Shared components (Task 10)
- Backend API (Tasks 06-09)
- Other dashboard pages (Task 11)
