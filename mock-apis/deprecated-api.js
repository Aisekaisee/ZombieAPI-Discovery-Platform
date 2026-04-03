const express = require('express');
const app = express();
app.use(express.json());

const PORT = 3012;
const VALID_TOKEN = 'Bearer valid-token-123';

function requireAuth(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || auth !== VALID_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'accounts-v1', deprecated: true });
});

app.get('/', (req, res) => {
  res.json({ service: 'accounts-v1', version: '1.0', deprecated: true, endpoints: ['GET /api/v1/accounts', 'GET /health'] });
});

app.get('/api/v1/accounts', requireAuth, (req, res) => {
  // No rate limiting — never added in v1
  res.json({
    version: '1.0',
    data: {
      accounts: [
        { account_number: 'XXXX-XXXX-1234', name: 'Vipul Kumar', type: 'savings', balance: '45,000.00', branch_code: 'MUM001' },
        { account_number: 'XXXX-XXXX-5678', name: 'Priya Sharma', type: 'current', balance: '1,25,000.00', branch_code: 'DEL002' },
      ],
    },
    deprecated: true,
    message: 'This API version is deprecated. Please migrate to /api/v2/accounts',
  });
});

app.listen(PORT, () => {
  console.log(`[deprecated-api] Accounts v1 (deprecated) running on port ${PORT}`);
});
