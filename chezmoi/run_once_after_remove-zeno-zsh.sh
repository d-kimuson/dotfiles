#!/bin/sh
set -eu

# zeno.zsh -> zabrze 移行時の後掃除。chezmoi が source を削除しても
# ターゲット側の旧ファイルは残るため、ここで取り除く。
rm -rf -- "$HOME/.zsh/zeno" "$HOME/.config/zeno"
