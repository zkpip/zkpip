#!/usr/bin/env bash
set -euo pipefail

# 1) fájlnévre vagy relatív útra mutató $ref tiltása
bad_refs=$(grep -Rni --include='*.json' '"\\$ref" *: *".*\\.json\\(#\\|\"\\)"' schemas || true)
bad_rel=$(grep -Rni --include='*.json' '"\\$ref" *: *"\\(\\./\\|\\../\\)' schemas || true)

# 2) $schema = URN tiltása
bad_schema=$(grep -Rni --include='*.json' '"\\$schema" *: *"urn:' schemas || true)

if [[ -n "$bad_refs" || -n "$bad_rel" || -n "$bad_schema" ]]; then
  echo "❌ Schema lint failed."
  [[ -n "$bad_refs" ]] && echo -e "\nFile-referenced \$ref found:\n$bad_refs"
  [[ -n "$bad_rel"  ]] && echo -e "\nRelative \$ref found:\n$bad_rel"
  [[ -n "$bad_schema" ]] && echo -e "\n\$schema must be a draft URL, not URN:\n$bad_schema"
  exit 1
fi

echo "✅ Schema lint passed."