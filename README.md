<div align="center">

<img src="https://raw.githubusercontent.com/khalmohak/proxyhub/main/docs/logo.png" alt="ProxyHub" width="80" />

# ProxyHub

**Self-hosted rotating proxy manager with a modern dashboard**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-compose-2496ED?logo=docker&logoColor=white)](docker-compose.yml)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen?logo=node.js&logoColor=white)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/postgres-16-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![React](https://img.shields.io/badge/react-18-61DAFB?logo=react&logoColor=black)](https://react.dev)

[Features](#features) · [Quick Start](#quick-start) · [Configuration](#configuration) · [API Reference](#api-reference) · [Contributing](#contributing)

</div>

---

## What is ProxyHub?

ProxyHub is a **self-hosted proxy rotation and management system**. You bring your own upstream proxies (residential, datacenter, SOCKS5 — any format), and ProxyHub handles:

- **Rotating requests** across your proxy pool via a single local endpoint (`host:8080`)
- **Device management** — register clients with unique API keys
- **Health monitoring** — live connectivity checks with real exit-IP verification
- **Geo metadata** — automatic country / city / ISP enrichment via IP lookup
- **Full request logging** — every connection logged with device, target, status, and latency
- **Clean dashboard** — React UI with stats, charts, log search, and CSV export

One `docker compose up` and you're running.

---

## Features

| | |
|---|---|
| 🔄 **Rotating proxy server** | Round-robin across healthy upstreams on port 8080 |
| 🌍 **Geo metadata** | Country flag, city, ISP auto-fetched on health check |
| 🔑 **Device API keys** | UUID credentials — same value for username and password |
| 📊 **Live dashboard** | Stats cards, hourly bar chart, top proxies & devices |
| 📋 **Request logs** | Filter by device, proxy, status, host, date range — export CSV |
| 🔒 **Auth protection** | Onboarding wizard, JWT-protected dashboard, bcrypt password |
| 🔁 **Auto sync** | Background scheduler refreshes proxy health & geo on a cron |
| 🐳 **Docker-first** | Single `docker compose up --build` — no manual setup |
| ⚙️ **Settings page** | Edit server name, password, proxy config from the dashboard |
| 📤 **Bulk import** | Paste `host:port:user:pass` lines or upload a `.txt` file |

---

## Quick Start

**Prerequisites:** Docker + Docker Compose

```bash
git clone https://github.com/khalmohak/proxyhub.git
cd proxyhub

# 1. Copy and configure environment
cp .env.example .env
# Edit .env — at minimum set a strong DB_PASSWORD and JWT_SECRET

# 2. Start everything
docker compose up --build -d

# 3. Open the dashboard
open http://localhost:8888
```

On first open, the **setup wizard** guides you through:
1. Naming your server
2. Setting an admin password
3. Configuring the proxy port and auth mode

That's it — add proxies, register devices, start routing.

---

## Architecture

```
┌─────────────┐    JWT      ┌──────────────────────────────────┐
│  Browser /  │────────────▶│  React Dashboard  :8888 (nginx)  │
│  Dashboard  │             └──────────────┬───────────────────┘
└─────────────┘                            │ /api/* reverse proxy
                                           ▼
┌─────────────┐  host:port  ┌──────────────────────────────────┐
│   Device    │────────────▶│  Rotating Proxy Server  :8080    │
│  (any app)  │             │  (proxy-chain, round-robin)      │
└─────────────┘             └──────────────┬───────────────────┘
                                           │ upstream proxies
┌─────────────┐             ┌──────────────▼───────────────────┐
│  PostgreSQL │◀────────────│  Express API Server     :3000    │
│  :5432      │             │  Auth · Proxies · Devices · Logs │
└─────────────┘             └──────────────────────────────────┘
```

| Service | Port | Description |
|---|---|---|
| Dashboard | `:8888` | React UI served by nginx |
| API | `:3000` | Express REST API |
| Proxy | `:8080` | Rotating HTTP proxy endpoint |
| PostgreSQL | `:5432` | Internal only (not exposed by default) |

---

## Configuration

Copy `.env.example` to `.env` and set your values:

| Variable | Default | Description |
|---|---|---|
| `DB_PASSWORD` | `proxymanager123` | PostgreSQL password |
| `PROXY_PORT` | `8080` | Rotating proxy listen port |
| `API_PORT` | `3000` | REST API listen port |
| `FRONTEND_PORT` | `8888` | Dashboard port |
| `REQUIRE_AUTH` | `false` | Require device API key for proxy connections |
| `ADMIN_PASSWORD` | _(empty)_ | Override dashboard password via env (useful for headless deploys / resets) |
| `JWT_SECRET` | _(change me)_ | Secret for signing JWT tokens — **must be set in production** |
| `SYNC_INTERVAL_MINUTES` | `30` | How often the background scheduler syncs proxy health + geo. Set `0` to disable. |

> **Production checklist**
> - Set a unique `DB_PASSWORD`
> - Set a long random `JWT_SECRET`
> - Set `REQUIRE_AUTH=true` if devices should authenticate

---

## Adding Proxies

### Single proxy
Click **Add Proxy** in the dashboard and fill in the form.

### Bulk import
Click **Bulk Upload** and paste lines in `host:port:username:password` format:

```
89.249.192.26:6425:myuser:mypass
104.253.91.77:6510:myuser:mypass
45.131.66.0:3128:myuser:mypass
```

Or upload a `.txt` file with the same format. Duplicate entries are safely upserted.

### Health checks & geo metadata
After importing, click **Sync Metadata** to verify connectivity and enrich each proxy with its real exit IP, country, city, and ISP. A live progress panel shows results as they come in.

The background scheduler re-runs this automatically on the configured interval.

---

## Connecting Devices

Every registered device gets a **UUID API key**. Use it as both the proxy username and password.

### System proxy (macOS / Windows / Linux)
```
Host:     your-server-ip
Port:     8080
Username: <your-api-key>
Password: <your-api-key>
```

### Environment variables
```bash
export HTTP_PROXY="http://<api-key>:<api-key>@your-server-ip:8080"
export HTTPS_PROXY="http://<api-key>:<api-key>@your-server-ip:8080"
```

### curl
```bash
curl --proxy "http://<api-key>:<api-key>@your-server-ip:8080" https://api.ipify.org
```

### Node.js / Python / other
Set `HTTP_PROXY` / `HTTPS_PROXY` — most HTTP libraries respect these automatically.

> **Open mode:** if `REQUIRE_AUTH=false` (default), clients can connect without credentials.

---

## Dashboard Pages

| Page | Description |
|---|---|
| **Dashboard** | Stats cards, 24h request chart, top proxies & devices |
| **Proxies** | Add, bulk import, enable/disable, health-check, sync metadata, delete |
| **Devices** | Register devices, view API keys, toggle, delete |
| **Logs** | Full request log — filter by proxy, device, status, host, date. Export CSV |
| **Settings** | Server name, password, proxy config, auto-sync status |

---

## API Reference

All endpoints require a `Authorization: Bearer <token>` header after the initial setup (except `/api/auth/login`, `/api/settings/onboarding`, `/api/settings/setup`, and `/health`).

### Auth
```
POST   /api/auth/login              — { password } → { token, serverName }
GET    /api/auth/me                 — verify token, return identity
```

### Settings
```
GET    /api/settings/onboarding     — check if setup is complete (public)
POST   /api/settings/setup          — complete initial setup (public, one-time)
GET    /api/settings                — get all settings
PUT    /api/settings                — update settings
POST   /api/settings/change-password — change admin password
```

### Proxies
```
GET    /api/proxies                  — list all proxies (with geo metadata)
POST   /api/proxies                  — add single proxy
POST   /api/proxies/bulk             — bulk import (text body or .txt file upload)
PATCH  /api/proxies/:id/toggle       — enable / disable
POST   /api/proxies/:id/check        — health check + geo enrichment (single)
POST   /api/proxies/check-all        — health check all active proxies
POST   /api/proxies/sync-metadata    — async geo sync — returns immediately, poll /sync-status
GET    /api/proxies/sync-status      — live sync progress { running, current, total, results }
DELETE /api/proxies/:id              — delete proxy
```

### Devices
```
GET    /api/devices                  — list devices with request counts
POST   /api/devices                  — register device → returns api_key
PATCH  /api/devices/:id/toggle       — enable / disable
DELETE /api/devices/:id              — delete device
```

### Logs
```
GET    /api/logs                     — paginated logs
                                       ?limit, offset, proxy_id, device_id,
                                        status, from, to, target
GET    /api/logs/export              — CSV download (same filters, up to 50k rows)
```

### Stats
```
GET    /api/stats                    — aggregated stats + hourly chart data (last 24h)
```

---

## Development

### Prerequisites
- Node.js ≥ 18
- PostgreSQL 16 (or use Docker just for the DB)

### Run locally without Docker

```bash
# Start PostgreSQL (Docker only for DB)
docker compose up postgres -d

# Backend
cd backend
npm install
cp ../.env.example .env   # edit DB_HOST=localhost
npm run dev

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
# open http://localhost:5173
```

### Project structure
```
proxy-manager/
├── backend/
│   └── src/
│       ├── index.js          Express entry point + auto-sync scheduler
│       ├── db.js             PostgreSQL schema + migrations
│       ├── proxy-server.js   Rotating proxy (proxy-chain)
│       ├── middleware/
│       │   └── auth.js       JWT middleware
│       └── routes/
│           ├── auth.js       Login / identity
│           ├── settings.js   Onboarding + config
│           ├── proxies.js    Proxy CRUD + health + geo sync
│           ├── devices.js    Device management
│           ├── logs.js       Log query + CSV export
│           └── stats.js      Dashboard aggregations
└── frontend/
    └── src/
        ├── App.jsx           Route guards (auth + onboarding)
        ├── api.js            Axios client + API wrappers
        ├── context/
        │   └── AuthContext.jsx
        ├── components/
        │   └── Layout.jsx    Sidebar + nav + logout
        └── pages/
            ├── Dashboard.jsx
            ├── Proxies.jsx   + SyncPanel component
            ├── Devices.jsx
            ├── Logs.jsx
            ├── Settings.jsx
            ├── Login.jsx
            └── Onboarding.jsx
```

---

## Useful Commands

```bash
# View live backend logs
docker compose logs -f backend

# Connect to the database
docker compose exec postgres psql -U postgres -d proxymanager

# Rebuild after code changes
docker compose up --build -d backend

# Restart a single service
docker compose restart backend

# Stop everything (data preserved)
docker compose down

# Stop and wipe all data
docker compose down -v
```

---

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## Security

Found a vulnerability? See [SECURITY.md](SECURITY.md) for responsible disclosure instructions.

---

## License

[MIT](LICENSE) — free to use, modify, and distribute.
