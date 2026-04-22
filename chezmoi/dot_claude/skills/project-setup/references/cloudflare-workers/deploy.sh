#!/usr/bin/env bash

set -euxo pipefail

# 引数チェック
if [ $# -ne 1 ]; then
  echo "Usage: $0 <prod|preview|dev>"
  echo "  prod: Deploy to prod environment"
  echo "  preview: Deploy to preview environment"
  echo "  dev: Deploy to dev environment"
  exit 1
fi

ENVIRONMENT=$1

# 有効な環境かチェック
if [ "$ENVIRONMENT" != "prod" ] && [ "$ENVIRONMENT" != "preview" ] && [ "$ENVIRONMENT" != "dev" ]; then
  echo "Error: Invalid environment '$ENVIRONMENT'. Must be 'prod', 'preview', or 'dev'"
  echo "Usage: $0 <prod|preview|dev>"
  exit 1
fi

cwd=$(pwd)
cd $(git rev-parse --show-toplevel) # リポジトリトップ

pnpm build

# 環境に応じたデプロイ実行
case "$ENVIRONMENT" in
  "dev")
    echo "Deploying to dev environment..."
    pnpm deploy:remote
    ;;
  "preview")
    echo "Deploying to preview environment..."
    pnpm deploy:preview
    ;;
  "prod")
    echo "Deploying to prod environment..."
    pnpm deploy:remote --env prod
    ;;
esac

cd $cwd
