#!/bin/bash

set -uo pipefail

# 存在したらエラーになっちゃうが冪等にしたいので set +e して /dev/null に捨てる
claude mcp add context7 -s user -- npx -y @upstash/context7-mcp@latest > /dev/null 2>&1
