#!/usr/bin/env bash
# Kirim versi terbaru (commit HEAD) ke VPS: halaman ke public_html, server Node ke ~/benang-senja-server.
# Pemakaian dari akar repo: bash deploy/deploy.sh
set -euo pipefail
VPS=root@43.134.133.21
D=board-game-yourname.arcand.my.id
U=arcandapp

TMP=$(mktemp -d)
git archive --format=tar.gz -o "$TMP/rilis.tar.gz" HEAD public server deploy
scp -o BatchMode=yes -q "$TMP/rilis.tar.gz" $VPS:/tmp/benang-senja.tar.gz
rm -rf "$TMP"

ssh -o BatchMode=yes $VPS "set -e
X=\$(mktemp -d); tar -xzf /tmp/benang-senja.tar.gz -C \$X; rm -f /tmp/benang-senja.tar.gz
# halaman statis
W=/home/$U/web/$D/public_html
find \$W -mindepth 1 -delete
cp -r \$X/public/. \$W/; chown -R $U:$U \$W; find \$W -type d -exec chmod 755 {} +; find \$W -type f -exec chmod 644 {} +
# server room (rooms.json dibiarkan)
S=/home/$U/benang-senja-server
install -d -o $U -g $U \$S
install -m 644 -o $U -g $U \$X/server/server.js \$X/server/package.json \$X/server/package-lock.json \$S/
cd \$S && sudo -u $U -H npm ci --omit=dev --no-audit --no-fund --silent
install -m 644 \$X/deploy/benang-senja.service /etc/systemd/system/benang-senja.service
systemctl daemon-reload; systemctl enable benang-senja >/dev/null 2>&1; systemctl restart benang-senja
rm -rf \$X
sleep 1; systemctl is-active benang-senja"
echo "Terkirim: $(git log --oneline -1)"
