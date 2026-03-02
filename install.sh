#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ProxyHub — standalone Linux installer
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/khalmohak/proxyhub/main/install.sh | bash
#   — or —
#   git clone https://github.com/khalmohak/proxyhub && cd proxyhub && bash install.sh
#
# What this script does:
#   1. Checks for Node.js ≥ 18 (optionally installs via nvm)
#   2. Installs npm dependencies (backend + frontend)
#   3. Builds the React frontend
#   4. Creates a .env file if one doesn't exist
#   5. Optionally installs a systemd service for auto-start on boot
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

PROXYHUB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIN_NODE_MAJOR=18

info()    { echo -e "${CYAN}  →${NC} $*"; }
success() { echo -e "${GREEN}  ✓${NC} $*"; }
warn()    { echo -e "${YELLOW}  !${NC} $*"; }
error()   { echo -e "${RED}  ✗${NC} $*"; exit 1; }
header()  { echo -e "\n${BOLD}$*${NC}"; }

# ── 1. Node.js check ─────────────────────────────────────────────────────────
header "Checking Node.js..."

if command -v node &>/dev/null; then
  NODE_MAJOR=$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
  if [ "$NODE_MAJOR" -lt "$MIN_NODE_MAJOR" ]; then
    warn "Node.js v${NODE_MAJOR} found but v${MIN_NODE_MAJOR}+ is required."
    ASK_INSTALL_NODE=true
  else
    success "Node.js $(node -v) found"
    ASK_INSTALL_NODE=false
  fi
else
  warn "Node.js not found."
  ASK_INSTALL_NODE=true
fi

if [ "$ASK_INSTALL_NODE" = "true" ]; then
  echo ""
  echo "  Install Node.js automatically via nvm? [Y/n]"
  read -r INSTALL_NODE_ANSWER </dev/tty
  INSTALL_NODE_ANSWER="${INSTALL_NODE_ANSWER:-Y}"

  if [[ "$INSTALL_NODE_ANSWER" =~ ^[Yy]$ ]]; then
    info "Installing nvm + Node.js ${MIN_NODE_MAJOR}..."
    # Install nvm
    export NVM_DIR="${HOME}/.nvm"
    if [ ! -d "$NVM_DIR" ]; then
      curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    fi
    # shellcheck source=/dev/null
    source "${NVM_DIR}/nvm.sh"
    nvm install "${MIN_NODE_MAJOR}"
    nvm use "${MIN_NODE_MAJOR}"
    nvm alias default "${MIN_NODE_MAJOR}"
    success "Node.js $(node -v) installed"
  else
    error "Node.js ${MIN_NODE_MAJOR}+ is required. Install it from https://nodejs.org and re-run this script."
  fi
fi

# ── 2. Install dependencies ───────────────────────────────────────────────────
header "Installing dependencies..."

info "Backend..."
npm install --prefix "${PROXYHUB_DIR}/backend" --silent
success "Backend dependencies installed"

info "Frontend..."
npm install --prefix "${PROXYHUB_DIR}/frontend" --silent
success "Frontend dependencies installed"

# ── 3. Build frontend ─────────────────────────────────────────────────────────
header "Building frontend..."
npm run --prefix "${PROXYHUB_DIR}/frontend" build 2>&1 | grep -E "(dist|error|warning|✓)" || true
success "Frontend built → frontend/dist"

# ── 4. Create .env ────────────────────────────────────────────────────────────
header "Configuration..."

ENV_FILE="${PROXYHUB_DIR}/.env"
if [ ! -f "$ENV_FILE" ]; then
  cp "${PROXYHUB_DIR}/.env.example" "$ENV_FILE"

  # Generate a random JWT secret
  JWT_SECRET=$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")
  # Use sed to set the value (compatible with both GNU and BSD sed)
  sed -i.bak "s|JWT_SECRET=change-me-to-a-long-random-secret|JWT_SECRET=${JWT_SECRET}|" "$ENV_FILE"
  rm -f "${ENV_FILE}.bak"

  success "Created .env with a generated JWT secret"
  warn "Edit ${ENV_FILE} to set ADMIN_PASSWORD or complete onboarding on first launch."
else
  success ".env already exists — skipping"
fi

# ── 5. Systemd service (optional) ─────────────────────────────────────────────
header "Systemd service..."

INSTALL_SYSTEMD=false
if command -v systemctl &>/dev/null && [ "$(id -u)" = "0" ]; then
  echo "  Install as a systemd service (auto-start on boot)? [Y/n]"
  read -r SYSTEMD_ANSWER </dev/tty
  SYSTEMD_ANSWER="${SYSTEMD_ANSWER:-Y}"
  [[ "$SYSTEMD_ANSWER" =~ ^[Yy]$ ]] && INSTALL_SYSTEMD=true
elif command -v systemctl &>/dev/null; then
  warn "Not running as root — skipping systemd setup (re-run with sudo to enable)."
else
  warn "systemd not found — skipping service setup."
fi

if [ "$INSTALL_SYSTEMD" = "true" ]; then
  SERVICE_FILE="/etc/systemd/system/proxyhub.service"
  NODE_BIN=$(command -v node)

  cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=ProxyHub - Self-hosted rotating proxy manager
After=network.target

[Service]
Type=simple
User=${SUDO_USER:-$(whoami)}
WorkingDirectory=${PROXYHUB_DIR}
ExecStart=${NODE_BIN} ${PROXYHUB_DIR}/backend/src/index.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=proxyhub
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable proxyhub
  systemctl restart proxyhub

  success "systemd service installed and started"
  info "Commands: sudo systemctl [start|stop|restart|status] proxyhub"
  info "Logs:     sudo journalctl -u proxyhub -f"
else
  echo ""
  echo -e "  ${YELLOW}To start ProxyHub manually:${NC}"
  echo -e "  ${BOLD}  cd ${PROXYHUB_DIR} && npm start${NC}"
  echo ""
  echo -e "  ${YELLOW}Or add to your shell profile to auto-start:${NC}"
  echo -e "  ${BOLD}  node ${PROXYHUB_DIR}/backend/src/index.js &${NC}"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
API_PORT=$(grep -E '^API_PORT=' "$ENV_FILE" 2>/dev/null | cut -d= -f2 || echo "3000")
API_PORT="${API_PORT:-3000}"

echo ""
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ProxyHub installed successfully!${NC}"
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════${NC}"
echo ""
echo -e "  Dashboard  →  ${BOLD}http://localhost:${API_PORT}${NC}"
echo -e "  Proxy port →  ${BOLD}$(grep -E '^PROXY_PORT=' "$ENV_FILE" 2>/dev/null | cut -d= -f2 || echo "8080")${NC}"
echo ""
echo -e "  Config file: ${ENV_FILE}"
echo ""
