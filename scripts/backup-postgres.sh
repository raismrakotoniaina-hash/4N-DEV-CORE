#!/bin/sh
set -eu

BACKUP_DIR="${1:-/opt/4n-dev-core/backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

mkdir -p "$BACKUP_DIR"

if ! docker compose ps --services --status running | grep -qx "postgres"; then
  echo "ERROR: PostgreSQL container is not running."
  exit 1
fi

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="$BACKUP_DIR/4ncore-$TIMESTAMP.sql.gz"

echo "Creating PostgreSQL backup..."

docker compose exec -T postgres \
  pg_dump -U 4ncore -d 4ncore \
  | gzip > "$BACKUP_FILE"

if [ ! -s "$BACKUP_FILE" ]; then
  rm -f "$BACKUP_FILE"
  echo "ERROR: backup file is empty."
  exit 1
fi

echo "Backup created: $BACKUP_FILE"

find "$BACKUP_DIR" -type f -name '4ncore-*.sql.gz' \
  -mtime +"$RETENTION_DAYS" -delete

echo "Old backups older than $RETENTION_DAYS days removed."
