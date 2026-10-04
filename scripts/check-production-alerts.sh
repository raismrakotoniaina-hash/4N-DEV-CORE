#!/bin/sh
set -eu

ALERT_FILE="${ALERT_FILE:-/etc/4n-dev-core/monitoring.env}"
COOLDOWN="${HEALTH_ALERT_COOLDOWN:-3600}"

if [ -f "$ALERT_FILE" ]; then
  # shellcheck disable=SC1090
  . "$ALERT_FILE"
fi

ALERT_EMAIL="${HEALTH_ALERT_EMAIL:-}"
STATE_FILE="/var/lib/4n-dev-core/last-alert"
mkdir -p "$(dirname "$STATE_FILE")"

issues=""

check_timer() {
  timer="$1"
  if ! systemctl is-enabled --quiet "$timer" 2>/dev/null; then
    issues="$issues\nTimer not enabled: $timer"
  fi
}

for timer in \
  4n-production-update.timer \
  4n-certbot-renew.timer \
  4n-postgres-backup.timer \
  4n-backup-monitor.timer \
  4n-disk-monitor.timer \
  4n-docker-health-monitor.timer
do
  check_timer "$timer"
done

if ! docker compose -f /opt/4n-dev-core/docker-compose.yml ps --status running 2>/dev/null | grep -q 'core'; then
  issues="$issues\nCore container is not running"
fi

if ! docker compose -f /opt/4n-dev-core/docker-compose.yml exec -T core node -e "fetch('http://127.0.0.1:3001/health/ready').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" >/dev/null 2>&1; then
  issues="$issues\nCore readiness check failed"
fi

if ! docker compose -f /opt/4n-dev-core/docker-compose.yml exec -T postgres pg_isready -U 4ncore -d 4ncore >/dev/null 2>&1; then
  issues="$issues\nPostgreSQL readiness check failed"
fi

if [ -n "$issues" ]; then
  now="$(date +%s)"
  last=0
  [ -f "$STATE_FILE" ] && last="$(cat "$STATE_FILE" 2>/dev/null || echo 0)"

  if [ "$last" -eq 0 ] || [ $((now - last)) -ge "$COOLDOWN" ]; then
    message="4N DEV Core production alert:\n$issues"
    logger -t 4n-production-alert "$message"

    if [ -n "$ALERT_EMAIL" ] && command -v mail >/dev/null 2>&1; then
      printf '%b\n' "$message" | mail -s "4N DEV Core production alert" "$ALERT_EMAIL"
    fi

    printf '%s' "$now" > "$STATE_FILE"
  fi

  echo "ALERT: production checks detected an issue."
  printf '%b\n' "$issues"
  exit 1
fi

logger -t 4n-production-alert "Production checks OK"
echo "OK: production services and timers are healthy."
