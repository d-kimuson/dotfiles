# 配布パターンの使い分け

## chezmoi

使う: 静的なファイル、テンプレート、symlink。
例: `~/.agents/skills`、`~/.claude/CLAUDE.md`、`~/.config/opencode/skills`。

- source state の属性 (`dot_`、`private_`、`symlink_`、`executable_`) を確認する。
- ドット始まりのファイルは配布されない。
- source から削除しても target は残る。必要なら `run_once_*` で消す。

## merge-config

使う: アプリも書き換える設定。
例: `~/.claude/settings.json`、`~/.codex/config.toml`、`~/.commandcode/config.json`。

- master は `config/`。
- 管理キーは master を優先し、target にしかないキーは残す。
- hooks は外部ツールの登録を残すため、前回配布を state に記録して merge する。
- `--dry-run` はキーパスだけを出す。

## deliver

使う: 形式変換が必要な生成物。
例: `mcp deliver`、`keybindings deliver`、`pi-agent deliver`。

- target ごとに adapter を持つ。
- 全置換するか merge するかを target ごとに決める。
  - 生成物で他ツールが書かない: 全置換 (Pi / Command Code / OpenCode の MCP、keybindings)
  - アプリがローカルに追加する: merge (Claude / Codex の MCP)
- 前回配布したキーを state に記録し、source から消えたものを target からも消す。
  - `~/.local/state/dotfiles/keybindings.json`
  - `~/.local/state/dotfiles/claude-settings-hooks.json`
- `--dry-run` を必ず用意する。秘密情報は出さない。

## 判断フロー

1. symlink で済むか？ → chezmoi `symlink_`
2. 静的なファイルか？ → chezmoi `dot_` / `.tmpl`
3. アプリが書き換えるか？ → `merge-config`
4. target ごとに形式が違うか？ → `deliver`
5. マシン固有か？ → `*.local.*` / `shell/localrc.sh` / 環境変数

## 検証

- `pnpm --dir internal typecheck`
- `pnpm --dir internal test`
- 各 deliver の `--dry-run`
- `chezmoi apply` → `chezmoi verify`
