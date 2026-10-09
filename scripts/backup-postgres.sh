#!/bin/sh
set -eu
umask 077

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Optional root-owned config file may define RCLONE_REMOTE for off-site copies.
if [ -r /etc/4n-dev-core/backup.env ]; then
  . /etc/4n-dev-core/backup.env
fi

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

if [ -n "${RCLONE_REMOTE:-}" ]; then
  if command -v rclone >/dev/null 2>&1; then
    rclone copyto "$BACKUP_FILE" "$RCLONE_REMOTE/$(basename "$BACKUP_FILE")"
    echo "Off-site copy completed."
  else
    echo "ERROR: RCLONE_REMOTE is set but rclone is not installed." >&2
    exit 1
  fi
fi

find "$BACKUP_DIR" -type f -name '4ncore-*.sql.gz' \
  -mtime +"$RETENTION_DAYS" -delete

echo "Old backups older than $RETENTION_DAYS days removed."
