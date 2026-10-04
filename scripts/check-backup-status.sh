#!/bin/sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-/opt/4n-dev-core/backups/postgres}"
MAX_AGE_HOURS="${BACKUP_MAX_AGE_HOURS:-26}"
ALERT_EMAIL="${BACKUP_ALERT_EMAIL:-}"

if [ "$(id -u)" -ne 0 ]; then echo "ERROR: run as root."; exit 1; fi
[ -d "$BACKUP_DIR" ] || { echo "ERROR: backup directory not found: $BACKUP_DIR"; exit 1; }

latest="$(find "$BACKUP_DIR" -type f -name '*.sql.gz' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -n 1 | cut -d' ' -f2-)"

send_alert() {
  message="$1"
  logger -t 4n-backup-monitor "$message"
  if [ -n "$ALERT_EMAIL" ] && command -v mail >/dev/null 2>&1; then
    printf '%s\n' "$message" | mail -s "[4N DEV Core] PostgreSQL backup alert" "$ALERT_EMAIL"
  fi
}

if [ -z "$latest" ]; then send_alert "CRITICAL: no PostgreSQL backup file found in $BACKUP_DIR."; exit 2; fi
if [ ! -s "$latest" ]; then send_alert "CRITICAL: latest PostgreSQL backup is empty: $latest"; exit 2; fi

now="$(date +%s)"
mtime="$(stat -c %Y "$latest")"
age=$((now - mtime))
max_age=$((MAX_AGE_HOURS * 3600))

if [ "$age" -gt "$max_age" ]; then
  send_alert "CRITICAL: latest PostgreSQL backup is too old. File: $latest Age: $((age / 3600))h Limit: " + "$MAX_AGE_HOURS" + "h"
  exit 2
fi

logger -t 4n-backup-monitor "OK: latest PostgreSQL backup is $latest and $((age / 3600))h old."
