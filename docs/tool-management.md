# ツール管理

## home-manager

通常の開発ツールは home-manager で宣言する。
パッケージは `chezmoi/private_dot_config/home-manager/home.nix.tmpl` の `home.packages` に追加する。
新しい依存関係は、先に `nix search nixpkgs <package>` で nixpkgs に存在するか確認する。

通常は unstable の `pkgs` を使う。
更新の安定性を優先する `mise`、`direnv`、`zed-editor` は `pkgsStable`、最新機能が必要な Claude Code は `pkgsMaster` を使う。
利用する属性は検索結果の最後の要素に対応させる。
たとえば `legacyPackages.aarch64-darwin.ripgrep` は通常 `pkgs.ripgrep` と書く。

`home-manager switch` は `home.activation.installMiseTools` により `mise install` と `mise reshim` も実行する。
`installZenoZsh` と `installCursorAgent` も activation hook として定義されているため、手動で同じ処理を重ねない。

## mise

Node.js と npm で配布される CLI は `chezmoi/private_dot_config/mise/config.toml` で管理する。
Codex、Pi、OpenCode、GitHub Copilot、Playwright、agent-browser などが対象である。

新しい npm CLI はこのファイルへ追加する。
反映後は `mise install && mise reshim` を実行する。
home-manager を反映する場合は activation hook がこの処理を行う。

`scripts/update.sh` は指定された npm CLI を `mise upgrade --bump -y` で更新し、更新後の `~/.config/mise/config.toml` を source state へ同期する。
このスクリプトを実行した後は Git diff を確認して、更新されたバージョンをコミット対象として扱う。

## nix profile

`nix profile` は通常のパッケージ管理には使わない。
`scripts/setup-nix-flakes-for-cc-remote.sh` が、Nix daemon を使えないリモート環境で Nix と `direnv` を導入するために使う。

`scripts/update.sh` は、home-manager に移行済みの `direnv`、`mise`、`zed-editor` を nix profile から取り除く。
新しいツールを profile に追加して、この掃除対象と競合させない。

## 更新

Nix の入力と mise の対象 CLI を更新する場合は `./scripts/update.sh` を使う。
このスクリプトは chezmoi apply、flake update、移行済み profile パッケージの削除、home-manager switch、mise update、mise 設定の source state への同期を順に実行する。

パッケージを追加しただけなら、設定を適用して `home-manager switch` または `mise install && mise reshim` を実行する。
