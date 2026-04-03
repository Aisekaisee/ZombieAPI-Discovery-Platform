const express = require('express');
const app = express();
app.use(express.json());

const PORT = 3011;
const VALID_TOKEN = 'Bearer valid-token-123';
const RATE_LIMIT_MAX = 10;
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
  res.json({ status: 'ok', service: 'transfers-v2' });
});

app.get('/', (req, res) => {
  res.json({ service: 'transfers-v2', version: '2.0', endpoints: ['GET /api/v2/transfers', 'POST /api/v2/transfers', 'GET /health'] });
});

app.get('/api/v2/transfers', requireAuth, applyRateLimit, (req, res) => {
  res.json({
    transfers: [
      { id: 'TXN001', from: 'ACC001', to: 'ACC002', amount: 5000, status: 'completed', date: '2026-03-28' },
      { id: 'TXN002', from: 'ACC003', to: 'ACC001', amount: 12000, status: 'completed', date: '2026-03-27' },
      { id: 'TXN003', from: 'ACC002', to: 'ACC003', amount: 8500, status: 'completed', date: '2026-03-26' },
    ],
  });
});

app.post('/api/v2/transfers', requireAuth, applyRateLimit, (req, res) => {
  const { from, to, amount } = req.body || {};
  if (!from || !to || !amount) {
    return res.status(400).json({ error: 'from, to, and amount are required' });
  }
  res.json({
    transfer_id: 'TXN' + Date.now(),
    status: 'completed',
    from,
    to,
    amount,
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`[active-api-2] Transfers v2 running on port ${PORT}`);
});
