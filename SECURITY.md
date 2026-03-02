# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest (`main`) | ✅ |
| older releases | ❌ |

We only actively patch the latest release. If you're running an older version, please upgrade before reporting.

---

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, report them privately so we can address them before public disclosure.

### How to report

Send an email to **security@khalmohak.com** (replace with your actual address) with:

1. A description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Any suggested mitigations (optional)

You should receive an acknowledgement within **48 hours** and a status update within **7 days**.

### Coordinated disclosure

We follow a **90-day coordinated disclosure** policy:

- We will investigate and prepare a fix
- We will notify you when a patch is ready
- We will publish a security advisory and release simultaneously
- Credit will be given in the advisory unless you prefer to remain anonymous

---

## Security Considerations for Self-Hosters

When running ProxyHub in production:

### Must-do

- Set a strong, unique `JWT_SECRET` (at least 32 random characters)
- Set a strong `DB_PASSWORD`
- Set a strong admin password during onboarding
- **Do not expose port 5432** (PostgreSQL) to the internet — it's internal only

### Recommended

- Run behind a reverse proxy (nginx, Caddy, Traefik) with TLS
- Restrict the API port (`:3000`) to localhost or internal network — expose only the dashboard (`:8888`) and proxy (`:8080`) publicly
- Set `REQUIRE_AUTH=true` so only registered devices can use the proxy
- Rotate device API keys periodically via the Devices page

### Auth model

- The dashboard is protected by a JWT signed with `JWT_SECRET`
- Proxy credentials (username = password = device API key) are UUID v4 tokens stored in PostgreSQL
- Passwords are stored hashed with `scrypt` (Node.js built-in crypto) — plain-text passwords are never persisted
- The `ADMIN_PASSWORD` env var, if set, overrides the stored hash — useful for resets but keep it secret

### Known limitations

- The proxy server itself communicates over plain HTTP — use a TLS-terminating reverse proxy in front if end-to-end encryption is required
- Rate limiting is not implemented — consider adding it at the nginx/Caddy layer for public deployments
