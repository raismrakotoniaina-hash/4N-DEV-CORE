#!/bin/sh
set -eu

SSH_PORT="${SSH_PORT:-22}"
BAN_TIME="${BAN_TIME:-1h}"
FIND_TIME="${FIND_TIME:-10m}"
MAX_RETRY="${MAX_RETRY:-5}"

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: run as root."
  exit 1
fi

case "$SSH_PORT" in
  ''|*[!0-9]*) echo "ERROR: SSH_PORT must be a valid TCP port."; exit 1 ;;
esac

echo "== 4N DEV Core Fail2Ban setup =="

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y fail2ban

mkdir -p /etc/fail2ban/jail.d

cat > /etc/fail2ban/jail.d/4n-ssh.local <<EOF
[sshd]
enabled = true
port = $SSH_PORT
backend = systemd
bantime = $BAN_TIME
findtime = $FIND_TIME
maxretry = $MAX_RETRY
EOF

if command -v systemctl >/dev/null 2>&1; then
  systemctl enable --now fail2ban
  systemctl restart fail2ban
  systemctl is-active --quiet fail2ban
else
  service fail2ban restart
fi

echo ""
echo "Fail2Ban SSH protection enabled."
echo "SSH port: $SSH_PORT"
echo "Ban time: $BAN_TIME"
echo "Find time: $FIND_TIME"
echo "Max retries: $MAX_RETRY"
echo ""
echo "Check status with:"
echo "  fail2ban-client status sshd"
