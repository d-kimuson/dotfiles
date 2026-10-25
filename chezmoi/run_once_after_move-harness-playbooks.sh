#!/bin/sh
set -eu

# 単独 prompt は kimuson-harness の playbook に移行した。
rm -f -- "$HOME/.agents/prompts/configure-harness.md"
rm -f -- "$HOME/.agents/prompts/harness-sync.md"

# 旧 references は playbooks/ に移行した。
rm -f -- "$HOME/.agents/skills/kimuson-harness/references/sync.md"
rm -f -- "$HOME/.agents/skills/kimuson-harness/references/configure-harness.md"
