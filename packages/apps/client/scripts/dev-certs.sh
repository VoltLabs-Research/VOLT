#!/usr/bin/env bash
# Generates a local CA and a dev server certificate in .certs/ (used by vite.config.ts), and
# trusts the CA in the user's NSS database (Chrome/Brave on Linux) so service workers register.
#
#   scripts/dev-certs.sh                  # localhost, 127.0.0.1 and every LAN IPv4 of this host
#   scripts/dev-certs.sh 192.168.1.85     # extra hostnames/IPs to include
#
# Firefox and other devices need .certs/volt-dev-ca.pem imported manually as a trusted CA.
# Requires openssl and certutil (libnss3-tools).
set -euo pipefail

client_dir="$(cd "$(dirname "$0")/.." && pwd)"
cert_dir="$client_dir/.certs"
mkdir -p "$cert_dir"
cd "$cert_dir"

if [[ ! -f volt-dev-ca.pem ]]; then
    openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
        -keyout volt-dev-ca-key.pem -out volt-dev-ca.pem \
        -subj "/CN=VOLT Dev CA" \
        -addext "basicConstraints=critical,CA:TRUE" \
        -addext "keyUsage=critical,keyCertSign,cRLSign"
fi

san="DNS:localhost,IP:127.0.0.1,IP:::1"
for ip in $(hostname -I); do
    [[ "$ip" == *:* ]] || san+=",IP:$ip"
done
for extra in "$@"; do
    if [[ "$extra" =~ ^[0-9.]+$ ]]; then san+=",IP:$extra"; else san+=",DNS:$extra"; fi
done

openssl req -newkey rsa:2048 -nodes -keyout key.pem -out cert.csr -subj "/CN=VOLT Dev Server"
openssl x509 -req -in cert.csr -CA volt-dev-ca.pem -CAkey volt-dev-ca-key.pem -CAcreateserial \
    -out cert.pem -days 825 \
    -extfile <(printf "subjectAltName=%s\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\n" "$san")
rm -f cert.csr

if command -v certutil > /dev/null && [[ -d "$HOME/.pki/nssdb" ]]; then
    certutil -d "sql:$HOME/.pki/nssdb" -D -n "VOLT Dev CA" 2> /dev/null || true
    certutil -d "sql:$HOME/.pki/nssdb" -A -t "C,," -n "VOLT Dev CA" -i volt-dev-ca.pem
    echo "Trusted VOLT Dev CA in ~/.pki/nssdb (restart Chrome/Brave)."
fi

echo "Certificate SANs: $san"
