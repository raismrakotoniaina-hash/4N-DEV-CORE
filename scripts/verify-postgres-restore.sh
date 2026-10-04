#!/bin/sh
set -eu

DATABASE_NAME="${DATABASE_NAME:-4ncore}"
DATABASE_USER="${DATABASE_USER:-4ncore}"

if ! docker compose ps --services --status running | grep -qx "postgres"; then
  echo "ERROR: PostgreSQL container is not running."
  exit 1
fi

echo "Checking PostgreSQL connection..."

docker compose exec -T postgres \
  psql -U "$DATABASE_USER" -d "$DATABASE_NAME" -v ON_ERROR_STOP=1 \
  -c "SELECT current_database(), current_user, NOW();"

echo ""
echo "Checking required 4N DEV Core tables..."

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
    psql -U "$DATABASE_USER" -d "$DATABASE_NAME" -v ON_ERROR_STOP=1 -At \
    -c "SELECT to_regclass('public.$table');" | grep -qx "public.$table"

  echo "OK: $table"
done

echo ""
echo "Checking row counts..."

docker compose exec -T postgres \
  psql -U "$DATABASE_USER" -d "$DATABASE_NAME" -v ON_ERROR_STOP=1 <<'SQL'
SELECT 'projects' AS table_name, COUNT(*) AS rows FROM projects
UNION ALL SELECT 'project_files', COUNT(*) FROM project_files
UNION ALL SELECT 'credit_accounts', COUNT(*) FROM credit_accounts
UNION ALL SELECT 'credit_transactions', COUNT(*) FROM credit_transactions
UNION ALL SELECT 'usage_records', COUNT(*) FROM usage_records
UNION ALL SELECT 'api_keys', COUNT(*) FROM api_keys
UNION ALL SELECT 'builds', COUNT(*) FROM builds
UNION ALL SELECT 'deployments', COUNT(*) FROM deployments
UNION ALL SELECT 'billing_orders', COUNT(*) FROM billing_orders
UNION ALL SELECT 'billing_payments', COUNT(*) FROM billing_payments
ORDER BY table_name;
SQL

echo ""
echo "PostgreSQL restore verification PASSED."
