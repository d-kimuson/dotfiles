# User Scope Harness 設計用の一時リポジトリ

- User Scope に配置する私専用のハーネスを構成する
- このリポジトリ直下を `~/` と見立てて構成していく

## 開発中の CLI

- 本番の harness root は `~/.agents`
- 開発中は `--root .` でリポジトリ直下を root として試す

```sh
pnpm agent-core:dev playbooks list
pnpm agent-core:dev verify
pnpm test
pnpm exec tsc -p . --noEmit
```
