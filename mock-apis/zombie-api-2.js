const express = require('express');
const app = express();
app.use(express.json());

const PORT = 3014;

// ZOMBIE API — no auth, no rate limit, no HTTPS, returns loan data with PII
// This simulates an old loans API forgotten after a system migration

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'loans-v1' });
});

app.get('/', (req, res) => {
  res.json({ service: 'loans-v1', version: '1.0', endpoints: ['GET /api/v1/loans'] });
});

app.get('/api/v1/loans', (req, res) => {
  // No authentication, no rate limiting — full PII including Aadhaar and account numbers
  res.json({
    loans: [
      {
        loan_id: 'LN001',
        borrower: 'Rajesh Kumar Sharma',
        aadhaar: '2345 6789 0123',
        account_number: '1234567890123456',
        loan_type: 'home',
        amount: 3500000,
        emi: 28500,
        outstanding: 2800000,
        status: 'active',
        disbursement_date: '2022-06-15',
      },
      {
        loan_id: 'LN002',
        borrower: 'Sunita Devi',
        aadhaar: '5678 9012 3456',
        account_number: '4567890123456789',
        loan_type: 'personal',
        amount: 500000,
        emi: 12500,
        outstanding: 375000,
        status: 'active',
        disbursement_date: '2023-01-10',
      },
    ],
  });
});

app.listen(PORT, () => {
  console.log(`[zombie-api-2] Loans v1 (ZOMBIE) running on port ${PORT}`);
});
