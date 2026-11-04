# User Scope Harness

- `~/.agents` の正本。chezmoi が `~/.agents` をこのリポジトリの `.agents/` への symlink にする
- このリポジトリ直下を `~/` と見立てて構成する
- Prompt を書くときは `.agents/guidelines/harness.md` に従う

## 開発中の CLI

- 本番の harness root は `~/.agents`
- 開発中は `--root .` でリポジトリ直下を root として試す

```sh
pnpm agent-core:dev playbooks list
pnpm agent-core:dev verify
pnpm test
pnpm exec tsc -p . --noEmit
```
