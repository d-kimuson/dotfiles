# サンドボックス内で nix のコマンドが失敗する

## Symptom

Claude Code のサンドボックス内で `nix` 関連のコマンド (`home-manager switch`、`nix profile`、`nix flake lock` など) を実行すると、nix daemon やキャッシュへの接続がブロックされて失敗する。

## Workaround

サンドボックスの外で実行する。

## Why Not Fixed

nix daemon のソケットやキャッシュへのアクセス範囲はこのリポジトリの外 (Claude Code の sandbox 設定) で決まる。
