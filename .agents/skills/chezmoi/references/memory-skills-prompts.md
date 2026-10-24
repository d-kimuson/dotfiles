# Memory / skills / prompts の一本化

## Memory

- 正本: `chezmoi/dot_agents/AGENTS.md` → `~/.agents/AGENTS.md`
- symlink: `~/.claude/CLAUDE.md`、`~/.commandcode/AGENTS.md`
- Codex の `~/.codex/AGENTS.md` は pueue など Codex 固有の指示がある場合だけ別ファイルにする。
- 各 CLI の user memory を個別にコピーしない。

## Skills

- 正本: `chezmoi/dot_agents/skills/` → `~/.agents/skills/`
- Claude / Codex: `~/.claude/skills`、`~/.codex/skills` は `~/.agents/skills` への symlink。
- Command Code: `~/.agents/skills` を自動発見する。`~/.commandcode/skills` は作らない。
- OpenCode: `~/.config/opencode/skills` を `~/.agents/skills` への symlink にする。
- Pi: `~/.pi/agent/settings.json` の `skills` で `~/.agents/skills` を指定する。
- 外部 skill は `npx skills add ... -a codex` で `~/.agents/skills` に入れ、chezmoi に取り込む。
- import された複製 (`~/.commandcode/skills` など) は `run_once_before_*` で消す。

## Prompts

- 正本: `chezmoi/dot_agents/prompts/` → `~/.agents/prompts/`
- symlink: `~/.claude/commands`、`~/.codex/prompts`、`~/.pi/prompts`、`~/.commandcode/commands`
- 資料は `chezmoi/dot_agents/deps/<name>/` に置き、prompt から絶対パスで参照する。
- prompt は 1 ファイル。手順書・テンプレートは `deps/` に分ける。

## 注意

- 正本を 1 つにし、コピーを作らない。
- CLI 固有の場所に独自 skill を置かない。必要な追加は Git 管理外のローカル層に置く。
- `~/.agents/skills/.system` は `.chezmoiignore` で除外している。
