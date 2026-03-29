# Task 04: Backend Core Server

> **Assignee:** Team Member 4
> **Dependencies:** Read `00-shared-contracts.md` first. Needs Task 03 (db client) to be done.
> **Estimated Effort:** Small
> **Files Owned:** `backend/src/index.js`, `backend/package.json`

---

## Objective

Create the Express server entry point that mounts all route modules, sets up CORS, body parsing, and Socket.IO for real-time events. This is the "shell" — other tasks provide the route handlers.

---

## Files to Create

### 1. `backend/package.json`

```json
{
  "name": "zombieguard-backend",
  "version": "1.0.0",
  "description": "ZombieGuard Backend API",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js",
    "seed": "node src/db/seed.js"
  },
  "dependencies": {
    "express": "^4.18.0",
    "pg": "^8.12.0",
    "bullmq": "^5.0.0",
    "ioredis": "^5.3.0",
    "socket.io": "^4.7.0",
    "node-cron": "^3.0.0",
    "cors": "^2.8.0",
    "dotenv": "^16.3.0",
    "axios": "^1.6.0"
  }
}
```

### 2. `backend/src/index.js`

```js
// Setup:
// 1. Load dotenv
// 2. Create Express app
// 3. Apply middleware: cors(), express.json()
// 4. Create HTTP server and attach Socket.IO
// 5. Store io instance globally or via app.set('io', io) so routes/engines can emit events
// 6. Mount routes:
//    - GET  /api/health       → { status: "ok", timestamp }
//    - use  /api/scans        → require('./routes/scans')        (Task 06)
//    - use  /api/apis         → require('./routes/apis')         (Task 08)
//    - use  /api/security     → require('./routes/security')     (Task 08)
//    - use  /api/decommission → require('./routes/decommission') (Task 09)
//    - use  /api/stats        → require('./routes/stats')        (Task 08)
// 7. Socket.IO connection handler — log connections/disconnections
// 8. Start server on PORT (default 3000)

// IMPORTANT: Route files may not exist yet when you build this.
// Use try/catch or conditional requires so the server starts even if route files are missing:
//
// try { app.use('/api/scans', require('./routes/scans')); }
// catch(e) { console.warn('Scans routes not yet available'); }
//
// This allows parallel development — the server works without all routes being ready.

// Socket.IO setup:
// const { Server } = require('socket.io');
// const io = new Server(httpServer, { cors: { origin: '*' } });
// app.set('io', io);
//
// io.on('connection', (socket) => {
//   console.log('Client connected:', socket.id);
//   socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
// });

// Export io for use by other modules:
// module.exports = { app, io, server };
// OR set it on app: app.set('io', io)
```

---

## How Other Tasks Access Socket.IO

Routes and engines that need to emit WebSocket events should get `io` from the Express app:

```js
// In any route handler:
const io = req.app.get('io');
io.emit('scan:progress', { scanner: 'network', status: 'running' });
```

Or import directly if exported:
```js
const { io } = require('../index');
```

The `app.set('io', io)` approach is preferred as it avoids circular dependencies.

---

## Acceptance Criteria

1. `npm start` (or `node src/index.js`) starts server on port 3000
2. `GET /api/health` returns `{ status: "ok", timestamp: "..." }`
3. CORS is enabled for all origins (development mode)
4. Server starts successfully even if route files don't exist yet
5. Socket.IO accepts WebSocket connections on the same port
6. `io` instance is accessible via `req.app.get('io')` in route handlers

---

## Does NOT Include

- Route handler implementations (Tasks 06, 08, 09)
- Database client (Task 03)
- Scanner or engine code
