# Task 01: Docker & Infrastructure Setup

> **Assignee:** Team Member 1
> **Dependencies:** Read `00-shared-contracts.md` first
> **Estimated Effort:** Small
> **Files Owned:** `docker-compose.yml`, `nginx/default.conf`, `nginx/access.log`, `.env`, `.gitignore`, `.dockerignore`

---

## Objective

Set up Docker Compose to orchestrate all services and create the Nginx gateway configuration that acts as the mock API gateway.

---

## Files to Create

### 1. `docker-compose.yml`

Services to define:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    environment:
      POSTGRES_USER: zombieguard
      POSTGRES_PASSWORD: zombieguard
      POSTGRES_DB: zombieguard
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./backend/src/db/schema.sql:/docker-entrypoint-initdb.d/schema.sql

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  nginx:
    image: nginx:alpine
    ports: ["8888:80"]
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf
      - ./nginx/access.log:/var/log/nginx/access.log
    depends_on:
      - mock-active-1
      - mock-active-2
      - mock-deprecated

  zap:
    image: ghcr.io/zaproxy/zaproxy:stable
    ports: ["8080:8080"]
    command: zap.sh -daemon -host 0.0.0.0 -port 8080 -config api.key=zombieguard-zap-key -config api.addrs.addr.name=.* -config api.addrs.addr.regex=true
    # Optional — can be commented out if not needed for initial dev

  mock-active-1:
    build: ./mock-apis
    command: node active-api.js
    ports: ["3010:3010"]

  mock-active-2:
    build: ./mock-apis
    command: node active-api-2.js
    ports: ["3011:3011"]

  mock-deprecated:
    build: ./mock-apis
    command: node deprecated-api.js
    ports: ["3012:3012"]

  mock-zombie-1:
    build: ./mock-apis
    command: node zombie-api.js
    ports: ["3013:3013"]

  mock-zombie-2:
    build: ./mock-apis
    command: node zombie-api-2.js
    ports: ["3014:3014"]

  mock-shadow:
    build: ./mock-apis
    command: node shadow-api.js
    ports: ["3015:3015"]

  backend:
    build: ./backend
    ports: ["3000:3000"]
    env_file: .env
    depends_on:
      - postgres
      - redis
    volumes:
      - ./nginx:/app/nginx  # for reading nginx config
      - ./mock-apis:/app/mock-apis  # for git scanner

  frontend:
    build: ./frontend
    ports: ["3001:3000"]
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3000
      NEXT_PUBLIC_WS_URL: http://localhost:3000
    depends_on:
      - backend

volumes:
  pgdata:
```

**Notes:**
- Mock APIs share a single Dockerfile in `mock-apis/` with different `command` entries
- Backend mounts `nginx/` and `mock-apis/` directories so scanners can read them
- Zombie and shadow APIs are NOT routed through Nginx (this is intentional — they exist outside the gateway)

### 2. `nginx/default.conf`

This is the mock API gateway. Only "registered" APIs (active + deprecated) are routed through it. Zombie and shadow APIs are intentionally absent.

```nginx
# Mock bank API gateway
# Only registered APIs are routed here

server {
    listen 80;
    server_name localhost;

    # Access log for traffic analysis
    access_log /var/log/nginx/access.log;

    # Active API v2 - accounts
    location /api/v2/accounts {
        proxy_pass http://mock-active-1:3010;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Active API v2 - transfers
    location /api/v2/transfers {
        proxy_pass http://mock-active-2:3011;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Deprecated API v1 - accounts (still registered but no traffic)
    location /api/v1/accounts {
        proxy_pass http://mock-deprecated:3012;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # NOTE: /api/v1/customers (port 3013) is NOT registered — zombie
    # NOTE: /api/v1/loans (port 3014) is NOT registered — zombie
    # NOTE: /internal/debug/users (port 3015) is NOT registered — shadow

    # Health check
    location /health {
        return 200 'OK';
        add_header Content-Type text/plain;
    }

    # Deny block placeholder — decommission engine will add rules here
    # DENY_RULES_START
    # DENY_RULES_END
}
```

**Important:** The `DENY_RULES_START` / `DENY_RULES_END` markers are used by the decommission engine (Task 09) to programmatically insert deny rules.

### 3. `nginx/access.log`

Create a sample access log file with realistic entries for the traffic log analyzer. Include entries for active APIs (high traffic), deprecated API (zero/minimal traffic), and NO entries for zombie/shadow APIs.

```
# Sample format: Combined Log Format
# Active APIs get lots of traffic, deprecated gets none
# Generate ~50 lines covering the last 7 days

# Example lines:
192.168.1.10 - - [28/Mar/2026:10:15:30 +0000] "GET /api/v2/accounts HTTP/1.1" 200 1234 "-" "BankApp/3.2"
192.168.1.11 - - [28/Mar/2026:10:15:31 +0000] "POST /api/v2/transfers HTTP/1.1" 200 567 "-" "BankApp/3.2"
192.168.1.12 - - [28/Mar/2026:10:16:00 +0000] "GET /api/v2/accounts HTTP/1.1" 200 1234 "-" "InternalService/1.0"
# ... more entries for /api/v2/accounts and /api/v2/transfers
# NO entries for /api/v1/customers, /api/v1/loans, or /internal/debug/users
```

Generate at least 50 realistic log entries with varied IPs, timestamps across 7 days, and user agents. Mix of `BankApp/3.2`, `InternalService/1.0`, `PaymentGateway/2.1`.

### 4. `.env`

Copy all variables from the "Environment Variables" section in `00-shared-contracts.md`.

### 5. `.gitignore`

```
node_modules/
.env
*.log
pgdata/
.next/
```

### 6. `mock-apis/Dockerfile`

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
EXPOSE 3010 3011 3012 3013 3014 3015
```

### 7. `mock-apis/package.json`

```json
{
  "name": "zombieguard-mock-apis",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.0"
  }
}
```

### 8. `backend/Dockerfile`

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "src/index.js"]
```

### 9. `frontend/Dockerfile`

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## Acceptance Criteria

1. `docker-compose up postgres redis` starts database and cache
2. `docker-compose up nginx` serves the gateway on port 8888
3. Nginx routes `/api/v2/accounts`, `/api/v2/transfers`, `/api/v1/accounts` to correct upstreams
4. Nginx does NOT route zombie/shadow API paths
5. `nginx/access.log` has realistic sample data
6. `.env` file has all required environment variables
7. Nginx config has `DENY_RULES_START`/`DENY_RULES_END` markers for decommission engine

---

## Does NOT Include

- Mock API application code (Task 02)
- Database schema SQL (Task 03)
- Backend application code (Task 04)
- Frontend application code (Task 10)
