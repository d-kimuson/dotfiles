#!/bin/bash

set -uo pipefail

# 存在したらエラーになっちゃうが冪等にしたいので set +e して /dev/null に捨てる
~/bin/claude mcp add modular-mcp -s user -- npx -y @kimuson/modular-mcp@latest $(git rev-parse --show-toplevel)/modular-mcp.json > /dev/null 2>&1
