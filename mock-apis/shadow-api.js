const express = require('express');
const app = express();
app.use(express.json());

const PORT = 3015;

// SHADOW API — undocumented debug endpoint left open in production
// No auth, no rate limit, exposes passwords, API keys, DB config, and PII

const debugData = {
  _debug: true,
  _warning: 'INTERNAL USE ONLY',
  users: [
    {
      id: 1,
      username: 'admin',
      password_hash: '$2b$10$abcdef1234567890abcdef',
      role: 'superadmin',
      name: 'System Admin',
      email: 'admin@bank.internal',
      phone: '9999999999',
      last_login: '2025-12-01T10:00:00Z',
      api_keys: ['sk-live-abc123', 'sk-test-xyz789'],
    },
    {
      id: 2,
      username: 'rksharma',
      password_hash: '$2b$10$ghijkl1234567890ghijkl',
      role: 'branch_manager',
      name: 'Rajesh Kumar Sharma',
      email: 'rajesh.sharma@bank.internal',
      phone: '9876543210',
      aadhaar: '2345 6789 0123',
      pan: 'ABCPK1234M',
      last_login: '2026-03-15T14:30:00Z',
    },
  ],
  db_config: {
    host: 'db-primary.bank.internal',
    port: 5432,
    database: 'core_banking',
    username: 'app_user',
  },
};

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'debug-users' });
});

app.get('/', (req, res) => {
  res.json(debugData);
});

app.get('/internal/debug/users', (req, res) => {
  res.json(debugData);
});

app.listen(PORT, () => {
  console.log(`[shadow-api] Debug users (SHADOW) running on port ${PORT}`);
});
