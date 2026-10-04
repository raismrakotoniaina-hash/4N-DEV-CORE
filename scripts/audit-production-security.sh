#!/bin/sh
set -eu

APP_DIR="${APP_DIR:-/opt/4n-dev-core}"
if [ "$(id -u)" -ne 0 ]; then echo "ERROR: run as root."; exit 1; fi
[ -d "$APP_DIR" ] || { echo "ERROR: app directory not found: $APP_DIR"; exit 1; }
cd "$APP_DIR"

echo "== 4N DEV Core production security audit =="

check_file() { [ -f "$1" ] || { echo "FAIL: missing $1"; exit 1; }; echo "OK: $1"; }

for file in Dockerfile docker-compose.yml .env scripts/preflight-production.sh scripts/finalize-vps-security.sh scripts/verify-postgres-backup.sh scripts/verify-latest-postgres-backup.sh; do
  check_file "$file"
done

PERMS="$(stat -c "%a" .env 2>/dev/null || true)"
[ "$PERMS" = "600" ] || { echo "FAIL: .env permissions are $PERMS; expected 600."; exit 1; }
echo "OK: .env permissions 600"

grep -q "^USER node$" Dockerfile || { echo "FAIL: Core Dockerfile does not run as node."; exit 1; }
grep -q "no-new-privileges:true" docker-compose.yml || { echo "FAIL: container privilege escalation protection missing."; exit 1; }
! grep -qE "^[[:space:]]*- \"3001:3001\"|^[[:space:]]*- \"5432:5432\"" docker-compose.yml || { echo "FAIL: internal ports are publicly published."; exit 1; }
echo "OK: container and port exposure checks"

grep -q "health/ready" docker-compose.yml || { echo "FAIL: Core readiness healthcheck missing."; exit 1; }
grep -q "pg_isready" docker-compose.yml || { echo "FAIL: PostgreSQL healthcheck missing."; exit 1; }
echo "OK: healthchecks"

if command -v systemctl >/dev/null 2>&1; then
  for timer in 4n-postgres-backup.timer 4n-backup-monitor.timer 4n-certbot-renew.timer 4n-disk-monitor.timer 4n-docker-health-monitor.timer; do
    systemctl is-enabled --quiet "$timer" || { echo "WARNING: $timer is not enabled on this server."; }
  done
fi

echo "Checking firewall state..."
if command -v ufw >/dev/null 2>&1; then
  ufw status | grep -q "Status: active" || { echo "FAIL: UFW is not active."; exit 1; }
  echo "OK: UFW active"
else
  echo "WARNING: UFW is not installed."
fi

echo ""
echo "SECURITY AUDIT PASSED."
echo "Warnings above indicate VPS-side configuration still to be enabled or verified."
