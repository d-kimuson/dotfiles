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

### グローバルの skills と prompts

skill と prompt の分け方と、prompt の資料を `deps/` に分けるパターンは `docs/guidelines/harness.md` の Prompts に従う。グローバルのものは `chezmoi/dot_agents/` の `skills/<name>/`・`prompts/<name>.md`・`deps/<name>/` に置き、`~/.agents/` へ配布する。

prompt の本体では、資料のディレクトリを配布先の絶対パス (`~/.agents/deps/<name>/`) で示す。本体は `~/.claude/commands`・`~/.codex/prompts`・`~/.pi/prompts` の symlink を通して読まれる。
skill や prompt を削除・移動したときは、配布先の古いディレクトリを `run_once_after_*.sh` で消す (`.agents/troubleshots/chezmoi-apply-does-not-remove-deleted-source-files.md`)。

### 外部 skill (skills CLI)

外部リポジトリの skill は `npx skills add` で global にインストールし、結果を chezmoi に取り込む。
全 Agent が `~/.agents/skills` を参照するため、universal 配置になる `-a codex` を指定する。
`~/.claude/skills` は `~/.agents/skills` への symlink なので、`claude-code` を指定しない。

```bash
npx skills add <owner>/<repo> -g -a codex -s <skill> -y
chezmoi add ~/.agents/skills/<skill> ~/.agents/.skill-lock.json
```

`~/.agents/.skill-lock.json` も管理対象にしているため、別マシンでも `npx skills update -g` と `npx skills list -g` が機能する。
更新後は `chezmoi re-add ~/.agents/skills/<skill> ~/.agents/.skill-lock.json` で source state へ同期し、Git diff を確認する。

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

### ローカルプラグイン (mods)

`chezmoi/dot_claude/local-plugins/` (→ `~/.claude/local-plugins/`) の各サブディレクトリを、Claude Code が全セッションでプラグインとして読み込む。
読み込みは `config/claude-settings.json` の `env` で有効にする。`CLAUDE_CODE_PLUGIN_DIRS` がこのディレクトリを指し、`CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` が [mods](https://code.claude.com/docs/en/plugins/mods/overview) の hooks module (`hooks/register.ts`) を読み込ませる。
mods は early access で、この環境変数がないと hooks module は読み込まれない。

`self-compact` は、Claude が自分のコンテキストを compact して作業を続けるための `compact` ツールを追加する。
`$.session.compact()` はターンの実行中に呼べないため、ツール呼び出しでは予約だけを記録し、`turn.complete` で compact したあとに `resume` のプロンプトで次のターンを始める。
compact の対象はセッション本体のコンテキストなので、サブエージェントからの呼び出しは断り、サブエージェントのターン完了では発火しない。
`mcp__<plugin>__<name>` 形式のツールは既定で ToolSearch の裏に回るため、`tool.describe` でプロンプトのツール一覧に固定する。

source state の `dot_claude-plugin` は配布先で `.claude-plugin` になる。型定義 (`.claude-plugin/types/`) と `tsconfig.json` は Claude Code がプラグインの読み込み時に配布先へ生成するため、型検査とテストは配布先で実行する。

```bash
pnpm --dir internal exec tsc -p ~/.claude/local-plugins/self-compact --noEmit
cd ~/.claude/local-plugins/self-compact && claude plugin test
```

## language-guard (応答テキストの日本語固定)

モデルのユーザー向けテキストが英語・中国語へドリフトするのを、Claude Code と pi の両方で防ぐ。
thinking は対象外で、応答のテキスト部分だけを判定する。
判定ロジックは `chezmoi/dot_claude/hooks/language-guard/detect.mts` (→ `~/.claude/hooks/language-guard/detect.mts`) に集約し、
pi 側の `detect.mts` はそこへの symlink (`symlink_detect.mts`) である。

| タイミング | Claude Code (`hook.mts`) | pi (`extensions/language-guard/index.ts`) | 動作 |
| --- | --- | --- | --- |
| ユーザー入力時 | `UserPromptSubmit` | `before_agent_start` | 日本語で応答するリマインダーを添える (予防) |
| ツール呼び出しに添えた途中経過 | `PostToolUse` | `turn_end` (toolCall あり) | ドリフトしていたら注意を差し込む。作業は止めない |
| 最終応答 | `Stop` | `turn_end` (toolCall なし) | ドリフトしていたら 1 回だけ日本語で書き直させる |

- 判定前にコードブロック・インラインコード・URL・パス・識別子・表・引用を除去する。
  中国語は仮名を含まない漢字文 (日本語で使わない簡体字を含むか、漢字が長く続く) が 1 文でもあれば違反、
  英語は 8 語以上の英語行が散文の一定比率を占めたら違反とする (コミットメッセージ列挙などを想定し、箇条書きの英語行は軽く数える)。
- 直前のユーザー入力が出力言語として英語・中国語を指定したターン (「英語で」「英訳」「in English」など) は検査しない。
  「英語で書かれた〜」のように入力側を指す言い回しや、「日本語に訳して」のように日本語を求める入力は対象外。
- pi は対話モード (`tui` / `rpc`) でのみ動き、subagent などの headless 実行には触らない。

Claude Code の hook は `config/claude-settings.json` の `hooks` に登録する。
変更時は次を実行する。

```bash
cd internal && npx vitest run src/language-guard && npx tsc -p . --noEmit
```

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

### self-compact (pi の自己 compact)

pi extension `chezmoi/private_dot_pi/private_agent/extensions/self-compact.ts`
(→ `~/.pi/agent/extensions/self-compact.ts`) は、Claude Code の self-compact プラグインと同じ名前・同じ引数の `mcp__self-compact__compact` ツールを追加する。
`ctx.compact()` は実行中のエージェントを中断するため、ツールは予約を記録し、`terminate: true` を返してターンを終える (同じバッチのツールがすべて終了を求めたときだけ効く)。システムプロンプトのツール一覧に載せるため `promptSnippet` を付ける。`agent_settled` で compact し、`pi.sendUserMessage()` で `resume` を送って次の実行を始める。
compact に失敗したときは、理由を `resume` の前に付けて送る。
print・json モードでは実行が終わるとプロセスも終わり、`resume` を続けられないため、ツールは予約を断る。
変更時は `npx vitest run internal/src/pi-agent/self-compact.test.ts` を実行する。

## GitHub Copilot

`chezmoi/dot_copilot/` は chezmoi で `~/.copilot/` に配布する。
Copilot CLI 自体は mise で管理する。
MCP 設定の詳細は [MCP 設定の配布](mcp.md) を参照する。

## 設定変更の反映

Coding Agent の設定を変更した場合は、対応する配布経路を必ず実行する。
chezmoi のファイルを変更しただけでは `config/` 配下のマージ・生成設定は更新されない。
逆に `config/` だけを変更しても chezmoi 管理ファイルは更新されない。
