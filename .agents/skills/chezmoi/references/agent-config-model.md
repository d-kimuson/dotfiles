# Agent 設定の抽象化レイヤー

## 原則

- 正本は dotfiles 側に置く。各 CLI の設定ディレクトリは配布先であり、直接編集しない。
- 特定の CLI の都合 (ファイル形式、キー名、symlink の対応) は `internal-cli` の adapter に閉じ込める。
  CLI を乗り換えても、正本と配布の考え方をそのまま使えるようにする。
- 共有できるものは共有する。memory、skills、prompts は `~/.agents` を正本にし、各 CLI へ symlink する。
- 形式変換が必要なものだけ `internal-cli` で生成する。MCP、keybindings、アプリが書き換える settings が該当する。
- マシン固有値は Git 管理外に置く。`*.local.json`、`shell/localrc.sh`、`shell/env-secrets.sh`、`MCP_LAYERS`。

## 管理層

| 層 | 役割 | 例 |
| --- | --- | --- |
| chezmoi | 静的なファイル、テンプレート、symlink | `~/.agents/skills`、`~/.claude/CLAUDE.md` |
| `merge-config` | アプリも書き換える設定。管理キーだけ合わせる | `~/.claude/settings.json`、`~/.codex/config.toml`、`~/.commandcode/config.json` |
| `internal-cli <domain> deliver` | 形式変換が必要な生成物 | MCP、keybindings、Pi 設定 |
| ローカル上書き | マシン固有の値 | `*.local.json`、`shell/localrc.sh`、環境変数 |

## 所有権のルール

- 1 つのターゲットを 2 つの層で管理しない。
  chezmoi の `symlink_` と `deliver` が同じファイルを書くと、`chezmoi verify` が失敗する。
  実際に `~/.pi/agent/keybindings.json` は chezmoi 管理から `keybindings deliver` へ移した。
- アプリが書き換えるファイルは `merge-config` か `deliver` に任せる。
  chezmoi で固定すると、アプリの更新のたびに差分が出る。
- アプリが内部で使う local MCP (Codex の `node_repl` など) は消さない。
  merge する target と replace する target を分ける。
- 古い配布物を消す必要がある場合は、前回配布したキーを state file に記録する。
  例: `~/.local/state/dotfiles/claude-settings-hooks.json`、`~/.local/state/dotfiles/keybindings.json`。

## 新しい Agent を追加するとき

1. 設定の実体と形式を確認する (memory、skills、prompts、MCP、keybindings、settings)。
2. 共有できるものは `~/.agents` への symlink で済ませる。
3. 形式変換が必要なら `internal-cli` に target を追加する。
   - 入力は `config/` の master。
   - 出力は target の形式へ変換する adapter。
   - `--dry-run`、テスト、`docs/` を同じ変更で追加する。
4. 既存の import 複製がある場合は `run_once_before_*` で削除する。
5. `AGENTS.md` の References と `docs/coding-agents.md` を更新する。

## 参照

- `docs/overview.md`: 管理層と変更の完了条件
- `docs/coding-agents.md`: Agent ごとの配布経路
- `docs/keybindings.md`: keybindings の target 変換
- `docs/mcp.md`: MCP の層と target
