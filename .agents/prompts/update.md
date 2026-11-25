---
description: 'scripts/update.sh で Nix・mise を更新し、失敗時の修正・再発防止からコミットまで行う'
disable-model-invocation: true
user-invocable: true
---

`scripts/update.sh` で Nix と mise のツールを更新し、失敗や警告があれば原因を切り分けて修正・再発防止したうえでコミットする。

## 手順

### 1. 事前確認

1. カレントディレクトリが `~/.local/share/chezmoi` であることを確かめる。別の checkout (worktree など) の場合は反映を実行せず中断して報告する (`docs/commands.md`)。
2. `git status` で作業ツリーの状態を確認する。未コミットの変更があれば把握し、更新のコミットに混ぜない。

### 2. 更新の実行

サンドボックスの外で `./scripts/update.sh` を実行する (`nix`・`chezmoi`・`npm` はサンドボックス内で失敗する。`.agents/troubleshots/chezmoi-apply-in-sandbox.md`、`.agents/troubleshots/nix-in-sandbox.md`、`.agents/troubleshots/npm-in-sandbox.md`)。
`nix flake update` と `home-manager switch` に数分かかることがあるため、タイムアウトは長めに取る。

終了コードだけでなく、標準出力・標準エラーの `Warning:` も確認する (`scripts/update.sh` は一部ステップの失敗で停止しない)。

### 3. 失敗・警告への対応

エラーまたは警告が出たら、`.agents/troubleshots/` に既知の症状がないか確認したうえで原因を切り分ける。

#### リポジトリ側の根本原因

source state (`chezmoi/`) の設定不備 (`home.nix.tmpl`、`flake.nix.tmpl`、`mise/config.toml` の `allow_builds` や `allow_low_downloads` 不足など) や `scripts/update.sh` の不具合が原因の場合:

1. target state を直接直さず、source state や `scripts/update.sh` の正本を修正し、必要ならドキュメントも更新して同じ失敗の再発を防ぐ (`docs/overview.md`、`docs/tool-management.md`)。
2. 管理ツールの追加・削除・置換など `docs/guidelines/delegate.md` の「確認してからやる」に該当する変更が必要な場合は、原因と対応案を提示してユーザーに確認する。
3. 修正後に `./scripts/update.sh` を再実行し、エラーなく完了することを確かめる。

#### 外部要因・一時的な失敗

nixpkgs の破損 revision、GnuPG の残留ロック、ネットワーク一時障害など、リポジトリ側の設定では防げない原因の場合:

1. `.agents/troubleshots/` に既存のワークアラウンドがあれば従って復旧し、再実行する。
2. `mise upgrade` の警告が `min-release-age` ウィンドウによるスキップのみであれば、回避せず対象ツールを記録して続行する。`allow_builds` 不足やパッケージ変更など別原因の失敗はリポジトリ側の問題として修正する。
3. 新たな外部要因のワークアラウンドを得た場合は、`.agents/troubleshots/<topic>.md` を `docs/guidelines/writing/troubleshoot.md` の形式で追加する。

#### 自律解決できない場合

ユーザー判断や手動介入が必要な場合は、環境を壊したままにせず (必要に応じて `home-manager generations` で確認した直前世代の `activate` 実行や source state の復元等で復旧する)、原因・試した内容・選択肢を報告して中断する。

### 4. 検証

1. `chezmoi verify` を実行し、target state が source state と一致することを確かめる。失敗する場合は `chezmoi apply` を単体実行してエラーを確認し、原因を解消する。
2. `chezmoi/private_dot_config/mise/config.toml` が更新された場合は `node internal/src/cli.ts npm-shadowing check` を実行し、シャドウが無いことを確かめる (`docs/tool-management.md`)。
3. 根本原因の修正で他の管理層を変更した場合は、`AGENTS.md` の Feedback Loop に該当する検証を実行する。
4. `scripts/update.sh` や設定の修正、`.agents/troubleshots/`・ドキュメントの追加を行った場合は、`docs/guidelines/delegate.md` と `docs/guidelines/review/index.md` に従って内部レビューを実施する。
5. `git diff` を確認し、意図した差分だけであること、`observe/llm-usage/aggregate/` などコミット対象外が含まれていないことを確かめる。

### 5. コミット

`docs/guidelines/commit.md` と `docs/guidelines/delegate.md` に従ってコミットする。

- 差分が無ければコミットせず、最新であることを報告して終える。
- 根本原因の修正・再発防止と、`scripts/update.sh` によるバージョン更新は意味の単位でコミットを分ける。
- Feedback Loop の検証がすべて通ったら `docs/guidelines/delegate.md` に従って push する。

## 成果物

- 更新された環境 (home-manager・mise) と同期済みの source state
- 根本原因の修正・再発防止のコミットと、ツール更新のコミット (変更がある場合)
- 次の内容を含む実行結果の報告:
  - 更新されたツールとバージョン差分
  - 発生した失敗・警告、原因の分類、実施した修正・再発防止 (スキップしたツールがあればその理由)
  - 実行した検証コマンドと結果
  - 作成したコミットと push の結果
