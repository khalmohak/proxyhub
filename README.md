<div align="center">

<img src="https://raw.githubusercontent.com/khalmohak/proxyhub/main/docs/logo.png" alt="ProxyHub" width="80" />

# ProxyHub

**Self-hosted rotating proxy manager with a modern dashboard**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen?logo=node.js&logoColor=white)](https://nodejs.org)
[![SQLite](https://img.shields.io/badge/SQLite-default_DB-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org)
[![PostgreSQL](https://img.shields.io/badge/postgres-optional-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![React](https://img.shields.io/badge/react-18-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Docker](https://img.shields.io/badge/docker-compose-2496ED?logo=docker&logoColor=white)](docker-compose.yml)

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
| 🗄 **SQLite by default** | Zero-config embedded DB — no external database needed |
| 🐘 **PostgreSQL optional** | Set `DB_TYPE=postgres` to use an external PostgreSQL instance |
| 🐳 **Docker support** | `docker compose up --build` for a fully containerised deployment |
| ⚙️ **Settings page** | Edit server name, password, proxy config from the dashboard |
| 📤 **Bulk import** | Paste `host:port:user:pass` lines or upload a `.txt` file |

---

## Quick Start

### Option A — Standalone (no Docker required)

**Prerequisites:** Node.js ≥ 18 · npm

```bash
git clone https://github.com/khalmohak/proxyhub.git
cd proxyhub

# One-command install (installs deps, builds UI, creates .env, optional systemd)
bash install.sh
```

Then open **http://localhost:3000** — the setup wizard runs on first visit.

**Manual steps** (same thing, step by step):

```bash
# 1. Install dependencies
npm run setup        # installs backend + frontend node_modules

# 2. Create your .env
cp .env.example .env
# Edit .env — set JWT_SECRET to a long random string

# 3. Build the React UI
npm run build

# 4. Start the server  (dashboard + API served from port 3000)
npm start
```

> **Database:** SQLite is used by default — a single file at `~/.proxyhub/proxyhub.db`. No PostgreSQL needed. To use PostgreSQL instead, set `DB_TYPE=postgres` and the `DB_HOST/DB_NAME/DB_USER/DB_PASSWORD` vars in `.env`.

**Development mode** (hot-reload for both backend and frontend):

```bash
npm run dev
# Frontend dev server → http://localhost:5173
# Backend API         → http://localhost:3000
```

---

### Option B — Docker Compose

**Prerequisites:** Docker + Docker Compose

```bash
git clone https://github.com/khalmohak/proxyhub.git
cd proxyhub

# 1. Copy and configure environment
cp .env.example .env
# Edit .env — set DB_TYPE=postgres, a strong DB_PASSWORD and JWT_SECRET

# 2. Start everything
docker compose up --build -d

# 3. Open the dashboard
open http://localhost:8888
```

---

On first open, the **setup wizard** guides you through:
1. Naming your server
2. Setting an admin password
3. Configuring the proxy port and auth mode

That's it — add proxies, register devices, start routing.

---

## Architecture

**Standalone mode** (single Node.js process, SQLite):

```
┌─────────────┐  host:port  ┌──────────────────────────────────┐
│   Device    │────────────▶│  Rotating Proxy Server  :8080    │
│  (any app)  │             │  (proxy-chain, round-robin)      │
└─────────────┘             └──────────────┬───────────────────┘
                                           │
┌─────────────┐             ┌──────────────▼───────────────────┐
│  SQLite DB  │◀────────────│  Express (API + Dashboard) :3000 │
│  ~/.proxyhub│             │  Auth · Proxies · Devices · Logs │
└─────────────┘             └──────────────────────────────────┘
```

**Docker mode** (PostgreSQL, nginx):

```
┌─────────────┐    JWT      ┌──────────────────────────────────┐
│  Browser /  │────────────▶│  React Dashboard  :8888 (nginx)  │
│  Dashboard  │             └──────────────┬───────────────────┘
└─────────────┘                            │ /api/* reverse proxy
                                           ▼
┌─────────────┐  host:port  ┌──────────────────────────────────┐
│   Device    │────────────▶│  Rotating Proxy Server  :8080    │
│  (any app)  │             └──────────────┬───────────────────┘
└─────────────┘                            │
┌─────────────┐             ┌──────────────▼───────────────────┐
│  PostgreSQL │◀────────────│  Express API Server     :3000    │
│  :5432      │             │  Auth · Proxies · Devices · Logs │
└─────────────┘             └──────────────────────────────────┘
```

| Service | Standalone | Docker | Description |
|---|---|---|---|
| Dashboard + API | `:3000` | `:8888` / `:3000` | Web UI + REST API |
| Proxy | `:8080` | `:8080` | Rotating HTTP proxy endpoint |
| Database | SQLite file | PostgreSQL `:5432` | Storage |

---

## Configuration

Copy `.env.example` to `.env` and set your values:

| Variable | Default | Description |
|---|---|---|
| **Database** | | |
| `DB_TYPE` | `sqlite` | Database backend: `sqlite` or `postgres` |
| `DB_PATH` | `~/.proxyhub/proxyhub.db` | SQLite file path (only when `DB_TYPE=sqlite`) |
| `DB_HOST` | `localhost` | PostgreSQL host (only when `DB_TYPE=postgres`) |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `proxymanager` | PostgreSQL database name |
| `DB_USER` | `postgres` | PostgreSQL user |
| `DB_PASSWORD` | `proxymanager123` | PostgreSQL password |
| **Ports** | | |
| `PROXY_PORT` | `8080` | Rotating proxy listen port |
| `API_PORT` | `3000` | REST API + dashboard port (standalone) |
| `FRONTEND_PORT` | `8888` | Dashboard port (Docker/nginx only) |
| **Auth** | | |
| `REQUIRE_AUTH` | `false` | Require device API key for proxy connections |
| `ADMIN_PASSWORD` | _(empty)_ | Override dashboard password via env (useful for headless deploys / resets) |
| `JWT_SECRET` | _(change me)_ | Secret for signing JWT tokens — **must be set in production** |
| **Sync** | | |
| `SYNC_INTERVAL_MINUTES` | `30` | How often the background scheduler syncs proxy health + geo. Set `0` to disable. |

> **Production checklist**
> - Set a long random `JWT_SECRET`
> - For SQLite: ensure `DB_PATH` points to a persistent directory
> - For PostgreSQL: set a unique `DB_PASSWORD`
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
| **Settings** | Server name, password, proxy config, auto-sync, database status |

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

### Hot-reload dev mode (SQLite, no Docker needed)

```bash
git clone https://github.com/khalmohak/proxyhub.git
cd proxyhub
npm run setup        # installs backend + frontend dependencies
cp .env.example .env # set JWT_SECRET
npm run dev
# Frontend → http://localhost:5173  (Vite dev server, hot-reload)
# Backend  → http://localhost:3000  (nodemon, auto-restart)
```

### Production build (standalone)

```bash
npm run build        # compiles React → frontend/dist
npm start            # serves dashboard + API on port 3000, proxy on 8080
# open http://localhost:3000
```

### Run as a Linux system service (systemd)

```bash
# Automated (run as root or with sudo)
sudo bash install.sh

# Manual
sudo cp proxyhub.service /etc/systemd/system/
# Edit WorkingDirectory and User in the service file
sudo systemctl daemon-reload
sudo systemctl enable --now proxyhub

# Logs
sudo journalctl -u proxyhub -f
```

### Using PostgreSQL instead of SQLite

```bash
# .env
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=proxymanager
DB_USER=postgres
DB_PASSWORD=your_password
```

Or spin up just the PostgreSQL container from the Docker Compose file:

```bash
docker compose up postgres -d
# then npm start with DB_TYPE=postgres in .env
```

### Project structure

```
proxyhub/
├── backend/
│   └── src/
│       ├── index.js          Express entry point + static serving + auto-sync
│       ├── db.js             SQLite + PostgreSQL adapter with SQL translation layer
│       ├── proxy-server.js   Rotating proxy (proxy-chain)
│       ├── middleware/
│       │   └── auth.js       JWT middleware
│       └── routes/
│           ├── auth.js       Login / identity
│           ├── settings.js   Onboarding + config
│           ├── proxies.js    Proxy CRUD + health + geo sync
│           ├── devices.js    Device management
│           ├── logs.js       Log query + CSV export
│           ├── stats.js      Dashboard aggregations
│           └── db.js         DB status + connection test
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
            ├── Settings.jsx  (General · Security · Proxy · Auto Sync · Database)
            ├── Login.jsx
            └── Onboarding.jsx
```

---

## Useful Commands

**Standalone:**

```bash
npm start                    # start production server
npm run dev                  # start dev servers (hot-reload)
npm run build                # rebuild frontend
sudo journalctl -u proxyhub -f   # view service logs (systemd)
```

**Docker:**

```bash
# View live backend logs
docker compose logs -f backend

# Connect to the database
docker compose exec postgres psql -U postgres -d proxymanager

# Rebuild after code changes
docker compose up --build -d backend

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
