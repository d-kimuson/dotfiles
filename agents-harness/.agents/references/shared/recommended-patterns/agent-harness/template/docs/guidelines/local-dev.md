# Local Development

開発環境の依存管理のルール。

<!-- decision: dependency-management
  決めること: 言語のパッケージとそれ以外のツールを何で管理するか。グローバルインストールを許すか。CI とバージョンをどう揃えるか
  観察: lockfile、.tool-versions、mise.toml、flake.nix、devcontainer、Dockerfile、CI のセットアップ手順
  書き方: 管理の仕組みごとに 1 項目の箇条書きで書く。例外 (ブラウザのバイナリなど) と、依存を変更するときの注意 (lockfile を同じコミットに含めるなど) があれば足す
-->
