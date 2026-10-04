#!/bin/sh
set -eu

echo "Auditing repository for local secret files and unsafe environment files..."

fail=0

check_path() {
  path="$1"
  if [ -e "$path" ]; then
    echo "ERROR: sensitive path must not be committed: $path"
    fail=1
  fi
}

check_path ".env"
check_path ".env.docker"
check_path "backup.env"
check_path "monitoring.env"

for path in deploy/systemd/*.env; do
  [ -e "$path" ] || continue
  case "$path" in
    *.example) ;;
    *)
      echo "ERROR: non-example systemd environment file found: $path"
      fail=1
      ;;
  esac
done

if git ls-files | grep -E '(^|/)(\.env|\.env\.[^/]+|backup\.env|monitoring\.env)$' >/tmp/4n-secret-audit.txt 2>/dev/null; then
  echo "ERROR: tracked sensitive environment file(s):"
  cat /tmp/4n-secret-audit.txt
  fail=1
fi
rm -f /tmp/4n-secret-audit.txt

if git ls-files | grep -E '(^|/)(id_rsa|id_ed25519|.*\.pem|.*\.key)$' >/tmp/4n-key-audit.txt 2>/dev/null; then
  echo "ERROR: tracked private key/certificate file(s):"
  cat /tmp/4n-key-audit.txt
  fail=1
fi
rm -f /tmp/4n-key-audit.txt

if [ "$fail" -ne 0 ]; then
  echo "SECRET AUDIT FAILED."
  exit 1
fi

echo "OK: no forbidden local secret files are present or tracked."
echo "OK: only example environment files may exist under deploy/systemd/."
