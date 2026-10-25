# Sync

`.agents` を正本にし、各 tool が読めない場所だけを symlink で橋渡しする。

## Project scope の link

`.agents/skills` と `.agents/prompts` が存在するときだけ作る。

| Target | Symlink target |
| --- | --- |
| `.claude/skills` | `../.agents/skills` |
| `.claude/commands` | `../.agents/prompts` |
| `.commandcode/commands` | `../.agents/prompts` |
| `.pi/prompts` | `../.agents/prompts` |
| `.opencode/commands` | `../.agents/prompts` |
| `.cursor/commands` | `../.agents/prompts` |

- Command Code / Pi / OpenCode / Cursor の skills は `.agents/skills` をネイティブに読む。symlink を作らない。
- Command Code に `.commandcode/skills` を作らない。`.agents/skills` を shadow する別コピーになる。
- Memory は root `AGENTS.md` をそのまま使う。symlink を作らない。

## User scope の link

`~/.agents/skills`、`~/.agents/prompts`、`~/.agents/AGENTS.md` が存在するときだけ作る。

| Target | Symlink target |
| --- | --- |
| `~/.claude/skills` | `../.agents/skills` |
| `~/.claude/commands` | `../.agents/prompts` |
| `~/.claude/CLAUDE.md` | `../.agents/AGENTS.md` |
| `~/.commandcode/commands` | `../.agents/prompts` |
| `~/.commandcode/AGENTS.md` | `../.agents/AGENTS.md` |
| `~/.pi/agent/prompts` | `../../.agents/prompts` |
| `~/.config/opencode/commands` | `../../.agents/prompts` |
| `~/.config/opencode/AGENTS.md` | `../../.agents/AGENTS.md` |
| `~/.cursor/commands` | `../.agents/prompts` |

- `~/.pi/agent/AGENTS.md` は Pi 固有ルールを持つため、この script では触らない。
- `~/.cursor/commands` は best effort。Cursor が拾わない場合は project `.cursor/commands` か skill を使う。
- OpenCode は `~/.agents/skills` をネイティブに読む。`~/.config/opencode/skills` の symlink は冗長だが害はない。

## Check と sync

```bash
# 変更せず、不足・衝突を報告 (問題があれば exit 1)
scripts/sync-harness.sh --check

# project scope を同期
scripts/sync-harness.sh

# user scope を同期
scripts/sync-harness.sh --global

# 両方
scripts/sync-harness.sh --all

# 作成内容だけ確認
scripts/sync-harness.sh --all --dry-run
```

- `--tool claude|command-code|pi|opencode|cursor` で対象を絞れる。
- `--root <path>` で project root を上書きできる。既定は `git rev-parse --show-toplevel`、git 外なら `pwd`。
- 実ディレクトリ、別 target の symlink、通常ファイルは上書きしない。`conflict` として報告する。
- 既存の実ディレクトリを移行するときは、中身を `.agents/skills` / `.agents/prompts` に移し、空になったディレクトリを消してから再実行する。

## 注意

- Pi の project prompt は `.pi/prompts`。`.pi/agent/prompts` を作っても Pi 0.74 では読まれない。既存 repo に `.pi/agent/prompts` がある場合は `.pi/prompts` に置き換える。
- Claude Code は root `AGENTS.md` を読むが、`CLAUDE.md` がある場合は `CLAUDE.md` を優先する。`CLAUDE.md` が `AGENTS.md` への symlink なら現状のままでよい。
- Cursor は `.cursor/commands` を custom command として読む。将来 `/migrate-to-skills` で skill に移行する場合は、この symlink を外して `.agents/skills` に寄せる。
- subagent 定義はこの sync の対象外。tool ごとの built-in と探索パスが違うため、必要になったプロジェクトで個別に設計する。
