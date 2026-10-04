#!/bin/sh
set -u

APP_DIR="${APP_DIR:-/opt/4n-dev-core}"
FAIL=0
WARN=0

ok() { echo "OK   $1"; }
warn() { echo "WARN $1"; WARN=$((WARN + 1)); }
fail() { echo "FAIL $1"; FAIL=$((FAIL + 1)); }

echo "=========================================="
echo "4N DEV CORE - UNIFIED PRODUCTION AUDIT"
echo "=========================================="
echo ""

if [ "$(id -u)" -ne 0 ]; then
  fail "audit must run as root"
else
  ok "running as root"
fi

if [ ! -d "$APP_DIR" ]; then
  fail "application directory missing: $APP_DIR"
  echo ""
  echo "RESULT: FAILED"
  exit 1
fi

cd "$APP_DIR"

echo "--- Application ---"
[ -f Dockerfile ] && ok "Dockerfile present" || fail "Dockerfile missing"
[ -f docker-compose.yml ] && ok "docker-compose.yml present" || fail "docker-compose.yml missing"
[ -f .env.docker.example ] && ok "Docker environment template present" || fail "Docker environment template missing"
[ -x scripts/update-production.sh ] && ok "safe update script executable" || fail "safe update script missing/not executable"
[ -x scripts/validate-production-env.sh ] && ok "environment validator executable" || fail "environment validator missing/not executable"
[ -x scripts/audit-repository-secrets.sh ] && ok "secret audit executable" || fail "secret audit missing/not executable"

echo ""
echo "--- Secrets ---"
if [ -f .env ]; then
  mode="$(stat -c '%a' .env 2>/dev/null || stat -f '%Lp' .env)"
  [ "$mode" = "600" ] && ok ".env permissions are 600" || fail ".env permissions are $mode, expected 600"
  if ./scripts/validate-production-env.sh >/dev/null 2>&1; then
    ok "production environment passes validation"
  else
    fail "production environment validation failed"
  fi
else
  fail "production .env is missing"
fi

if git ls-files | grep -E '(^|/)(\.env|\.env\.docker|backup\.env|monitoring\.env)$' >/tmp/4n-audit-secrets 2>/dev/null; then
  fail "sensitive environment file is tracked by Git"
  cat /tmp/4n-audit-secrets
else
  ok "no sensitive environment file is tracked"
fi
rm -f /tmp/4n-audit-secrets

echo ""
echo "--- Docker ---"
if command -v docker >/dev/null 2>&1; then
  ok "Docker installed"
  if docker compose config >/dev/null 2>&1; then
    ok "Docker Compose configuration valid"
  else
    fail "Docker Compose configuration invalid"
  fi

  if docker compose ps --status running | grep -q 'core'; then
    ok "Core container running"
  else
    fail "Core container not running"
  fi

  if docker compose ps --status running | grep -q 'postgres'; then
    ok "PostgreSQL container running"
  else
    fail "PostgreSQL container not running"
  fi

  if docker compose ps --status running | grep -q 'nginx'; then
    ok "NGINX container running"
  else
    fail "NGINX container not running"
  fi

  if docker compose exec -T core node -e "fetch('http://127.0.0.1:3001/health/ready').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" >/dev/null 2>&1; then
    ok "Core readiness healthy"
  else
    fail "Core readiness failed"
  fi

  if docker compose exec -T postgres pg_isready -U 4ncore -d 4ncore >/dev/null 2>&1; then
    ok "PostgreSQL ready"
  else
    fail "PostgreSQL not ready"
  fi
else
  fail "Docker is not installed"
fi

echo ""
echo "--- Network Security ---"
if command -v ufw >/dev/null 2>&1; then
  if ufw status | grep -q "Status: active"; then
    ok "UFW active"
  else
    fail "UFW inactive"
  fi
else
  fail "UFW not installed"
fi

echo ""
echo "--- Systemd Automation ---"
for timer in \
  4n-production-update.timer \
  4n-certbot-renew.timer \
  4n-postgres-backup.timer \
  4n-backup-monitor.timer \
  4n-disk-monitor.timer \
  4n-docker-health-monitor.timer \
  4n-docker-update.timer \
  4n-production-alert.timer
do
  if systemctl is-enabled --quiet "$timer" 2>/dev/null; then
    ok "$timer enabled"
  else
    warn "$timer not enabled"
  fi
done

echo ""
echo "--- Backup ---"
if [ -x scripts/verify-latest-postgres-backup.sh ]; then
  if scripts/verify-latest-postgres-backup.sh >/dev/null 2>&1; then
    ok "latest PostgreSQL backup verification passed"
  else
    fail "latest PostgreSQL backup verification failed"
  fi
else
  fail "backup verification script missing"
fi

echo ""
echo "--- SSH / Fail2Ban ---"
if command -v fail2ban-client >/dev/null 2>&1; then
  if systemctl is-active --quiet fail2ban; then
    ok "Fail2Ban active"
  else
    fail "Fail2Ban inactive"
  fi
else
  fail "Fail2Ban not installed"
fi

if [ -f /etc/ssh/sshd_config ]; then
  if sshd -t >/dev/null 2>&1; then
    ok "SSH configuration valid"
  else
    fail "SSH configuration invalid"
  fi
else
  warn "SSH configuration file not found"
fi

echo ""
echo "--- Disk ---"
disk_use="$(df -P "$APP_DIR" | awk 'NR==2 {gsub(/%/, "", $5); print $5}')"
if [ -n "$disk_use" ]; then
  if [ "$disk_use" -ge 90 ]; then
    fail "disk usage is $disk_use%"
  elif [ "$disk_use" -ge 80 ]; then
    warn "disk usage is $disk_use%"
  else
    ok "disk usage is $disk_use%"
  fi
else
  warn "could not determine disk usage"
fi

echo ""
echo "=========================================="
if [ "$FAIL" -gt 0 ]; then
  echo "RESULT: FAILED"
  echo "Blocking issues: $FAIL"
  echo "Warnings: $WARN"
  exit 1
fi

echo "RESULT: PASSED"
echo "Blocking issues: 0"
echo "Warnings: $WARN"
echo "=========================================="
exit 0
