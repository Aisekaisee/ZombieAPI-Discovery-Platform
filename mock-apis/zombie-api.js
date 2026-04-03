const express = require('express');
const app = express();
app.use(express.json());

const PORT = 3013;

// ZOMBIE API — no auth, no rate limit, no HTTPS, returns full PII
// This simulates an old forgotten API that was never decommissioned

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'customers-v1' });
});

app.get('/', (req, res) => {
  res.json({ service: 'customers-v1', version: '1.0', endpoints: ['GET /api/v1/customers'] });
});

app.get('/api/v1/customers', (req, res) => {
  // No authentication, no rate limiting — full PII in response
  res.json({
    customers: [
      {
        id: 1,
        name: 'Rajesh Kumar Sharma',
        aadhaar: '2345 6789 0123',
        pan: 'ABCPK1234M',
        phone: '9876543210',
        email: 'rajesh.sharma@email.com',
        account_number: '1234567890123456',
        address: '42 MG Road, Mumbai 400001',
        dob: '1985-03-15',
      },
      {
        id: 2,
        name: 'Priya Patel',
        aadhaar: '3456 7890 1234',
        pan: 'BCDPP5678N',
        phone: '8765432109',
        email: 'priya.patel@email.com',
        account_number: '2345678901234567',
        address: '15 Anna Salai, Chennai 600002',
        dob: '1990-07-22',
      },
      {
        id: 3,
        name: 'Amit Singh Rathore',
        aadhaar: '4567 8901 2345',
        pan: 'CDERS9012P',
        phone: '7654321098',
        email: 'amit.rathore@email.com',
        account_number: '3456789012345678',
        address: '78 Connaught Place, New Delhi 110001',
        dob: '1988-11-30',
      },
    ],
  });
});

app.listen(PORT, () => {
  console.log(`[zombie-api] Customers v1 (ZOMBIE) running on port ${PORT}`);
});
