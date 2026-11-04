# Sync

skill が sync / check の要求をここにルーティングしたときに使う playbook。
`.agents` を正本にし、project の各 tool が読めない場所だけを symlink で橋渡しする。

## Project links

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

## Check と sync

```bash
# 変更せず、不足・衝突を報告 (問題があれば exit 1)
scripts/sync-harness.sh --check

# project scope を同期
scripts/sync-harness.sh

# 作成内容だけ確認
scripts/sync-harness.sh --dry-run

# 対象を絞る
scripts/sync-harness.sh --tool pi
```

- `--tool claude|command-code|pi|opencode|cursor` で対象を絞れる。
- `--root <path>` で project root を上書きできる。既定は `git rev-parse --show-toplevel`、git 外なら `pwd`。
- 実ディレクトリ、別 target の symlink、通常ファイルは上書きしない。`conflict` として報告する。
- 既存の実ディレクトリを移行するときは、中身を `.agents/skills` / `.agents/prompts` に移し、空になったディレクトリを消してから再実行する。

## 注意

- Pi の project prompt は `.pi/prompts`。`.pi/agent/prompts` があれば警告する。実装の根拠は `references/harness-matrix.md` を参照する。
- Claude Code は root `AGENTS.md` を読むが、`CLAUDE.md` がある場合は `CLAUDE.md` を優先する。`CLAUDE.md` が `AGENTS.md` への symlink なら現状のままでよい。
- Cursor は `.cursor/commands` を custom command として読む。将来 `/migrate-to-skills` で skill に移行する場合は、この symlink を外して `.agents/skills` に寄せる。
