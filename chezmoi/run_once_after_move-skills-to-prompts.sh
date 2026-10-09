#!/bin/sh
set -eu

for name in chaos-ui-engineering configure-harness handoff learn-it; do
  rm -rf -- "$HOME/.agents/skills/$name"
done
