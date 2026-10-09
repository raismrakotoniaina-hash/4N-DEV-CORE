#!/bin/sh
set -eu

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this script as root: sudo sh scripts/install-backup-cron.sh"
  exit 1
fi

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_LOG_DIR="/var/log/4n-dev-core"
mkdir -p "$BACKUP_LOG_DIR"
chmod 750 "$BACKUP_LOG_DIR"

CRON_LINE="30 2 * * * cd '$PROJECT_DIR' && /bin/sh '$PROJECT_DIR/scripts/backup-postgres.sh' >> '$BACKUP_LOG_DIR/postgres-backup.log' 2>&1 # 4n-dev-core-postgres-backup"
CURRENT="$(crontab -l 2>/dev/null | grep -v '# 4n-dev-core-postgres-backup' || true)"
printf '%s\n%s\n' "$CURRENT" "$CRON_LINE" | sed '/^[[:space:]]*$/d' | crontab -

echo "Daily PostgreSQL backup scheduled for 02:30 server time."
echo "Log: $BACKUP_LOG_DIR/postgres-backup.log"
echo "This is a local backup schedule. Configure rclone and /etc/4n-dev-core/backup.env for off-site copies."
