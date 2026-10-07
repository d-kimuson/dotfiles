#!/usr/bin/env bash
# Verifies db/schema.sql (desired state) and db/migrations/ (versioned migrations) are in sync,
# in addition to Atlas's own migration directory integrity check (atlas.sum hashes),
# and lints every migration for backward-incompatible changes.
#
# Usage: pnpm migrate:verify

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

echo "Validating migration directory integrity..."
atlas migrate validate --env local

echo "Linting migrations for backward-incompatible changes..."
migration_count=$(find db/migrations -name '*.up.sql' | wc -l | tr -d ' ')
if [ "$migration_count" -gt 0 ]; then
  atlas migrate lint --env local --latest "$migration_count"
fi

tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT

cp db/migrations/*.sql "$tmp_dir"/ 2>/dev/null || true
cp db/migrations/atlas.sum "$tmp_dir"/ 2>/dev/null || true

before_count=$(find "$tmp_dir" -type f | wc -l | tr -d ' ')

echo "Checking db/schema.sql against db/migrations/ for drift..."
atlas migrate diff --env local --dir "file://$tmp_dir?format=golang-migrate" drift_check

after_count=$(find "$tmp_dir" -type f | wc -l | tr -d ' ')

if [ "$before_count" != "$after_count" ]; then
  echo ""
  echo "db/schema.sql and db/migrations/ are OUT OF SYNC. Diff atlas would generate:"
  echo ""
  for f in "$tmp_dir"/*drift_check.up.sql; do
    cat "$f"
  done
  echo ""
  echo "Run 'pnpm migrate:diff <name>' to generate the missing migration."
  exit 1
fi

echo "db/schema.sql and db/migrations/ are in sync."
