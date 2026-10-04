#!/bin/sh
set -eu

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: run as root."
  exit 1
fi

if [ ! -f /etc/os-release ]; then
  echo "ERROR: /etc/os-release not found."
  exit 1
fi

. /etc/os-release

case "${ID:-}" in
  ubuntu|debian) ;;
  *)
    echo "ERROR: supported OS: Ubuntu or Debian. Detected: ${ID:-unknown}"
    exit 1
    ;;
esac

echo "== 4N DEV Core automatic security updates =="

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y unattended-upgrades

mkdir -p /etc/apt/apt.conf.d

cat > /etc/apt/apt.conf.d/52-4n-security-updates <<'EOF'
Unattended-Upgrade::Origins-Pattern {
    "origin=Debian,codename=${distro_codename},label=Debian-Security";
    "origin=Debian,codename=${distro_codename},label=Debian";
    "origin=Ubuntu,codename=${distro_codename}-security,label=Ubuntu";
};
Unattended-Upgrade::Package-Blacklist {
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
EOF

cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF

if command -v systemctl >/dev/null 2>&1; then
  systemctl enable --now unattended-upgrades.service 2>/dev/null || true
fi

echo ""
echo "Automatic security updates configured."
echo "Package lists: daily"
echo "Unattended upgrades: daily"
echo "Automatic reboot: disabled"
echo ""
echo "Test without changing packages:"
echo "  unattended-upgrade --dry-run --debug"
