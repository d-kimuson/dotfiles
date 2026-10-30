# ツール管理

## home-manager

通常の開発ツールは home-manager で宣言する。
パッケージは `chezmoi/private_dot_config/home-manager/home.nix.tmpl` の `home.packages` に追加する。
新しい依存関係は、先に `nix search nixpkgs <package>` で nixpkgs に存在するか確認する。

通常は unstable の `pkgs` を使う。
更新の安定性を優先する `direnv`、`zed-editor` は `pkgsStable` を使う。
`mise` は `pkgsStable` に固定せず `pkgs.mise` を使う。
利用する属性は検索結果の最後の要素に対応させる。
たとえば `legacyPackages.aarch64-darwin.ripgrep` は通常 `pkgs.ripgrep` と書く。

`home-manager switch` は `home.activation.installMiseTools` により `mise install` と `mise reshim` も実行する。
`installCursorAgent` も activation hook として定義されているため、手動で同じ処理を重ねない。

`home.nix.tmpl` は macOS で標準コマンドを GNU 版に統一する。
`sed`、`stat` は GNU 形式で書く (`sed -i 's/.../.../' file`、`stat -c '%a' file`)。
BSD 形式の `sed -i '' ...` や `stat -f '%Lp' ...` は GNU 版では引数の意味が変わり、失敗する。
`stat -f` はファイルシステムの情報を出す option で、`%Lp` をファイル名として扱うためである。

## mise

Node.js と npm で配布される CLI は `chezmoi/private_dot_config/mise/config.toml` で管理する。
Codex、Pi、OpenCode、Command Code、Playwright、agent-browser などが対象である。

新しい npm CLI はこのファイルへ追加する。
反映後は `mise install && mise reshim` を実行する。
home-manager を反映する場合は activation hook がこの処理を行う。

mise の `npm:` バックエンドは、既定ではライフサイクルスクリプト (preinstall・install・postinstall) を実行しない。
postinstall でバイナリを配置するパッケージ (`@opencode/cli` など) は、`"npm:@opencode/cli" = { version = "...", allow_builds = ["@opencode/cli"] }` のように `allow_builds` へパッケージ名を列挙する。
指定しないと shim が postinstall 前のプレースホルダを実行し、`postinstall script was not run` で失敗する。
`allow_builds` を後から足した場合は `mise install -f npm:<package>@<version>` で入れ直す。

`scripts/update.sh` は指定された npm CLI を `mise upgrade --bump -y` で更新し、更新後の `~/.config/mise/config.toml` を source state へ同期する。
このスクリプトを実行した後は Git diff を確認して、更新されたバージョンをコミット対象として扱う。

## nix profile

`nix profile` は通常のパッケージ管理には使わない。
`scripts/setup-nix-flakes-for-cc-remote.sh` が、Nix daemon を使えないリモート環境で Nix と `direnv` を導入するために使う。

`scripts/update.sh` は、home-manager に移行済みの `direnv`、`mise`、`zed-editor` を nix profile から取り除く。
新しいツールを profile に追加して、この掃除対象と競合させない。

## 更新

Nix の入力と mise の対象 CLI を更新する場合は `./scripts/update.sh` を使う。
このスクリプトは Nix の garbage collection (14 日より古い世代を削除)、chezmoi apply、flake update、移行済み profile パッケージの削除、home-manager switch、mise update、mise 設定の source state への同期、`mise prune`、npm キャッシュの削除を順に実行する。

`mise prune` は tracked-configs の死んだリンクと、どの config からも参照されなくなったツールバージョンを削除する。
稼働中のプロジェクトの `.node-version` などが参照するバージョンは残るため、既存プロジェクトには影響しない。
削除対象を事前に確認する場合は `mise ls --prunable` と `mise prune --dry-run` を使う。
npm CLI を `npm i -g` でインストールすると、その node バージョンの bin が mise の npm バックエンドをシャドウしてプロジェクトごとに古いバイナリが使われるため、npm CLI は必ず mise で管理する。
CLI 自身の自己更新も同じ経路で `~/.npm-global` に入る。`shell/envrc.sh` で自己更新を止め、バージョンの正本は mise の config だけにする。
現在止めているのは `DISABLE_AUTOUPDATER=1` (Claude Code) と `COMMANDCODE_SKIP_UPDATES=1` (Command Code)。
npm CLI を追加するときは、自己更新の無効化手段があるか確認して同じ場所に足す。
自己更新が起きたかは `~/.claude/.last-update-result.json` と `~/.commandcode/updates.json` で分かり、同じパッケージが外側にも入っていないかは `node internal/src/cli.ts npm-shadowing check` で検出できる。
検出したら外側のインストールを消し、mise のバージョンに寄せる。

パッケージを追加しただけなら、設定を適用して `home-manager switch` または `mise install && mise reshim` を実行する。
mise 管理のツールを外したあとに shim が残る場合は `.agents/troubleshots/mise-uninstall-leaves-stale-shim.md` を見る。
