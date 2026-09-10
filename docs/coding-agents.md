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

### herdr-auto-title (Claude Code のタブ名自動付与)

Claude Code の `UserPromptSubmit` hook として
`chezmoi/dot_claude/hooks/executable_herdr-auto-title.py`
(→ `~/.claude/hooks/herdr-auto-title.py`) を配布し、
`config/claude-settings.json` の `hooks.UserPromptSubmit` から呼び出す。
スクリプトは [sh1ma/herdr-auto-title](https://github.com/sh1ma/herdr-auto-title)
の vendor で、会話内容から短いタイトルを生成して herdr のタブ名に反映する。

上流から更新を取り込むときは `herdr_auto_title.py` の差分を
vendored ファイルへ手で反映し、ファイル先頭の改変メモも更新する。
pi 対応の差分 (`PI` バックエンド、`pi_user_prompts`、`detect_agent` の
`agent: "pi"` 判定など) を落とさないこと。
動作確認は `python3 -m py_compile` と `HERDR_AUTO_TITLE_DEBUG=1` 付きの
フォアグラウンド実行 (`HERDR_AUTO_TITLE_FOREGROUND=1` で標準入力に hook JSON) で行う。

## Pi

Pi の共有設定とモデルプロファイルは `config/pi-agent/` に置く。
`internal-cli pi-agent deliver` は共有設定、モデルプロファイル、Git 管理外の `.local.json` をマージして `~/.pi/agent/` へ配布する。

| ソース | 配布先 |
| --- | --- |
| `config/pi-agent/settings.json` | `~/.pi/agent/settings.json` |
| `config/pi-agent/models.json` | `~/.pi/agent/models.json` |
| `config/pi-agent/agents/frontend_worker.md` | `~/.pi/agent/agents/frontend_worker.md` |
| `chezmoi/private_dot_pi/agent/` | `~/.pi/agent/` の AGENTS、拡張、skills など |

### herdr-auto-title (pi のタブ名自動付与)

pi extension `chezmoi/private_dot_pi/private_agent/extensions/herdr-auto-title.ts`
(→ `~/.pi/agent/extensions/herdr-auto-title.ts`) が `input` イベントを受け、
Claude Code と同じ vendored スクリプト
(`~/.claude/hooks/herdr-auto-title.py` に `agent: "pi"` 付きの hook 入力を渡す)
をバックグラウンド起動して herdr のタブ名に反映する。
スクリプトは自前で daemonize するため extension は待たずに切り離し、
エージェントの応答を止めない。タイトル生成は `pi -p` (分離フラグ付き) を
優先し、無ければ `claude` / `codex` CLI にフォールバックする。

| 環境変数 | 役割 |
| --- | --- |
| `HERDR_AUTO_TITLE_DISABLE=1` | 無効化 (extension とスクリプトの両方が見る) |
| `HERDR_AUTO_TITLE_LANG` | `auto` / `en` / `ja`。既定はロケール追従 |
| `HERDR_AUTO_TITLE_BACKEND` | `auto` / `pi` / `claude` / `codex` |
| `HERDR_AUTO_TITLE_MODEL` | 生成に使うモデル。空なら各 CLI の既定 |
| `HERDR_AUTO_TITLE_REGEN_EVERY` | 何プロンプトごとに作り直すか。既定の 0 は最初の1回のみ |
| `HERDR_AUTO_TITLE_DEBUG=1` | `~/.claude/herdr-auto-title/debug.log` にログ |

手動で付けたタブ名は上書きしない (連番ラベルと前回付けたタイトルのみ対象)。
変更時は `npx vitest run internal/src/pi-agent/herdr-auto-title.test.ts` を実行する。

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
