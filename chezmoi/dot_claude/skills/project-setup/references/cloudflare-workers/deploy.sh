#!/usr/bin/env bash

set -euo pipefail

# Backward-compatible wrapper. Prefer copying this file as scripts/manual-deploy.sh in new projects.
exec ./scripts/manual-deploy.sh "$@"
