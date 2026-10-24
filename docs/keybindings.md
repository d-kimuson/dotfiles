# キーバインドの配布

キーバインドのマスターは `config/agent/keybindings.json` である。
`internal-cli keybindings deliver` が共通のキーマップを各エージェントの形式へ変換して書き込む。

## 入力

| ファイル | 役割 |
| --- | --- |
| `config/agent/keybindings.json` | 共通キーマップ。action ごとにキーの配列を持つ |

キーは `modifier+key` 形式で書く。複数のキーは配列で並べる。
`enter` は配布先に応じて `return` に変換する。

## action

| action | 意味 |
| --- | --- |
| `editor.cursorUp` / `cursorDown` / `cursorLeft` / `cursorRight` | 入力欄のカーソル移動 |
| `editor.lineStart` / `editor.lineEnd` | 行頭・行末 |
| `editor.newline` | 改行 (送信しない) |
| `model.cycleForward` / `model.cycleBackward` | モデルを前後に切り替える |
| `command.palette` | コマンドパレット |
| `history.previous` / `history.next` | 入力履歴 |
| `voice.dictationSingleTap` | 音声入力の単発起動 |

## 配布先

| target | 配布先 | 形式 | 対応する action |
| --- | --- | --- | --- |
| `claude-code` | `~/.claude/keybindings.json` | `bindings` 配列 | `editor.newline`、`history.*` |
| `codex` | `~/.codex/keybindings.json` | `{command, key}` 配列 | `voice.dictationSingleTap` |
| `pi-agent` | `~/.pi/agent/keybindings.json` | action → キー配列 | `editor.*`、`model.*` |
| `command-code` | `~/.commandcode/keybindings.json` | action → キー配列 | `editor.*` |
| `opencode` | `~/.config/opencode/cli.json` | `keybinds` (カンマ区切り) | `editor.*`、`model.*`、`command.palette`、`history.*` |

対応する action がない target では、その action をスキップする。
既存ファイルの管理外キーは保持する。
前回配布したキーは `~/.local/state/dotfiles/keybindings.json` に記録し、source から削除した action は配布先からも消す。
`--target` で配布先を選べる。`all` で全 target に配布する。

Claude Code の入力欄のカーソル移動は vim mode 側で扱うため、`editor.*` のうち `editor.newline` だけを `chat:newline` に変換する。
`ctrl+enter` は Claude Code の既定の「今すぐ送信」と衝突するため、この target では配布しない。
Codex の `keybindings.json` は音声入力などのアプリコマンド用で、エディタのカーソル移動は持たない。

## 更新手順

1. `config/agent/keybindings.json` を更新する。
2. `node internal/src/cli.ts keybindings deliver --dry-run` で差分を確認する。
3. `node internal/src/cli.ts keybindings deliver` で配布する。
4. `npx vitest run internal/src/keybindings/deliver.test.ts` を実行する。

`dotfiles-apply` は Pi 設定配布、Claude/Codex/Command Code の設定マージに続いて、キーバインドを配布する。
