# Coding Agent 設定の配布

Claude Code、Codex、Pi、GitHub Copilot の設定は、chezmoi によるファイル配布と `internal-cli` によるマージ・生成配布を組み合わせて管理する。
ローカル固有の設定は `.local.json` と `settings.local.json` に置き、Git 管理しない。

## Claude Code と Codex

| ソース | 配布先 | 配布方法 |
| --- | --- | --- |
| `chezmoi/dot_claude/` | `~/.claude/` | chezmoi |
| `chezmoi/dot_codex/` | `~/.codex/` | chezmoi |
| `chezmoi/dot_agents/` | `~/.agents/` | chezmoi |
| `config/claude-settings.json` | `~/.claude/settings.json` | `internal-cli merge-config` |
| `config/codex-config.toml` | `~/.codex/config.toml` | `internal-cli merge-config` |

`chezmoi/dot_codex/symlink_prompts` は Claude Code の commands を Codex から共有する。`chezmoi/dot_claude/symlink_skills` と `chezmoi/dot_codex/symlink_skills` は、全 Agent 共通の `~/.agents/skills` を共有する。
`~/.claude/settings.local.json` は Claude Code が直接読むローカル上書きであり、`merge-config` の入力ではない。

`merge-config` は管理対象の値を優先し、target にしかないキーは保持する。
更新時は `node internal/src/cli.ts merge-config --dry-run` を先に実行する。

## Pi

Pi の共有設定とモデルプロファイルは `config/pi-agent/` に置く。
`internal-cli pi-agent deliver` は共有設定、モデルプロファイル、Git 管理外の `.local.json` をマージして `~/.pi/agent/` へ配布する。

| ソース | 配布先 |
| --- | --- |
| `config/pi-agent/settings.json` | `~/.pi/agent/settings.json` |
| `config/pi-agent/models.json` | `~/.pi/agent/models.json` |
| `config/pi-agent/agents/frontend_worker.md` | `~/.pi/agent/agents/frontend_worker.md` |
| `chezmoi/private_dot_pi/agent/` | `~/.pi/agent/` の AGENTS、拡張、skills など |

Git 管理外の `providers.local.json` は利用可能な provider を指定する。
`settings.local.json`、`models.local.json`、`agents/*.local.json` はマシン固有の上書きである。

Pi の共有設定、モデルプロファイル、または local provider を変更したら、次を実行する。

```bash
node internal/src/cli.ts pi-agent deliver --dry-run
node internal/src/cli.ts pi-agent deliver
npx vitest run internal/src/pi-agent/deliver.test.ts
```

### model-profiles.json の制約

- プロファイル名とエージェントの対応は `internal/src/pi-agent/deliver.ts` の `AGENT_MODEL_PROFILES` が唯一の定義場所。
  `model-profiles.json` 単体では「どのプロファイルを誰が使うか」は決まらない。
- `provider/model:thinking` の thinking 部分は **pi-subagents の既知レベル (`off` / `minimal` / `low` / `medium` / `high` / `xhigh` / `max`) のみ**使うこと。
  provider 独自のレベル名 (例: `hard`) を指定すると、pi-subagents の `applyThinkingSuffix` が
  固定リストで既存サフィックスを判定するため、二重付与 (`provider/model:hard:hard`) が起きてゲートウェイに拒否される。
  2026-08 時点で上流修正は未対応のため、レベルを増やす場合は上流 (nicobailon/pi-subagents) の修正を先行させること。

## GitHub Copilot

`chezmoi/dot_copilot/` は chezmoi で `~/.copilot/` に配布する。
Copilot CLI 自体は mise で管理する。
MCP 設定の詳細は [MCP 設定の配布](mcp.md) を参照する。

## 設定変更の反映

Coding Agent の設定を変更した場合は、対応する配布経路を必ず実行する。
chezmoi のファイルを変更しただけでは `config/` 配下のマージ・生成設定は更新されない。
逆に `config/` だけを変更しても chezmoi 管理ファイルは更新されない。
