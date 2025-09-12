#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
GEN="$SCRIPT_DIR/generate-zokrates-vectors.sh"
[ -x "$GEN" ] || chmod +x "$GEN" || true
bash "$GEN"
echo "run-zokrates-vectors: done."
