#!/usr/bin/env bash
# mise の shims を PATH の先頭に足す。
# claude を mise の shim 経由で起動すると PATH から shims が外れ、起動時の cwd で解決したツールの bin だけが並ぶ。
# プロジェクトが未インストールのバージョン (.node-version など) を指すと node が PATH から消え、
# `#!/usr/bin/env node` の hook が落ちる。shims を足せば、足りないバージョンは shim が自動インストールする。
#
#   mise-shims.sh <command> [args...]  shims を足した PATH で command を実行する (hook のラッパー)
#   mise-shims.sh                      SessionStart hook として、以降の Bash ツールの PATH に shims を足す
set -euo pipefail

shims="${MISE_DATA_DIR:-$HOME/.local/share/mise}/shims"

if [ "$#" -gt 0 ]; then
  PATH="$shims:$PATH" exec "$@"
fi

# CLAUDE_ENV_FILE は Bash ツールにだけ反映され、他の hook の環境には届かない
if [ -n "${CLAUDE_ENV_FILE-}" ]; then
  printf 'export PATH="%s:$PATH"\n' "$shims" >> "$CLAUDE_ENV_FILE"
fi
