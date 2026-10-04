#!/bin/sh
set -eu

DOMAIN="${1:-}"

fail=0
warn=0

ok() { echo "OK: $1"; }
fail_check() { echo "FAIL: $1"; fail=$((fail + 1)); }
warn_check() { echo "WARN: $1"; warn=$((warn + 1)); }

echo "========================================"
echo "4N DEV CORE - FINAL PRODUCTION CHECK"
echo "========================================"
echo ""

[ -f "Dockerfile" ] && ok "Dockerfile exists" || fail_check "Dockerfile missing"
[ -f "docker-compose.yml" ] && ok "docker-compose.yml exists" || fail_check "docker-compose.yml missing"
[ -f ".env.docker.example" ] && ok ".env.docker.example exists" || fail_check ".env.docker.example missing"
[ -f "scripts/preflight-production.sh" ] && ok "production preflight exists" || fail_check "production preflight missing"
[ -f "scripts/validate-production-env.sh" ] && ok "environment validator exists" || fail_check "environment validator missing"
[ -f "scripts/audit-repository-secrets.sh" ] && ok "secret audit exists" || fail_check "secret audit missing"
[ -f "scripts/backup-postgres.sh" ] && ok "PostgreSQL backup exists" || fail_check "PostgreSQL backup missing"
[ -f "scripts/restore-postgres.sh" ] && ok "PostgreSQL restore exists" || fail_check "PostgreSQL restore missing"
[ -f "scripts/verify-latest-postgres-backup.sh" ] && ok "backup verification exists" || fail_check "backup verification missing"
[ -f "scripts/verify-production-https.sh" ] && ok "HTTPS verification exists" || fail_check "HTTPS verification missing"
[ -f "scripts/configure-firewall.sh" ] && ok "firewall hardening exists" || fail_check "firewall hardening missing"
[ -f "scripts/harden-ssh.sh" ] && ok "SSH hardening exists" || fail_check "SSH hardening missing"

echo ""
echo "--- Repository secret safety ---"
if git ls-files | grep -E '(^|/)(\.env|\.env\.docker|backup\.env|monitoring\.env)$' >/tmp/4n-final-secret-check.txt 2>/dev/null; then
  cat /tmp/4n-final-secret-check.txt
  fail_check "tracked sensitive environment file found"
else
  ok "no sensitive environment file is tracked"
fi
rm -f /tmp/4n-final-secret-check.txt

echo ""
echo "--- Docker configuration ---"
if command -v docker >/dev/null 2>&1; then
  if docker compose config >/dev/null 2>&1; then
    ok "Docker Compose configuration is valid"
  else
    fail_check "Docker Compose configuration is invalid"
  fi
else
  warn_check "Docker is not installed on this machine (expected before VPS deployment)"
fi

echo ""
echo "--- Production environment ---"
if [ -f ".env" ]; then
  if [ "$(stat -c '%a' .env 2>/dev/null || stat -f '%Lp' .env)" = "600" ]; then
    ok ".env permissions are 600"
  else
    fail_check ".env permissions must be 600"
  fi
else
  warn_check ".env is absent (normal in Git repository; required only on VPS)"
fi

echo ""
echo "--- Domain / HTTPS ---"
if [ -n "$DOMAIN" ]; then
  case "$DOMAIN" in
    *[!A-Za-z0-9.-]*) fail_check "invalid domain syntax" ;;
    *) ok "domain syntax accepted: $DOMAIN" ;;
  esac
else
  warn_check "no domain supplied; HTTPS cannot be verified yet"
fi

echo ""
echo "--- Production VPS services ---"
if command -v systemctl >/dev/null 2>&1; then
  for timer in 4n-certbot-renew.timer 4n-postgres-backup.timer 4n-backup-monitor.timer 4n-disk-monitor.timer 4n-docker-health-monitor.timer; do
    if systemctl is-enabled --quiet "$timer" 2>/dev/null; then
      ok "$timer enabled"
    else
      warn_check "$timer not enabled (expected before VPS setup)"
    fi
  done
else
  warn_check "systemd unavailable; VPS timers not checked"
fi

echo ""
echo "========================================"
if [ "$fail" -gt 0 ]; then
  echo "RESULT: NOT READY - $fail blocking issue(s), $warn warning(s)."
  exit 1
fi

echo "RESULT: REPOSITORY PRODUCTION-READY"
echo "Blocking issues: 0"
echo "Warnings: $warn"
echo ""
echo "A real VPS, domain, DNS, TLS certificate, and production .env are still required before live deployment."
