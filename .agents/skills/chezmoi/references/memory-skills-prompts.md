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

## Project scope (Command Code)

プロジェクトでは `.agents/` を標準にし、Command Code が読めないものだけ `.commandcode/` に symlink する。

| パス | Command Code | 対応 |
| --- | --- | --- |
| `.agents/skills/` | 自動発見する (`.commandcode/skills/` が優先) | symlink 不要 |
| `.agents/prompts/` | 読まない (`.commandcode/commands/` のみ) | `.commandcode/commands` → `../.agents/prompts` |
| root `AGENTS.md` | 読む | symlink 不要 |
| `.agents/AGENTS.md` | 読まない | `.commandcode/AGENTS.md` → `../.agents/AGENTS.md` |
| `.agents/agents/` | 読まない (`.commandcode/agents/` のみ) | `.commandcode/agents` → `../.agents/agents` |
| `.agents/mods/` | 読まない (`.commandcode/mods/` のみ) | `.commandcode/mods` → `../.agents/mods` |

project taste は `.commandcode/taste/` にローカル保存される。Git 共有ではなく `npx taste push` / `npx taste pull` を使い、グローバル gitignore で `**/.commandcode/taste/` を無視する。
`**.commandcode/settings.local.json` も個人用なのでグローバル gitignore の対象にする。

## 注意

- 正本を 1 つにし、コピーを作らない。
- CLI 固有の場所に独自 skill を置かない。必要な追加は Git 管理外のローカル層に置く。
- `~/.agents/skills/.system` は `.chezmoiignore` で除外している。
