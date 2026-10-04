#!/bin/sh
set -eu

SSH_PORT="${SSH_PORT:-22}"

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: run as root."
  exit 1
fi

case "$SSH_PORT" in
  ''|*[!0-9]*)
    echo "ERROR: SSH_PORT must be a valid TCP port."
    exit 1
    ;;
esac

if [ "$SSH_PORT" -lt 1 ] || [ "$SSH_PORT" -gt 65535 ]; then
  echo "ERROR: SSH_PORT must be between 1 and 65535."
  exit 1
fi

echo "== 4N DEV Core VPS firewall configuration =="

if ! command -v ufw >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y ufw
fi

echo "Allowing SSH on port $SSH_PORT before enabling UFW..."
ufw allow "$SSH_PORT/tcp" comment "SSH"

echo "Allowing public HTTP/HTTPS..."
ufw allow 80/tcp comment "HTTP"
ufw allow 443/tcp comment "HTTPS"

echo "Blocking direct access to 4N Core and PostgreSQL..."
ufw deny 3001/tcp comment "Block direct 4N Core access"
ufw deny 5432/tcp comment "Block direct PostgreSQL access"

ufw default deny incoming
ufw default allow outgoing

echo ""
ufw status verbose

echo ""
echo "Enabling UFW..."
ufw --force enable

echo ""
echo "Firewall configured."
echo "Public ports: $SSH_PORT (SSH), 80 (HTTP), 443 (HTTPS)"
echo "4N Core port 3001 and PostgreSQL port 5432 are not public."
