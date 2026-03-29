#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

echo "==> Building site with Hugo"
hugo --gc --minify

echo "==> Building Pagefind index"
npx --yes pagefind --site public

echo "==> Done"
