#!/usr/bin/env bash
# llama.cpp ルータサーバを portless 経由で起動する。
#
#   portless llama local-llm/serve.sh
#
# 常駐は home-manager の launchd agent (local-llm) が行う。
# 固定ポートは持たない。待ち受けポートは portless が PORT で注入し、
# 外からは https://llama.localhost で見える。
set -euo pipefail

if [ -z "${PORT:-}" ]; then
  echo "PORT が未設定。portless 経由で起動すること:" >&2
  echo "  portless llama $0" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRESET="${PRESET:-$SCRIPT_DIR/presets.ini}"
MODELS_DIR="${LOCAL_LLM_MODELS_DIR:-$HOME/models}"

# presets.ini の model / mmproj はモデル置き場からの相対パスで書いている
if [ ! -d "$MODELS_DIR" ]; then
  echo "モデル置き場 $MODELS_DIR がない。先に local-llm/pull.sh で取得すること" >&2
  exit 1
fi
cd "$MODELS_DIR"

# 127.0.0.1 で待ち受け、portless プロキシからの転送だけを受ける
exec llama-server \
  --models-preset "$PRESET" \
  --host 127.0.0.1 \
  --port "$PORT"
