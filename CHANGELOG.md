# Changelog

All notable changes to ProxyHub are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [1.0.0] — 2026-03-02

### Added

#### Core
- Rotating HTTP proxy server on configurable port (default `:8080`) using `proxy-chain`
- Round-robin selection across healthy, active upstream proxies
- PostgreSQL-backed data layer with automatic schema creation and column migrations

#### Dashboard
- React 18 + Vite + Tailwind CSS frontend
- **Dashboard page** — stat cards (total proxies, healthy, devices, requests/1h, total), 24h bar chart, top proxies and devices by usage
- **Proxies page** — add single, bulk import (`host:port:user:pass`), enable/disable, health check, delete
- **Devices page** — register devices with auto-generated UUID API keys, connection instructions
- **Logs page** — filterable request log (proxy, device, status, host, date range), CSV export
- **Settings page** — server name/admin name, password change, proxy config, auto-sync status

#### Auth & Onboarding
- 4-step onboarding wizard on first launch (server name → password → proxy config → review)
- JWT-protected dashboard with 7-day token expiry
- `scrypt`-hashed admin passwords stored in DB; `ADMIN_PASSWORD` env override for headless deploys
- `REQUIRE_AUTH` mode gates proxy connections behind device API key validation

#### Proxy Metadata & Geo
- Health checks verify real exit IP via `ipify.org`
- Automatic geo enrichment (country, country_code, city, ISP) via `ip-api.com`
- Country flag emoji rendered in proxy table
- **Sync Metadata** button — async geo refresh for all active proxies
- Live sync progress panel with per-proxy results, progress bar, and health counts

#### Background Automation
- Configurable background scheduler (`SYNC_INTERVAL_MINUTES`, default 30 min) re-checks all active proxies and refreshes geo metadata
- `last_auto_sync` timestamp stored in settings and displayed in Settings page

#### API
- Full REST API with JWT auth middleware
- `/api/auth/login`, `/api/auth/me`
- `/api/settings/*` — onboarding, setup, CRUD, password change
- `/api/proxies/*` — CRUD, health check, bulk import, async sync, sync-status
- `/api/devices/*` — CRUD
- `/api/logs` — paginated query + CSV export
- `/api/stats` — aggregated dashboard data

#### Infrastructure
- Docker Compose stack (PostgreSQL 16, Node.js backend, nginx-served React frontend)
- `.env.example` with all variables documented
- Health-check on PostgreSQL service before backend starts

---

[Unreleased]: https://github.com/khalmohak/proxyhub/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/khalmohak/proxyhub/releases/tag/v1.0.0
