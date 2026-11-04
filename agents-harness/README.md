# User Scope Harness

- User Scope に配置する私専用のハーネス
- `.agents/` が `~/.agents` の正本。chezmoi (`chezmoi/symlink_dot_agents.tmpl`) が `~/.agents` をここへの symlink にする
- `npx skills add` で入れた skill など、`~/.agents` への変更のうち必要なものを commit する
- CLI が書き込む `.agents/skills/{.system,.trash,synced}/` と、マシン固有の `.agents/providers.json` は gitignore している

## 開発中の CLI

- 本番の harness root は `~/.agents`
- 開発中は `--root .` でリポジトリ直下を root として試す

```sh
pnpm agent-core:dev playbooks list
pnpm agent-core:dev models list
pnpm agent-core:dev verify
pnpm test
pnpm exec tsc -p . --noEmit
```
