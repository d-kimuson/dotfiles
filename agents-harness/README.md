# User Scope Harness

- User Scope に配置する私専用のハーネス
- `.agents/` が `~/.agents` の正本。chezmoi (`chezmoi/symlink_dot_agents.tmpl`) が `~/.agents` をここへの symlink にする
- セッションごとに使い捨ての環境 (Claude Code on the web) には、配る集合を正本から変えるため、symlink ではなく `agent-core export` でコピーを配る。その環境で動かない Agent CLI 向けのファイルは `--profile claude-code-web` で外す
- `npx skills add` で入れた skill など、`~/.agents` への変更のうち必要なものを commit する
- 外部 CLI の自動生成物やローカル状態など、Git 管理外にするファイルは `.gitignore` で除外している

## 開発中の CLI

- 本番の harness root は `~/.agents`
- 開発中は `--root .` でリポジトリ直下を root として試す

```sh
pnpm agent-core:dev playbooks list
pnpm agent-core:dev models list
pnpm agent-core:dev verify
pnpm agent-core:dev export --to "$(mktemp -d)" --profile claude-code-web
pnpm test
pnpm exec tsc -p . --noEmit
```
