#!/usr/bin/env bash
# Authorize the A+ Server dev machine on the Smart Steps server (66.94.105.43).
# Run AS ROOT on the server: bash install-ssh-key.sh
set -euo pipefail

PUBKEY='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEpR7uRWRJkRjJVDFddfNtA13+Dk7FpW3urPCSlvEWgS aplus-server@smartsteps'
SSH_DIR="/root/.ssh"
AUTH="$SSH_DIR/authorized_keys"

echo "==> Preparing $SSH_DIR"
mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"
touch "$AUTH"
chmod 600 "$AUTH"
chown -R root:root "$SSH_DIR"

echo "==> Installing public key"
KEYBODY="$(printf '%s' "$PUBKEY" | awk '{print $2}')"
if grep -qF "$KEYBODY" "$AUTH"; then
  echo "    already present - nothing to add"
else
  # keep the file newline-clean, then append
  [ -s "$AUTH" ] && [ "$(tail -c1 "$AUTH" | wc -l)" -eq 0 ] && echo >> "$AUTH"
  printf '%s\n' "$PUBKEY" >> "$AUTH"
  echo "    added"
fi

echo "==> Ensuring sshd allows key auth for root"
SSHD="/etc/ssh/sshd_config"
cp -a "$SSHD" "${SSHD}.bak.$(date +%Y%m%d-%H%M%S)"
ensure() { # ensure <directive> <value>
  if grep -qE "^[[:space:]]*#?[[:space:]]*$1[[:space:]]" "$SSHD"; then
    sed -i -E "s|^[[:space:]]*#?[[:space:]]*$1[[:space:]].*|$1 $2|" "$SSHD"
  else
    printf '%s %s\n' "$1" "$2" >> "$SSHD"
  fi
}
ensure PubkeyAuthentication yes
ensure PermitRootLogin prohibit-password
# NOTE: password login is left ENABLED on purpose. Only after you have confirmed
# key login works from the dev machine, uncomment the next line and re-run:
# ensure PasswordAuthentication no

echo "==> Validating and reloading sshd"
sshd -t
systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null || service ssh reload

echo
echo "==> Authorized keys now on this server:"
awk '{print "    " $1, $3}' "$AUTH"
echo
echo "DONE. Test from the dev machine (PowerShell):"
echo '  ssh -i "$env:USERPROFILE\.ssh\id_ed25519_smartsteps" root@66.94.105.43 "hostname"'
