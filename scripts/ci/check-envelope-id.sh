#!/usr/bin/env bash
set -euo pipefail

# Csak JSON fájlokban keresünk envelopeId-t, és csak object gyökér alatt ellenőrizzük
rg -l --glob '!node_modules' --glob '!dist' --glob '!build' --type-add 'json:*.json' -tjson '"envelopeId"\s*:' \
| while read -r f; do
  if ! jq -e '
    if (type=="object" and has("envelopeId"))
    then (.envelopeId|type=="string") and (.envelopeId|test("^urn:uuid:[0-9A-Fa-f-]{36}$"))
    else true end
  ' "$f" >/dev/null; then
    echo "Bad envelopeId in $f"
    exit 1
  fi
done

echo "envelopeId checks OK"
