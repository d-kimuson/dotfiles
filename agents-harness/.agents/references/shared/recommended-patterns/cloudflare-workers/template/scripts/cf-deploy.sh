#!/usr/bin/env bash

set -euxo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <prod|preview|dev>"
  echo "  prod: Deploy already-built artifact to prod environment"
  echo "  preview: Deploy already-built artifact to preview environment"
  echo "  dev: Deploy already-built artifact to dev environment"
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

case "$ENVIRONMENT" in
  "dev")
    echo "Deploying to dev environment..."
    if pnpm run | grep -q "migrate:dev"; then
      pnpm migrate:dev
    fi
    pnpm exec cf deploy --prebuilt --mode dev
    ;;
  "preview")
    echo "Deploying to preview environment..."
    pnpm exec cf workers versions create --mode dev
    ;;
  "prod")
    echo "Deploying to prod environment..."
    if pnpm run | grep -q "migrate:prod"; then
      pnpm migrate:prod
    fi
    pnpm exec cf deploy --prebuilt --mode prod
    ;;
esac

cd "$cwd"
