#!/bin/sh
set -eu

APP_DIR="${APP_DIR:-/opt/4n-dev-core}"
HEALTH_RETRIES="${HEALTH_RETRIES:-24}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups/postgres}"
LOCK_DIR="/var/lock/4n-dev-core-update"

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: run as root."
  exit 1
fi

if [ ! -d "$APP_DIR/.git" ]; then
  echo "ERROR: repository not found at $APP_DIR."
  exit 1
fi

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "ERROR: another production update is already running."
  exit 1
fi
cleanup() {
  rmdir "$LOCK_DIR" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

cd "$APP_DIR"

echo "Checking current production state..."
docker compose ps || true

OLD_COMMIT="$(git rev-parse HEAD)"
echo "Current commit: $OLD_COMMIT"

echo "Creating PostgreSQL safety backup before update..."
mkdir -p "$BACKUP_DIR"
if [ -x "./scripts/backup-postgres.sh" ]; then
  BACKUP_DIR="$BACKUP_DIR" ./scripts/backup-postgres.sh
else
  echo "ERROR: PostgreSQL backup script is missing or not executable."
  exit 1
fi

LATEST_BACKUP="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name '4ncore-*.sql.gz' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -n 1 | cut -d' ' -f2-)"
if [ -z "$LATEST_BACKUP" ] || [ ! -s "$LATEST_BACKUP" ]; then
  echo "ERROR: no valid PostgreSQL backup was created."
  exit 1
fi
echo "Safety backup: $LATEST_BACKUP"

echo "Fetching latest main..."
git fetch origin main
REMOTE_COMMIT="$(git rev-parse origin/main)"

if [ "$OLD_COMMIT" = "$REMOTE_COMMIT" ]; then
  echo "Already up to date."
  exit 0
fi

echo "Updating repository..."
git checkout main
git reset --hard origin/main

rollback_code() {
  echo "Restoring application code to $OLD_COMMIT..."
  git reset --hard "$OLD_COMMIT"
}

if [ ! -f ".env" ]; then
  echo "ERROR: .env is missing after update."
  rollback_code
  exit 1
fi

chmod 600 .env

echo "Validating production environment..."
if ! ./scripts/validate-production-env.sh; then
  rollback_code
  exit 1
fi

echo "Validating production configuration..."
if ! ./scripts/preflight-production.sh "${DOMAIN:-api.example.com}"; then
  rollback_code
  exit 1
fi

echo "Rebuilding and restarting Core..."
if ! docker compose up -d --build core; then
  echo "ERROR: Core rebuild failed."
  rollback_code
  docker compose up -d --build core
  exit 1
fi

echo "Waiting for Core readiness..."
attempt=1
while [ "$attempt" -le "$HEALTH_RETRIES" ]; do
  if docker compose exec -T core node -e "fetch('http://127.0.0.1:3001/health/ready').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"; then
    echo "OK: new Core version is healthy."
    echo ""
    docker compose ps
    echo ""
    echo "Updated from:"
    echo "$OLD_COMMIT"
    echo "to:"
    echo "$REMOTE_COMMIT"
    echo "PostgreSQL safety backup:"
    echo "$LATEST_BACKUP"
    exit 0
  fi

  sleep 5
  attempt=$((attempt + 1))
done

echo "ERROR: new Core version failed readiness."
echo ""
docker compose logs --tail=120 core || true

rollback_code

echo "Rebuilding previous Core version..."
docker compose up -d --build core

echo "Waiting for rollback readiness..."
attempt=1
while [ "$attempt" -le "$HEALTH_RETRIES" ]; do
  if docker compose exec -T core node -e "fetch('http://127.0.0.1:3001/health/ready').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"; then
    echo "ROLLBACK OK: previous Core version restored."
    echo "Recovery backup remains available at: $LATEST_BACKUP"
    exit 1
  fi

  sleep 5
  attempt=$((attempt + 1))
done

echo "CRITICAL: rollback version did not become healthy."
docker compose ps
echo "Recovery backup remains available at: $LATEST_BACKUP"
exit 2
