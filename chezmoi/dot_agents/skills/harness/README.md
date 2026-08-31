# harness

Coding Agent の prompt と skill の配置、Claude Code / pi 互換用 symlink、呼び出しメタデータを保守する skill です。

`.agents/prompts/` を prompt の正規配置とし、`~/.claude/commands` と `~/.pi/prompts` から symlink で参照します。
