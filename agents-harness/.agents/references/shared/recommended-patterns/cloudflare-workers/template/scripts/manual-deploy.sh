#!/usr/bin/env bash

set -euxo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <prod|preview|dev>"
  echo "  prod: Build and deploy to prod environment"
  echo "  preview: Build and deploy to preview environment"
  echo "  dev: Build and deploy to dev environment"
  exit 1
fi

ENVIRONMENT="$1"

if [ "$ENVIRONMENT" != "prod" ] && [ "$ENVIRONMENT" != "preview" ] && [ "$ENVIRONMENT" != "dev" ]; then
  echo "Error: Invalid environment '$ENVIRONMENT'. Must be 'prod', 'preview', or 'dev'"
  echo "Usage: $0 <prod|preview|dev>"
  exit 1
fi

cwd=$(pwd)
cd "$(git rev-parse --show-toplevel)"

# preview uploads a version of the dev Worker.
MODE="$ENVIRONMENT"
if [ "$ENVIRONMENT" = "preview" ]; then
  MODE="dev"
fi

pnpm exec cf build --mode "$MODE"
./scripts/cf-deploy.sh "$ENVIRONMENT"

cd "$cwd"
