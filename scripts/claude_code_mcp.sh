#!/bin/bash

set -uo pipefail

# 存在したらエラーになっちゃうが冪等にしたいので set +e して /dev/null に捨てる
~/.claude/local/claude mcp add context7 -s user -- npx -y @upstash/context7-mcp@latest > /dev/null 2>&1
~/.claude/local/claude mcp add serena -s user -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server > /dev/null 2>&1
