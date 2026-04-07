require('dotenv').config();
const db = require('./client');

// ─── Seed data matching Mock API Expected Behaviors from 00-shared-contracts ──

const seedApis = [
  {
    path: '/api/v2/accounts',
    method: 'GET',
    host: 'localhost',
    port: 3010,
    status: 'ACTIVE',
    risk_score: 90,
    owner: 'accounts-team',
    discovery_sources: ['network', 'gateway', 'git', 'traffic'],
    auth_check: true,
    https_check: true,
    rate_limit_check: true,
    pii_check: false,
    pii_types: [],
  },
  {
    path: '/api/v2/transfers',
    method: 'GET',
    host: 'localhost',
    port: 3011,
    status: 'ACTIVE',
    risk_score: 85,
    owner: 'payments-team',
    discovery_sources: ['network', 'gateway', 'git', 'traffic'],
    auth_check: true,
    https_check: true,
    rate_limit_check: true,
    pii_check: false,
    pii_types: [],
  },
  {
    path: '/api/v1/accounts',
    method: 'GET',
    host: 'localhost',
    port: 3012,
    status: 'DEPRECATED',
    risk_score: 55,
    owner: 'accounts-team',
    discovery_sources: ['network', 'gateway', 'git'],
    auth_check: true,
    https_check: false,
    rate_limit_check: false,
    pii_check: false,
    pii_types: [],
  },
  {
    path: '/api/v1/customers',
    method: 'GET',
    host: 'localhost',
    port: 3013,
    status: 'ZOMBIE',
    risk_score: 5,
    owner: null,
    discovery_sources: ['network'],
    auth_check: false,
    https_check: false,
    rate_limit_check: false,
    pii_check: true,
    pii_types: ['aadhaar', 'pan', 'phone', 'email'],
  },
  {
    path: '/api/v1/loans',
    method: 'GET',
    host: 'localhost',
    port: 3014,
    status: 'ZOMBIE',
    risk_score: 10,
    owner: null,
    discovery_sources: ['network'],
    auth_check: false,
    https_check: false,
    rate_limit_check: false,
    pii_check: true,
    pii_types: ['aadhaar', 'account_number'],
  },
  {
    path: '/internal/debug/users',
    method: 'GET',
    host: 'localhost',
    port: 3015,
    status: 'SHADOW',
    risk_score: 0,
    owner: null,
    discovery_sources: ['network', 'traffic'],
    auth_check: false,
    https_check: false,
    rate_limit_check: false,
    pii_check: true,
    pii_types: ['aadhaar', 'pan', 'phone', 'email', 'password_hash', 'api_keys'],
  },
];

// Scan runs spread over the past week
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

const seedScanRuns = [
  { type: 'full-scan',    status: 'COMPLETED', apis_found: 6, started_at: daysAgo(6), completed_at: daysAgo(6) },
  { type: 'full-scan',    status: 'COMPLETED', apis_found: 6, started_at: daysAgo(4), completed_at: daysAgo(4) },
  { type: 'network-scan', status: 'COMPLETED', apis_found: 6, started_at: daysAgo(3), completed_at: daysAgo(3) },
  { type: 'full-scan',    status: 'FAILED',    apis_found: 0, started_at: daysAgo(2), completed_at: daysAgo(2) },
  { type: 'full-scan',    status: 'COMPLETED', apis_found: 6, started_at: daysAgo(1), completed_at: daysAgo(1) },
];

// Security findings for zombie and shadow APIs (indices 3, 4, 5 in seedApis)
const seedFindings = [
  // /api/v1/customers (port 3013) — ZOMBIE
  { api_index: 3, tool: 'zombieguard-auth-check',      severity: 'CRITICAL', owasp_category: 'API1:2023', description: 'Endpoint returns 200 with full response body when no Authorization header is sent' },
  { api_index: 3, tool: 'zombieguard-pii-check',       severity: 'CRITICAL', owasp_category: 'API3:2023', description: 'Response contains unmasked PII: aadhaar, pan, phone, email' },
  { api_index: 3, tool: 'zombieguard-https-check',     severity: 'HIGH',     owasp_category: 'API8:2023', description: 'Endpoint does not support HTTPS — data transmitted in plaintext' },
  { api_index: 3, tool: 'zombieguard-ratelimit-check', severity: 'MEDIUM',   owasp_category: 'API4:2023', description: 'No rate limiting detected — 25 consecutive requests all returned 200' },
  { api_index: 3, tool: 'zap',                         severity: 'HIGH',     owasp_category: 'API1:2023', description: 'Broken Object Level Authorization - No authentication required' },
  // /api/v1/loans (port 3014) — ZOMBIE
  { api_index: 4, tool: 'zombieguard-auth-check',      severity: 'CRITICAL', owasp_category: 'API1:2023', description: 'Endpoint returns 200 with full response body when no Authorization header is sent' },
  { api_index: 4, tool: 'zombieguard-pii-check',       severity: 'CRITICAL', owasp_category: 'API3:2023', description: 'Response contains unmasked PII: aadhaar, account_number' },
  { api_index: 4, tool: 'zombieguard-https-check',     severity: 'HIGH',     owasp_category: 'API8:2023', description: 'Endpoint does not support HTTPS — data transmitted in plaintext' },
  { api_index: 4, tool: 'zombieguard-ratelimit-check', severity: 'MEDIUM',   owasp_category: 'API4:2023', description: 'No rate limiting detected — 25 consecutive requests all returned 200' },
  // /internal/debug/users (port 3015) — SHADOW
  { api_index: 5, tool: 'zombieguard-auth-check',      severity: 'CRITICAL', owasp_category: 'API1:2023', description: 'Debug endpoint returns 200 with full database dump and credentials without any authentication' },
  { api_index: 5, tool: 'zombieguard-pii-check',       severity: 'CRITICAL', owasp_category: 'API3:2023', description: 'Response contains unmasked PII: aadhaar, pan, phone, email, password_hash, api_keys' },
  { api_index: 5, tool: 'zombieguard-https-check',     severity: 'HIGH',     owasp_category: 'API8:2023', description: 'Endpoint does not support HTTPS — credentials transmitted in plaintext' },
  { api_index: 5, tool: 'zombieguard-ratelimit-check', severity: 'MEDIUM',   owasp_category: 'API4:2023', description: 'No rate limiting detected — endpoint fully open to enumeration' },
  { api_index: 5, tool: 'zap',                         severity: 'CRITICAL', owasp_category: 'API7:2023', description: 'Security Misconfiguration - Internal debug endpoint exposed to network with DB credentials' },
  // /api/v1/accounts (port 3012) — DEPRECATED
  { api_index: 2, tool: 'zombieguard-https-check',     severity: 'HIGH',     owasp_category: 'API8:2023', description: 'Deprecated endpoint does not support HTTPS' },
  { api_index: 2, tool: 'zombieguard-ratelimit-check', severity: 'MEDIUM',   owasp_category: 'API4:2023', description: 'No rate limiting on deprecated v1 endpoint' },
];

// ─── Main seed function ───────────────────────────────────────────────────────

async function seed() {
  console.log('🌱 Seeding ZombieGuard database...\n');

  // 1. Clear all tables
  await db.query('TRUNCATE TABLE audit_logs, security_findings, scan_runs, apis RESTART IDENTITY CASCADE');
  console.log('✓ Cleared all tables');

  // 2. Insert APIs
  const apiIds = [];
  for (const api of seedApis) {
    const { rows } = await db.query(
      `INSERT INTO apis
         (path, method, host, port, status, risk_score, owner,
          discovery_sources, auth_check, https_check, rate_limit_check,
          pii_check, pii_types)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id`,
      [
        api.path, api.method, api.host, api.port, api.status, api.risk_score, api.owner,
        JSON.stringify(api.discovery_sources),
        api.auth_check, api.https_check, api.rate_limit_check,
        api.pii_check, JSON.stringify(api.pii_types),
      ]
    );
    apiIds.push(rows[0].id);
    console.log(`  ✓ API: ${api.method} ${api.path} [${api.status}] risk=${api.risk_score}`);
  }
  console.log(`\n✓ Inserted ${apiIds.length} APIs`);

  // 3. Insert scan runs
  for (const run of seedScanRuns) {
    await db.query(
      `INSERT INTO scan_runs (type, status, apis_found, started_at, completed_at)
       VALUES ($1,$2,$3,$4,$5)`,
      [run.type, run.status, run.apis_found, run.started_at, run.completed_at]
    );
  }
  console.log(`✓ Inserted ${seedScanRuns.length} scan runs`);

  // 4. Insert security findings (using resolved api IDs)
  for (const f of seedFindings) {
    const apiId = apiIds[f.api_index];
    await db.query(
      `INSERT INTO security_findings (api_id, tool, severity, owasp_category, description)
       VALUES ($1,$2,$3,$4,$5)`,
      [apiId, f.tool, f.severity, f.owasp_category, f.description]
    );
  }
  console.log(`✓ Inserted ${seedFindings.length} security findings`);

  // 5. Insert audit logs — DISCOVERED events for each API
  for (let i = 0; i < seedApis.length; i++) {
    const api = seedApis[i];
    const apiId = apiIds[i];

    // DISCOVERED
    await db.query(
      `INSERT INTO audit_logs (api_id, action, new_value, performed_by, created_at)
       VALUES ($1,'DISCOVERED',$2,'network-scanner',$3)`,
      [apiId, JSON.stringify({ path: api.path, port: api.port, source: 'network' }), daysAgo(6)]
    );

    // STATUS_CHANGED (UNKNOWN → actual status)
    await db.query(
      `INSERT INTO audit_logs (api_id, action, old_value, new_value, performed_by, created_at)
       VALUES ($1,'STATUS_CHANGED',$2,$3,'classifier',$4)`,
      [
        apiId,
        JSON.stringify({ status: 'UNKNOWN' }),
        JSON.stringify({ status: api.status }),
        daysAgo(6),
      ]
    );

    // SECURITY_ASSESSED for all APIs
    await db.query(
      `INSERT INTO audit_logs (api_id, action, new_value, performed_by, created_at)
       VALUES ($1,'SECURITY_ASSESSED',$2,'security-runner',$3)`,
      [apiId, JSON.stringify({ risk_score: api.risk_score }), daysAgo(5)]
    );
  }
  console.log(`✓ Inserted audit logs (DISCOVERED + STATUS_CHANGED + SECURITY_ASSESSED for each API)`);

  console.log('\n✅ Seed complete!\n');

  // Summary
  const { rows: apiCount }     = await db.query('SELECT count(*) FROM apis');
  const { rows: scanCount }    = await db.query('SELECT count(*) FROM scan_runs');
  const { rows: findingCount } = await db.query('SELECT count(*) FROM security_findings');
  const { rows: auditCount }   = await db.query('SELECT count(*) FROM audit_logs');
  console.log(`Database state:`);
  console.log(`  apis:               ${apiCount[0].count}`);
  console.log(`  scan_runs:          ${scanCount[0].count}`);
  console.log(`  security_findings:  ${findingCount[0].count}`);
  console.log(`  audit_logs:         ${auditCount[0].count}`);

  await db.pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
