#!/bin/sh
set -eu

BACKUP_FILE="${1:-}"
DATABASE_USER="${DATABASE_USER:-4ncore}"
VERIFY_DATABASE="${VERIFY_DATABASE:-4ncore_restore_verify}"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: ./scripts/verify-postgres-backup.sh /path/to/4ncore-backup.sql.gz"
  exit 1
fi

[ -f "$BACKUP_FILE" ] || {
  echo "ERROR: backup file not found: $BACKUP_FILE"
  exit 1
}

case "$BACKUP_FILE" in
  *.sql.gz) ;;
  *)
    echo "ERROR: backup must be a .sql.gz file."
    exit 1
    ;;
esac

command -v gzip >/dev/null 2>&1 || {
  echo "ERROR: gzip is required."
  exit 1
}

if ! docker compose ps --services --status running | grep -qx "postgres"; then
  echo "ERROR: PostgreSQL container is not running."
  exit 1
fi

echo "Step 1/4: validating gzip archive..."
gzip -t "$BACKUP_FILE"
echo "OK: gzip archive is valid."

echo "Step 2/4: creating temporary verification database..."
docker compose exec -T postgres dropdb --if-exists -U "$DATABASE_USER" "$VERIFY_DATABASE" >/dev/null
docker compose exec -T postgres createdb -U "$DATABASE_USER" "$VERIFY_DATABASE"

cleanup() {
  docker compose exec -T postgres dropdb --if-exists -U "$DATABASE_USER" "$VERIFY_DATABASE" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "Step 3/4: restoring backup into temporary database..."
gunzip -c "$BACKUP_FILE" | docker compose exec -T postgres \
  psql -U "$DATABASE_USER" -d "$VERIFY_DATABASE" -v ON_ERROR_STOP=1 >/dev/null

echo "OK: backup restored successfully into temporary database."

echo "Step 4/4: verifying required tables..."
TABLES="
projects
project_files
credit_accounts
credit_transactions
usage_records
api_keys
builds
deployments
billing_orders
billing_payments
"

for table in $TABLES; do
  docker compose exec -T postgres \
    psql -U "$DATABASE_USER" -d "$VERIFY_DATABASE" -v ON_ERROR_STOP=1 -At \
    -c "SELECT to_regclass('public.$table');" | grep -qx "public.$table"
  echo "OK: $table"
done

echo ""
echo "========================================"
echo "POSTGRESQL BACKUP VERIFICATION PASSED"
echo "========================================"
echo "Backup: $BACKUP_FILE"
echo "Temporary database: $VERIFY_DATABASE"
echo "The temporary verification database will now be removed."
