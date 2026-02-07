#!/bin/bash

set -euo pipefail

append_line_if_not_exists() {
  local file="$1" # ファイルパス
  local line="$2" # 追加する文字列

  if ! grep -qF "$line" "$file" 2>/dev/null; then
    echo "$line" >> "$file"
    echo "[+] Added to $file: $line"
  else
    echo "[=] Already exists in $file: $line"
  fi
}

toml_key_exists() {
  local file="$1" # 更新対象の TOML
  local selector="$2" # dasel selector

  dasel -f "$file" -r toml -s "$selector" >/dev/null 2>&1
}

put_toml_value() {
  local file="$1" # 更新対象の TOML
  local selector="$2" # dasel selector
  local type="$3" # int / bool / string
  local value="$4" # 値
  local tmp

  tmp="$(mktemp)"
  if ! dasel put -r toml -w toml -t "$type" -v "$value" -f "$file" -o "$tmp" "$selector" --indent 0 --pretty=false; then
    rm -f "$tmp"
    echo "[!] Failed to update $file with: $selector" >&2
    return 1
  fi
  mv "$tmp" "$file"
}

ensure_toml_default() {
  local file="$1" # 更新対象の TOML
  local selector="$2" # dasel selector
  local type="$3" # int / bool / string
  local value="$4" # 値

  if toml_key_exists "$file" "$selector"; then
    return 0
  fi
  put_toml_value "$file" "$selector" "$type" "$value"
}

ensure_codex_config_defaults() {
  local file="$HOME/.codex/config.toml"

  mkdir -p "$(dirname "$file")"
  touch "$file"

  ensure_toml_default "$file" 'mcp_servers.modular-mcp.startup_timeout_sec' int 300
  ensure_toml_default "$file" 'mcp_servers.super-agent.tool_timeout_sec' int 3600
  ensure_toml_default "$file" 'features.skills' bool true
  ensure_toml_default "$file" 'features.child_agents_md' bool true
  ensure_toml_default "$file" 'features.web_search_request' bool true
  ensure_toml_default "$file" 'features.web_search_cached' bool true
}

# 存在したらエラーになっちゃうが冪等にしたいので set +e して /dev/null に捨てる
set +e
claude mcp remove modular-mcp -s user > /dev/null 2>&1
claude mcp remove super-agent -s user > /dev/null 2>&1
set -e

claude mcp add modular-mcp -s user -- npx -y @kimuson/modular-mcp@latest $(git rev-parse --show-toplevel)/config/modular-mcp.json
claude mcp add super-agent -s user -- node $HOME/repos/super-agent/dist/cli/index.mjs mcp serve

codex mcp add modular-mcp -- npx -y @kimuson/modular-mcp@latest $(git rev-parse --show-toplevel)/config/modular-mcp.json
codex mcp add super-agent -- node $HOME/repos/super-agent/dist/cli/index.mjs mcp serve

ensure_codex_config_defaults
