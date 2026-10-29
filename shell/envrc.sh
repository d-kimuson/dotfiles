#!/usr/bin/env bash

# ====================
# Env variables
# ====================
export STARSHIP_CONFIG=${CHEZMOI_DIR}/config/starship.toml
export DOCKER_CONFIG=$HOME/.docker
export DIRENV_WARN_TIMEOUT=1m
export LITELLM_PORT="8082"

export CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR=true
export CLAUDE_CODE_DISABLE_AUTO_MEMORY=1
export CLAUDE_CODE_DISABLE_1M_CONTEXT=1
export MCP_TIMEOUT=120000

# 自己更新は npm i -g で mise をシャドウするため止める (docs/tool-management.md)
export COMMANDCODE_SKIP_UPDATES=1

export PNPM_HOME="$HOME/Library/pnpm"

# portless が発行するローカル CA を Node からも信頼させる（pi など portless の外で動く Node 製ツール用）
# CA がないマシンで設定すると、Node が起動のたびに読み込み失敗の警告を出すため、あるときだけ設定する
if [ -f "$HOME/.portless/ca.pem" ]; then
  export NODE_EXTRA_CA_CERTS="$HOME/.portless/ca.pem"
fi
