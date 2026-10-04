#!/bin/sh
set -eu

BACKUP_FILE="${1:-}"
DATABASE_NAME="${DATABASE_NAME:-4ncore}"
DATABASE_USER="${DATABASE_USER:-4ncore}"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: ./scripts/restore-postgres.sh /path/to/4ncore-backup.sql.gz"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: backup file not found: $BACKUP_FILE"
  exit 1
fi

case "$BACKUP_FILE" in
  *.sql.gz) ;;
  *)
    echo "ERROR: backup must be a .sql.gz file."
    exit 1
    ;;
esac

if ! docker compose ps --services --status running | grep -qx "postgres"; then
  echo "ERROR: PostgreSQL container is not running."
  exit 1
fi

echo ""
echo "WARNING: This will restore data into PostgreSQL database: $DATABASE_NAME"
echo "Existing tables/data may be overwritten by the SQL contained in the backup."
echo ""
printf "Type RESTORE to continue: "
read CONFIRM

if [ "$CONFIRM" != "RESTORE" ]; then
  echo "Restore cancelled."
  exit 1
fi

echo "Restoring PostgreSQL backup..."

gunzip -c "$BACKUP_FILE" | docker compose exec -T postgres \
  psql -U "$DATABASE_USER" -d "$DATABASE_NAME" -v ON_ERROR_STOP=1

echo ""
echo "PostgreSQL restore completed successfully."
echo "Recommended next step: verify the application and /health/db."
