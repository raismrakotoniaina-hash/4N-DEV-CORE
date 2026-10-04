#!/bin/sh
set -eu

SSH_PORT="${SSH_PORT:-22}"
DISABLE_PASSWORD_AUTH="${DISABLE_PASSWORD_AUTH:-true}"

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: run as root."
  exit 1
fi

case "$SSH_PORT" in
  ''|*[!0-9]*) echo "ERROR: SSH_PORT must be a valid TCP port."; exit 1 ;;
esac

if [ "$SSH_PORT" -lt 1 ] || [ "$SSH_PORT" -gt 65535 ]; then
  echo "ERROR: SSH_PORT must be between 1 and 65535."
  exit 1
fi

if ! command -v sshd >/dev/null 2>&1; then
  echo "ERROR: OpenSSH server is not installed."
  echo "Install openssh-server first."
  exit 1
fi

SSHD_CONFIG="/etc/ssh/sshd_config"
BACKUP="/etc/ssh/sshd_config.4n-backup"

if [ ! -f "$BACKUP" ]; then
  cp "$SSHD_CONFIG" "$BACKUP"
  chmod 600 "$BACKUP"
fi

set_option() {
  key="$1"
  value="$2"
  if grep -Eq "^[#[:space:]]*$key[[:space:]]+" "$SSHD_CONFIG"; then
    sed -i -E "s|^[#[:space:]]*$key[[:space:]]+.*|$key $value|" "$SSHD_CONFIG"
  else
    printf '%s %s\n' "$key" "$value" >> "$SSHD_CONFIG"
  fi
}

echo "== 4N DEV Core SSH hardening =="

set_option "Port" "$SSH_PORT"
set_option "PermitRootLogin" "no"
set_option "PubkeyAuthentication" "yes"
set_option "MaxAuthTries" "3"
set_option "LoginGraceTime" "20"
set_option "X11Forwarding" "no"
set_option "AllowTcpForwarding" "no"
set_option "AllowAgentForwarding" "no"
set_option "ClientAliveInterval" "300"
set_option "ClientAliveCountMax" "2"

if [ "$DISABLE_PASSWORD_AUTH" = "true" ]; then
  set_option "PasswordAuthentication" "no"
  set_option "KbdInteractiveAuthentication" "no"
fi

sshd -t

echo ""
echo "SSH configuration validated."

if command -v systemctl >/dev/null 2>&1; then
  systemctl reload ssh 2>/dev/null || systemctl reload sshd
else
  service ssh reload 2>/dev/null || service sshd reload
fi

echo ""
echo "SSH hardening applied."
echo "IMPORTANT: keep the current SSH session open and test a second SSH connection before closing it."
echo "Configured SSH port: $SSH_PORT"
echo "Password authentication disabled: $DISABLE_PASSWORD_AUTH"
