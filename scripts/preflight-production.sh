#!/bin/sh
set -eu

APP_DIR="${APP_DIR:-/opt/4n-dev-core}"
DOMAIN="${1:-}"

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: run as root."
  exit 1
fi

[ -d "$APP_DIR" ] || { echo "ERROR: app directory not found: $APP_DIR"; exit 1; }
[ -f "$APP_DIR/.env" ] || { echo "ERROR: .env not found."; exit 1; }

cd "$APP_DIR"

echo "== 4N DEV Core production preflight =="

command -v docker >/dev/null 2>&1 || { echo "ERROR: Docker missing."; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "ERROR: Docker Compose missing."; exit 1; }
command -v git >/dev/null 2>&1 || { echo "ERROR: Git missing."; exit 1; }

if [ -n "$DOMAIN" ]; then
  echo "Domain: $DOMAIN"
  if command -v getent >/dev/null 2>&1; then
    if ! getent hosts "$DOMAIN" >/dev/null 2>&1; then
      echo "WARNING: DNS does not currently resolve for $DOMAIN"
    else
      echo "OK: DNS resolves."
    fi
  fi
fi

echo "Checking required production files..."
for file in Dockerfile docker-compose.yml .env.docker.example nginx/4n-core-bootstrap.conf.example nginx/4n-core-https.conf.example scripts/deploy-production.sh scripts/enable-https.sh scripts/backup-postgres.sh scripts/upload-postgres-backup.sh scripts/restore-postgres.sh scripts/verify-postgres-restore.sh scripts/disaster-recovery.sh; do
  [ -f "$file" ] || { echo "ERROR: missing $file"; exit 1; }
  echo "OK: $file"
done

echo "Checking .env permissions..."
PERMS="$(stat -c '%a' .env 2>/dev/null || true)"
[ "$PERMS" = "600" ] || echo "WARNING: .env permissions are $PERMS; recommended: 600"

echo "Checking Docker Compose configuration..."
docker compose config >/dev/null

echo "Checking required environment placeholders..."
if grep -Eq 'replace-with-|your-domain\.example|admin@example\.com' .env; then
  echo "ERROR: .env still contains production placeholders."
  exit 1
fi

echo ""
echo "PREFLIGHT PASSED."
