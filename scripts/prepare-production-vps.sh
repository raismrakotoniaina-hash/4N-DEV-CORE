#!/bin/sh
set -eu

APP_DIR="${APP_DIR:-/opt/4n-dev-core}"
DOMAIN="${1:-}"

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: run as root."
  exit 1
fi

if [ -z "$DOMAIN" ]; then
  echo "Usage: ./scripts/prepare-production-vps.sh api.example.com"
  exit 1
fi

case "$DOMAIN" in
  *[!A-Za-z0-9.-]*|.*|*.) echo "ERROR: invalid domain: $DOMAIN"; exit 1 ;;
esac

if [ ! -d "$APP_DIR/.git" ]; then
  echo "ERROR: repository not found at $APP_DIR."
  echo "Run bootstrap-production-server.sh first."
  exit 1
fi

cd "$APP_DIR"

echo "=========================================="
echo "4N DEV CORE - PRODUCTION VPS PREPARATION"
echo "=========================================="

echo ""
echo "[1/6] Applying VPS security..."
./scripts/finalize-vps-security.sh

echo ""
echo "[2/6] Installing production automation..."
./scripts/install-production-timers.sh

echo ""
echo "[3/6] Preparing application environment..."
if [ ! -f .env ]; then
  cp .env.docker.example .env
  chmod 600 .env
  echo "Created .env from production template."
  echo "IMPORTANT: fill all real secrets in $APP_DIR/.env, then run this script again."
  exit 1
fi
chmod 600 .env
./scripts/validate-production-env.sh

echo ""
echo "[4/6] Running production preflight..."
./scripts/preflight-production.sh "$DOMAIN"

echo ""
echo "[5/6] Starting production stack..."
./scripts/install-production-stack.sh "$DOMAIN"

echo ""
echo "[6/6] Running final production audit..."
if ./scripts/production-audit.sh; then
  echo ""
  echo "=========================================="
  echo "PRODUCTION VPS PREPARATION PASSED"
  echo "=========================================="
  echo ""
  echo "Next:"
  echo "1. Point DNS $DOMAIN to this VPS."
  echo "2. Run: ./scripts/enable-https.sh $DOMAIN admin@example.com"
  echo "3. Run: ./scripts/verify-production-https.sh $DOMAIN admin@example.com"
  exit 0
fi

echo ""
echo "PRODUCTION VPS PREPARATION FAILED."
echo "Run ./scripts/production-audit.sh to inspect the blocking issue(s)."
exit 1
