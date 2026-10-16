#!/usr/bin/env bash
# Temporary public link for SkyStunt.io. Starts the game server and opens a tunnel.
# Usage: scripts/temp-public-link.sh [localhost.run|cloudflare]   (default: localhost.run)
# Stop with Ctrl+C. The link lives only as long as this process and this machine.
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-8080}"
MODE="${1:-localhost.run}"

if [ ! -f dist/index.html ]; then
  npx vite build
fi

PORT="$PORT" HOST=0.0.0.0 node server/index.js > "${TMPDIR:-/tmp}/skystunt-server.log" 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT

for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null || { echo "server did not start; see ${TMPDIR:-/tmp}/skystunt-server.log"; exit 1; }
echo "Server up on port $PORT (log: ${TMPDIR:-/tmp}/skystunt-server.log)"

case "$MODE" in
  localhost.run)
    # Prints the public https://<id>.lhr.life URL in the output.
    ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ExitOnForwardFailure=yes \
        -R 80:localhost:"$PORT" nokey@localhost.run ;;
  cloudflare)
    # Needs the cloudflared binary on PATH. Prints https://<random>.trycloudflare.com
    cloudflared tunnel --no-autoupdate --url "http://localhost:$PORT" ;;
  *) echo "unknown mode: $MODE (use localhost.run or cloudflare)"; exit 2 ;;
esac
