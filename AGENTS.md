# dotfiles

## Overview

複数のマシンで同じ開発環境を再現するための個人用 dotfiles。マシン間で共通の設定と、chezmoi テンプレートでマシンごとに変える設定を 1 か所で管理し、コーディングエージェント (Claude Code・Codex・Pi・Copilot CLI) と MCP の設定も配布する。

技術スタック: chezmoi・home-manager (Nix)・mise・TypeScript (Node.js 26、pnpm) の internal-cli

## Directory Structure

```text
.
├── AGENTS.md        # エージェント向けの入口 (CLAUDE.md はこれへの symlink)
├── chezmoi/         # source state のルート (.chezmoiroot)。$HOME へ配布するファイル
│   ├── dot_agents/          # ~/.agents: グローバルの skills と prompts
│   ├── dot_claude/          # ~/.claude: Claude Code の設定と hooks (language-guard など)
│   ├── dot_codex/           # ~/.codex: Codex の指示と skills・prompts への symlink
│   ├── dot_copilot/         # ~/.copilot: Copilot CLI の MCP 設定
│   ├── private_dot_config/  # ~/.config: home-manager、mise、zabrze など
│   └── private_dot_pi/      # ~/.pi: Pi の設定と extensions
├── config/          # internal-cli がマージ・生成して配布する設定 (MCP、Claude/Codex、Pi)
├── internal/        # internal-cli (TypeScript)。設定の配布とマージ、LLM 利用量の集計
├── shell/           # ターゲット環境で読み込むシェル設定と秘密情報のテンプレート
├── scripts/         # 新しいマシンのセットアップと一括更新
├── observe/         # LLM 利用量の観測データ (Git 管理する集計とマスタ)
├── docs/            # 運用文書、用語 (CONTEXT.md)、機能仕様 (features/)、ガイドライン (guidelines/)
└── .agents/         # このリポジトリ用の skills・prompts・troubleshots
```

## Feedback Loop

| コマンド | 検証内容 | 実行する条件 |
| --- | --- | --- |
| `pnpm --dir internal typecheck` | 型検査 | `internal/` か `chezmoi/dot_claude/hooks/language-guard/` を変更した |
| `pnpm --dir internal test` | ユニットテスト | 同上 |
| `chezmoi apply` → `chezmoi verify` | 反映して、target state が source state と一致する | `chezmoi/` を変更した |
| `home-manager switch` | Nix の設定がビルドでき、ツールが入る | home-manager の設定を変更した (`chezmoi apply` の後) |
| `mise install && mise reshim` | CLI とランタイムが入る | mise の設定だけを変更した (`chezmoi apply` の後) |
| `node internal/src/cli.ts mcp deliver` / `merge-config` / `pi-agent deliver` | 設定を生成・マージして配布できる | `config/` か配布ロジックを変更した (変更に対応するものだけ) |

CI は `chezmoi init --apply` だけを実行し、型検査とテストは実行しない。
反映のコマンドは、この working tree が `~/.local/share/chezmoi` にあるときだけ実行する。別の checkout (worktree など) では型検査とテストまでにする。

## References

References contain important instructions that are intentionally separated for progressive disclosure.
Always read every reference relevant to the task before making changes.

| いつ読むか | 参照先 |
| --- | --- |
| タスクの進め方や内部レビューを決める、指示のない操作 (コミット、push、実機への反映など) をするか判断する | `docs/guidelines/delegate.md` |
| コミットする | `docs/guidelines/commit.md` |
| 変更をレビューする | `docs/guidelines/review/index.md` |
| ドキュメントを書く | `docs/guidelines/writing/index.md` と文書タイプ別のガイド |
| AGENTS.md、ガイドライン、skills、prompts を変更する | `docs/guidelines/harness.md` |
| コードを書く・変更する | `docs/guidelines/coding/index.md` |
| テストの種類や範囲を決める、失敗したテストを再現する | `docs/guidelines/quality-assurance/index.md` |
| `internal/` の依存を追加・更新する | `docs/guidelines/local-dev.md` |
| 用語の意味を確かめる、用語を足す・変える | `docs/CONTEXT.md` |
| 管理層をまたぐ変更をする、変更の完了条件を確かめる | `docs/overview.md` |
| `chezmoi/` のファイルやテンプレートを変更する | `docs/chezmoi.md` |
| chezmoi・home-manager・mise・shell の設定を変更・反映する | `.agents/skills/chezmoi/` skill |
| マシンに配るツールを追加・更新・削除する | `docs/tool-management.md` |
| MCP の設定を変更する | `docs/mcp.md` |
| Claude Code・Codex・Pi・Copilot の設定を変更する | `docs/coding-agents.md` |
| 設定変更を反映する、初期セットアップや更新をする | `docs/commands.md` |
| LLM 利用量の観測や集計を変更する | `docs/features/llm-usage-observation.md` |
| コマンドやツールが想定外に失敗する | `.agents/troubleshots/` |
