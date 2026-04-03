const express = require('express');
const app = express();
app.use(express.json());

const PORT = 3010;
const VALID_TOKEN = 'Bearer valid-token-123';
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 10000;

const rateLimit = {};

function checkRateLimit(ip) {
  const now = Date.now();
  if (!rateLimit[ip] || now - rateLimit[ip].start > RATE_LIMIT_WINDOW_MS) {
    rateLimit[ip] = { start: now, count: 1 };
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }
  rateLimit[ip].count++;
  const remaining = Math.max(0, RATE_LIMIT_MAX - rateLimit[ip].count);
  return { allowed: rateLimit[ip].count <= RATE_LIMIT_MAX, remaining };
}

function requireAuth(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || auth !== VALID_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function applyRateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
  const { allowed, remaining } = checkRateLimit(ip);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX);
  res.setHeader('X-API-Version', '2.0');
  if (!allowed) {
    res.setHeader('Retry-After', '10');
    return res.status(429).json({ error: 'Too Many Requests', retryAfter: 10 });
  }
  next();
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'accounts-v2' });
});

app.get('/', (req, res) => {
  res.json({ service: 'accounts-v2', version: '2.0', endpoints: ['GET /api/v2/accounts', 'GET /health'] });
});

app.get('/api/v2/accounts', requireAuth, applyRateLimit, (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json({
    accounts: [
      { id: 'ACC001', holder: 'V****l K***r', type: 'savings', balance: 45000.00, branch: 'Mumbai Main' },
      { id: 'ACC002', holder: 'P****a S***a', type: 'current', balance: 125000.00, branch: 'Delhi North' },
      { id: 'ACC003', holder: 'R***h G***a', type: 'savings', balance: 78500.00, branch: 'Bangalore Central' },
    ],
  });
});

app.listen(PORT, () => {
  console.log(`[active-api] Accounts v2 running on port ${PORT}`);
});
