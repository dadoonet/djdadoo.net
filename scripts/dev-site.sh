#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WATCH_INTERVAL="${PAGEFIND_WATCH_INTERVAL:-2}"
HUGO_PORT="${HUGO_PORT:-1313}"

WATCH_PATHS=(
  "content"
  "data"
  "static"
  "themes"
  "hugo.toml"
)

cd "$ROOT_DIR"

compute_watch_stamp() {
  {
    for path in "${WATCH_PATHS[@]}"; do
      if [[ -d "$path" ]]; then
        find "$path" -type f -exec stat -f '%m %N' {} +
      elif [[ -e "$path" ]]; then
        stat -f '%m %N' "$path"
      fi
    done
  } | shasum | awk '{print $1}'
}

cleanup() {
  if [[ -n "${HUGO_PID:-}" ]] && kill -0 "$HUGO_PID" 2>/dev/null; then
    kill "$HUGO_PID" 2>/dev/null || true
    wait "$HUGO_PID" 2>/dev/null || true
  fi
}

find_available_port() {
  local port="$1"

  while lsof -iTCP:"$port" -sTCP:LISTEN -t >/dev/null 2>&1; do
    port=$((port + 1))
  done

  printf '%s\n' "$port"
}

trap cleanup EXIT INT TERM

SERVER_PORT="$(find_available_port "$HUGO_PORT")"

if [[ "$SERVER_PORT" != "$HUGO_PORT" ]]; then
  echo "==> Port ${HUGO_PORT} busy, using http://localhost:${SERVER_PORT}"
fi

echo "==> Initial full build"
"$ROOT_DIR/scripts/build-site.sh"

echo "==> Starting Hugo server on http://localhost:${SERVER_PORT}"
hugo server --disableFastRender --port "$SERVER_PORT" &
HUGO_PID=$!

last_stamp="$(compute_watch_stamp)"

echo "==> Watching source files for search index updates"
while kill -0 "$HUGO_PID" 2>/dev/null; do
  sleep "$WATCH_INTERVAL"
  current_stamp="$(compute_watch_stamp)"
  if [[ "$current_stamp" != "$last_stamp" ]]; then
    last_stamp="$current_stamp"
    echo "==> Changes detected, rebuilding Pagefind index"
    npx --yes pagefind --site public --silent
  fi
done
