# Contributing to ProxyHub

Thank you for taking the time to contribute! This document covers everything you need to get started.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Commit Style](#commit-style)
- [Pull Request Process](#pull-request-process)
- [Project Structure](#project-structure)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

---

## Code of Conduct

Be respectful, inclusive, and constructive. We follow the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/) standard. Harassment or discrimination of any kind will not be tolerated.

---

## How to Contribute

There are many ways to help:

- **Fix a bug** — check the [Issues](../../issues) tab for anything labelled `bug`
- **Implement a feature** — look for `good first issue` or `help wanted` labels
- **Improve docs** — typos, unclear sections, missing examples are all fair game
- **Review pull requests** — thoughtful code review helps everyone
- **Report bugs** — detailed bug reports save maintainers hours of debugging
- **Suggest features** — open a discussion or feature request issue

---

## Development Setup

### Prerequisites
- Node.js ≥ 18
- Docker + Docker Compose (for PostgreSQL)
- Git

### Fork and clone

```bash
# Fork on GitHub, then:
git clone https://github.com/<your-username>/proxyhub.git
cd proxyhub
```

### Start the database only

```bash
docker compose up postgres -d
```

### Run the backend

```bash
cd backend
npm install
# Create a local .env pointing at localhost DB
cat > .env <<EOF
DB_HOST=localhost
DB_PORT=5432
DB_NAME=proxymanager
DB_USER=postgres
DB_PASSWORD=proxymanager123
API_PORT=3000
PROXY_PORT=8080
REQUIRE_AUTH=false
JWT_SECRET=dev-secret-not-for-production
SYNC_INTERVAL_MINUTES=0
EOF

npm run dev
```

### Run the frontend

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

The Vite dev server proxies `/api` to `localhost:3000` automatically via `vite.config.js`.

---

## Commit Style

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(optional scope): short description

Optional body — explain the "why", not the "what".
```

**Types:**

| Type | When to use |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes only |
| `style` | Formatting, missing semicolons — no logic change |
| `refactor` | Code restructure without feature or fix |
| `perf` | Performance improvement |
| `test` | Adding or fixing tests |
| `chore` | Build, CI, dependency updates |

**Examples:**

```
feat(proxies): add SOCKS5 support to bulk import
fix(auth): prevent timing attack in password comparison
docs: document sync-metadata endpoint in README
chore: upgrade jsonwebtoken to v9
```

---

## Pull Request Process

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes.** Keep PRs focused — one feature or fix per PR.

3. **Test manually** — run the full stack and verify your change works end-to-end.

4. **Update docs** — if you add/change an API endpoint, update `README.md`.

5. **Open a PR** against `main`. Fill out the PR template completely.

6. **Respond to review** — address comments or explain your reasoning.

7. A maintainer will merge once approved.

### What makes a good PR

- Small and focused (easier to review)
- Clear title following commit convention
- Description explains *why*, not just *what*
- No unrelated changes mixed in
- Existing behaviour is not silently broken

---

## Project Structure

```
proxy-manager/
├── backend/src/
│   ├── index.js            Server entry + background scheduler
│   ├── db.js               Schema creation + column migrations
│   ├── proxy-server.js     Rotating proxy (proxy-chain)
│   ├── middleware/auth.js  JWT auth middleware
│   └── routes/             One file per resource
├── frontend/src/
│   ├── api.js              Axios client with auth interceptors
│   ├── context/            React context (auth state)
│   ├── components/         Shared UI (Layout, etc.)
│   └── pages/              One file per page/route
├── .env.example            Template for environment variables
├── docker-compose.yml
└── README.md
```

---

## Reporting Bugs

Use the **Bug Report** issue template. Include:

- What you did (steps to reproduce)
- What you expected to happen
- What actually happened
- Your environment (OS, Docker version, Node version)
- Any relevant logs (`docker compose logs backend`)

The more detail you provide, the faster it gets fixed.

---

## Suggesting Features

Use the **Feature Request** issue template. Describe:

- The problem you're trying to solve
- Your proposed solution
- Any alternatives you considered
- Why this would be useful to others (not just you)

---

## Questions?

Open a [GitHub Discussion](../../discussions) rather than an issue for general questions or ideas.
