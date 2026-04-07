-- ZombieGuard Database Schema
-- Drop in reverse dependency order for clean re-initialization

DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS security_findings CASCADE;
DROP TABLE IF EXISTS scan_runs CASCADE;
DROP TABLE IF EXISTS apis CASCADE;

-- ─── apis ────────────────────────────────────────────────────────────────────

CREATE TABLE apis (
  id            SERIAL PRIMARY KEY,
  path          VARCHAR(500) NOT NULL,
  method        VARCHAR(10) NOT NULL DEFAULT 'GET',
  host          VARCHAR(255) NOT NULL,
  port          INTEGER NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN'
                CHECK (status IN ('ACTIVE','DEPRECATED','ZOMBIE','SHADOW','ORPHANED','UNKNOWN')),
  risk_score    INTEGER DEFAULT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  owner         VARCHAR(255) DEFAULT NULL,
  discovery_sources JSONB DEFAULT '[]',
  last_called_at    TIMESTAMPTZ DEFAULT NULL,
  auth_check        BOOLEAN DEFAULT NULL,
  https_check       BOOLEAN DEFAULT NULL,
  rate_limit_check  BOOLEAN DEFAULT NULL,
  pii_check         BOOLEAN DEFAULT NULL,
  pii_types         JSONB DEFAULT '[]',
  decommission_status VARCHAR(20) DEFAULT NULL
                CHECK (decommission_status IN ('PENDING','APPROVED','BLOCKED','HONEYPOT', NULL)),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(host, port, path, method)
);

-- ─── scan_runs ───────────────────────────────────────────────────────────────

CREATE TABLE scan_runs (
  id            SERIAL PRIMARY KEY,
  type          VARCHAR(30) NOT NULL
                CHECK (type IN ('network-scan','gateway-scan','git-scan','log-scan','full-scan')),
  status        VARCHAR(20) NOT NULL DEFAULT 'RUNNING'
                CHECK (status IN ('RUNNING','COMPLETED','FAILED')),
  apis_found    INTEGER DEFAULT 0,
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  completed_at  TIMESTAMPTZ DEFAULT NULL
);

-- ─── security_findings ───────────────────────────────────────────────────────

CREATE TABLE security_findings (
  id              SERIAL PRIMARY KEY,
  api_id          INTEGER NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
  tool            VARCHAR(50) NOT NULL,
  severity        VARCHAR(20) NOT NULL CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  owasp_category  VARCHAR(100) DEFAULT NULL,
  description     TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── audit_logs ──────────────────────────────────────────────────────────────

CREATE TABLE audit_logs (
  id            SERIAL PRIMARY KEY,
  api_id        INTEGER REFERENCES apis(id) ON DELETE SET NULL,
  action        VARCHAR(50) NOT NULL,
  old_value     JSONB DEFAULT NULL,
  new_value     JSONB DEFAULT NULL,
  performed_by  VARCHAR(255) DEFAULT 'system',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX idx_apis_status           ON apis(status);
CREATE INDEX idx_apis_risk_score       ON apis(risk_score);
CREATE INDEX idx_apis_host_port        ON apis(host, port);

CREATE INDEX idx_security_findings_api_id   ON security_findings(api_id);
CREATE INDEX idx_security_findings_severity ON security_findings(severity);

CREATE INDEX idx_audit_logs_api_id    ON audit_logs(api_id);
CREATE INDEX idx_audit_logs_action    ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

CREATE INDEX idx_scan_runs_type       ON scan_runs(type);

-- ─── updated_at trigger ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER apis_updated_at
  BEFORE UPDATE ON apis
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
