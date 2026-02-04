#!/bin/bash

set -euo pipefail

# 存在したらエラーになっちゃうが冪等にしたいので set +e して /dev/null に捨てる

set +e
claude mcp remove modular-mcp -s user > /dev/null 2>&1
claude mcp remove super-agent -s user > /dev/null 2>&1
set -e

claude mcp add modular-mcp -s user -- npx -y @kimuson/modular-mcp@latest $(git rev-parse --show-toplevel)/modular-mcp.json
claude mcp add super-agent -s user -- node $HOME/repos/super-agent/dist/cli/index.mjs mcp serve

# TODO: codex
