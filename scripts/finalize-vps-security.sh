#!/bin/sh
set -eu

APP_DIR="${APP_DIR:-/opt/4n-dev-core}"
SSH_PORT="${SSH_PORT:-22}"

if [ "$(id -u)" -ne 0 ]; then echo "ERROR: run as root."; exit 1; fi
[ -d "$APP_DIR" ] || { echo "ERROR: app directory not found: $APP_DIR"; exit 1; }
cd "$APP_DIR"

echo "== 4N DEV Core VPS production security finalization =="

echo "1/6 Checking required security scripts..."
for script in configure-firewall.sh harden-ssh.sh install-fail2ban.sh configure-security-updates.sh configure-log-management.sh configure-disk-monitoring.sh configure-docker-monitoring.sh configure-health-alerts.sh; do
  [ -x "scripts/$script" ] || { echo "ERROR: scripts/$script is missing or not executable."; exit 1; }
done

echo "2/6 Checking SSH key authentication before password hardening..."
if [ "${ALLOW_PASSWORD_AUTH:-false}" != "true" ]; then
  found_key=false
  for home in /root /home/*; do
    if [ -f "$home/.ssh/authorized_keys" ] && [ -s "$home/.ssh/authorized_keys" ]; then found_key=true; break; fi
  done
  if [ "$found_key" != "true" ]; then
    echo "ERROR: no SSH authorized_keys file found."
    echo "Add and test an SSH public key first, or rerun with ALLOW_PASSWORD_AUTH=true."
    exit 1
  fi
fi

echo "3/6 Configuring firewall..."
SSH_PORT="$SSH_PORT" ./scripts/configure-firewall.sh

echo "4/6 Hardening SSH..."
SSH_PORT="$SSH_PORT" DISABLE_PASSWORD_AUTH="${DISABLE_PASSWORD_AUTH:-true}" ./scripts/harden-ssh.sh

echo "5/6 Installing host protections..."
SSH_PORT="$SSH_PORT" ./scripts/install-fail2ban.sh
./scripts/configure-security-updates.sh
./scripts/configure-log-management.sh
./scripts/configure-disk-monitoring.sh
./scripts/configure-docker-monitoring.sh

echo "6/6 Configuring centralized health alerts..."
./scripts/configure-health-alerts.sh

echo ""
echo "SECURITY FINALIZATION COMPLETED."
echo ""
echo "IMPORTANT: keep this SSH session open and test a second SSH connection now."
echo "Then verify: ufw status verbose"
echo "Then verify: fail2ban-client status sshd"
echo "Then verify timers: systemctl list-timers --all | grep 4n-"
