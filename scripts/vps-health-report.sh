#!/bin/sh
set -u

APP_DIR="${APP_DIR:-/opt/4n-dev-core}"
OUTPUT_FILE="${VPS_HEALTH_REPORT_FILE:-/var/log/4n-dev-core-vps-health.log}"

PASS=0
WARN=0
FAIL=0

ok() { PASS=$((PASS + 1)); printf '[OK] %s\n' "$1"; }
warn() { WARN=$((WARN + 1)); printf '[WARN] %s\n' "$1"; }
fail() { FAIL=$((FAIL + 1)); printf '[FAIL] %s\n' "$1"; }

echo "=================================================="
echo "4N DEV Core VPS HEALTH REPORT"
echo "=================================================="
echo "Date: $(date -Is)"
echo "Host: $(hostname)"
echo "OS: $(. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME" || echo "unknown")"
echo ""

if command -v systemctl >/dev/null 2>&1; then
  systemctl is-active --quiet docker && ok "Docker service is running." || fail "Docker service is not running."
  systemctl is-active --quiet fail2ban 2>/dev/null && ok "Fail2Ban is running." || warn "Fail2Ban is not running."
  systemctl is-active --quiet unattended-upgrades 2>/dev/null && ok "Automatic security updates service is running." || warn "Automatic security updates service is not active."

  for timer in 4n-disk-monitor.timer 4n-docker-health-monitor.timer 4n-backup-monitor.timer 4n-postgres-backup.timer 4n-certbot-renew.timer 4n-docker-update.timer; do
    systemctl is-active --quiet "$timer" 2>/dev/null && ok "$timer is active." || warn "$timer is not active or not installed."
  done
fi

echo ""
echo "-- Disk --"
df -h "$APP_DIR" 2>/dev/null || df -h /
usage="$(df -P "$APP_DIR" 2>/dev/null | awk 'NR==2 {gsub("%","",$5); print $5}')"
if [ -n "$usage" ]; then
  if [ "$usage" -ge 90 ]; then fail "Disk usage is ${usage}%."; elif [ "$usage" -ge 80 ]; then warn "Disk usage is ${usage}%."; else ok "Disk usage is ${usage}%."; fi
fi

echo ""
echo "-- Docker Compose --"
if [ -d "$APP_DIR" ] && command -v docker >/dev/null 2>&1; then
  cd "$APP_DIR"
  if docker compose ps >/dev/null 2>&1; then
    docker compose ps
    docker compose ps --services --filter status=running | while read -r service; do
      [ -n "$service" ] && ok "Compose service running: $service"
    done
  else
    fail "Docker Compose status check failed."
  fi
else
  fail "Application directory or Docker is unavailable."
fi

echo ""
echo "-- PostgreSQL --"
if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx '4n-postgres'; then
  if docker exec 4n-postgres pg_isready -U 4ncore -d 4ncore >/dev/null 2>&1; then
    ok "PostgreSQL accepts connections."
  else
    fail "PostgreSQL is not ready."
  fi
else
  warn "4n-postgres container is not running."
fi

echo ""
echo "-- HTTP API --"
if command -v curl >/dev/null 2>&1; then
  if curl -fsS --max-time 10 http://127.0.0.1:3001/health >/dev/null 2>&1; then
    ok "4N Core /health is responding."
  else
    fail "4N Core /health is not responding."
  fi
fi

echo ""
echo "-- Firewall --"
if command -v ufw >/dev/null 2>&1; then
  ufw status | head -n 5
  ufw status | grep -q 'Status: active' && ok "UFW is active." || warn "UFW is not active."
else
  warn "UFW is not installed."
fi

echo ""
echo "-- Latest PostgreSQL backup --"
BACKUP_DIR="$APP_DIR/backups/postgres"
latest="$(find "$BACKUP_DIR" -type f -name '*.sql.gz' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -n 1 | cut -d' ' -f2-)"
if [ -n "$latest" ]; then
  ok "Latest backup: $latest"
  ls -lh "$latest"
else
  fail "No PostgreSQL backup found."
fi

echo ""
echo "=================================================="
echo "SUMMARY: OK=$PASS WARN=$WARN FAIL=$FAIL"
echo "=================================================="

if [ -n "$OUTPUT_FILE" ]; then
  mkdir -p "$(dirname "$OUTPUT_FILE")" 2>/dev/null || true
  {
    echo "4N DEV Core VPS health report: $(date -Is)"
    echo "Host: $(hostname)"
    echo "OK=$PASS WARN=$WARN FAIL=$FAIL"
  } >> "$OUTPUT_FILE" 2>/dev/null || true
fi

[ "$FAIL" -eq 0 ] || exit 2
