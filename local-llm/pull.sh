#!/usr/bin/env bash
# presets.ini が参照するモデルを Hugging Face から取得する。
# 合計 18GB ほどあるので chezmoi apply では実行せず、必要なマシンで明示的に叩く。
# 取得済みのファイルは飛ばし、途中で止まったものは続きから落とす。
set -euo pipefail

MODELS_DIR="${LOCAL_LLM_MODELS_DIR:-$HOME/models}"

REPO="SC117/Qwen3.6-35B-A3B-uncensored-heretic-Native-MTP-Preserved-APEX-GGUF"
DEST="$MODELS_DIR/qwen3.6-35b-a3b-uncensored"
FILES=(
  "Qwen3.6-35B-A3B-uncensored-heretic-Native-MTP-Preserved-APEX-I-Compact.gguf"
  "mmproj-Qwen3.6-35B-A3B-uncensored-heretic-Native-MTP-Preserved-APEX-F16.gguf"
)

mkdir -p "$DEST"
for file in "${FILES[@]}"; do
  if [ -f "$DEST/$file" ]; then
    echo "skip: $file"
    continue
  fi
  echo "download: $file"
  curl -fL --retry 3 -C - -o "$DEST/$file.part" "https://huggingface.co/$REPO/resolve/main/$file"
  mv "$DEST/$file.part" "$DEST/$file"
done
