# update

`scripts/update.sh` で Nix と mise のツールを更新し、失敗時の自動修正・再発防止からコミットまでを行う prompt。本体は `.agents/prompts/update.md`。

## いつ使うか

このマシンの Nix (home-manager) と mise 管理の CLI を最新化し、nixpkgs の不整合や mise のビルド設定不足など失敗時の原因切り分け・修正・再発防止からコミットまで任せたいときに使う。スクリプトだけを実行したい場合は使わず、`./scripts/update.sh` を直接実行する (`docs/commands.md`)。

## 起動

Claude Code、Pi、Command Code で `/update` と入力する。モデルが自分から起動することはない (`disable-model-invocation: true`)。

## 成果物

- 実機の home-manager と mise の更新、および source state (`chezmoi/private_dot_config/mise/config.toml`) への同期
- リポジトリ側の根本原因が見つかった場合の修正・再発防止コミット (外部要因のワークアラウンドは `.agents/troubleshots/` に記録)
- ツール更新のコミットと、更新内容・失敗対応・検証結果の報告
