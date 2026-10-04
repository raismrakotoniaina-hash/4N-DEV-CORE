#!/bin/sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-/opt/4n-dev-core/backups/postgres}"
S3_BUCKET="${S3_BUCKET:-}"
S3_PREFIX="${S3_PREFIX:-4n-dev-core/postgres}"
AWS_ENDPOINT_URL="${AWS_ENDPOINT_URL:-}"

if [ -z "$S3_BUCKET" ]; then
  echo "ERROR: S3_BUCKET is required."
  echo "Example: S3_BUCKET=4n-prod-backups"
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "ERROR: AWS CLI is required on the VPS."
  echo "Install AWS CLI before using this script."
  exit 1
fi

LATEST_BACKUP="$(find "$BACKUP_DIR" -type f -name '4ncore-*.sql.gz' -printf '%T@ %p\\n' | sort -nr | head -n 1 | cut -d' ' -f2-)"

if [ -z "$LATEST_BACKUP" ] || [ ! -f "$LATEST_BACKUP" ]; then
  echo "ERROR: no PostgreSQL backup found in $BACKUP_DIR"
  echo "Run scripts/backup-postgres.sh first."
  exit 1
fi

FILENAME="$(basename "$LATEST_BACKUP")"
DESTINATION="s3://$S3_BUCKET/$S3_PREFIX/$FILENAME"

echo "Uploading PostgreSQL backup to external storage..."
echo "Source: $LATEST_BACKUP"
echo "Destination: $DESTINATION"

if [ -n "$AWS_ENDPOINT_URL" ]; then
  aws --endpoint-url "$AWS_ENDPOINT_URL" s3 cp "$LATEST_BACKUP" "$DESTINATION"
else
  aws s3 cp "$LATEST_BACKUP" "$DESTINATION"
fi

echo "External backup upload completed."
