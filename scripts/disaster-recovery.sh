#!/bin/sh
set -eu

S3_BUCKET="${S3_BUCKET:-}"
S3_PREFIX="${S3_PREFIX:-4n-dev-core/postgres}"
AWS_ENDPOINT_URL="${AWS_ENDPOINT_URL:-}"
BACKUP_KEY="${1:-}"

if [ -z "$S3_BUCKET" ]; then
  echo "ERROR: S3_BUCKET is required."
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "ERROR: AWS CLI is required on the VPS."
  exit 1
fi

if [ ! -x "./scripts/restore-postgres.sh" ]; then
  echo "ERROR: scripts/restore-postgres.sh is missing or not executable."
  exit 1
fi

if [ ! -x "./scripts/verify-postgres-restore.sh" ]; then
  echo "ERROR: scripts/verify-postgres-restore.sh is missing or not executable."
  exit 1
fi

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

if [ -n "$AWS_ENDPOINT_URL" ]; then
  AWS_S3="aws --endpoint-url $AWS_ENDPOINT_URL s3"
else
  AWS_S3="aws s3"
fi

if [ -n "$BACKUP_KEY" ]; then
  case "$BACKUP_KEY" in
    s3://*) SOURCE="$BACKUP_KEY" ;;
    *) SOURCE="s3://$S3_BUCKET/$BACKUP_KEY" ;;
  esac
else
  echo "Finding latest external PostgreSQL backup..."
  SOURCE="$($AWS_S3 ls "s3://$S3_BUCKET/$S3_PREFIX/" | awk '/4ncore-.*\\.sql\\.gz$/ {print $4}' | sort | tail -n 1)"

  if [ -z "$SOURCE" ]; then
    echo "ERROR: no PostgreSQL backup found in external storage."
    exit 1
  fi

  SOURCE="s3://$S3_BUCKET/$S3_PREFIX/$SOURCE"
fi

BACKUP_FILE="$WORK_DIR/restore.sql.gz"

echo ""
echo "Disaster recovery source:"
echo "$SOURCE"
echo ""
echo "WARNING: This workflow will:"
echo "  1. Download the selected backup."
echo "  2. Restore it into the configured PostgreSQL database."
echo "  3. Verify the required tables and row counts."
echo ""
printf "Type DISASTER-RECOVERY to continue: "
read CONFIRM

if [ "$CONFIRM" != "DISASTER-RECOVERY" ]; then
  echo "Disaster recovery cancelled."
  exit 1
fi

echo ""
echo "Step 1/3: Downloading backup..."

if [ -n "$AWS_ENDPOINT_URL" ]; then
  aws --endpoint-url "$AWS_ENDPOINT_URL" s3 cp "$SOURCE" "$BACKUP_FILE"
else
  aws s3 cp "$SOURCE" "$BACKUP_FILE"
fi

if [ ! -s "$BACKUP_FILE" ]; then
  echo "ERROR: downloaded backup is empty."
  exit 1
fi

echo "Download completed."

echo ""
echo "Step 2/3: Restoring PostgreSQL..."

printf 'RESTORE\\n' | ./scripts/restore-postgres.sh "$BACKUP_FILE"

echo ""
echo "Step 3/3: Verifying PostgreSQL..."

./scripts/verify-postgres-restore.sh

echo ""
echo "========================================"
echo "DISASTER RECOVERY COMPLETED SUCCESSFULLY"
echo "========================================"
echo "Source: $SOURCE"
