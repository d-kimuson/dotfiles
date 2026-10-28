# nixpkgs の flake を評価しようとすると timeout する

## Symptom

nixpkgs のブランチ上のパッケージの版を確かめるために flake 参照で `nix eval` すると、nixpkgs の取得 (Git cache への展開) で止まったまま、実行側の timeout で打ち切られる。

```console
$ nix eval --raw github:NixOS/nixpkgs/nixos-26.05#mise.version
unpacking 'github:NixOS/nixpkgs/718f670e845328e9c2cecdd832835712b2cbd065' into the Git cache...
error: interrupted by the user
```

## Workaround

版だけを知りたいときは flake を評価せず、GitHub の raw ファイルから `package.nix` を読む。

```sh
curl -fsSL https://raw.githubusercontent.com/NixOS/nixpkgs/nixos-26.05/pkgs/by-name/mi/mise/package.nix \
  | grep -n 'version ='
```

パスの規約は `pkgs/by-name/<名前の先頭 2 文字>/<名前>/package.nix`。by-name に移っていないパッケージは `pkgs/<カテゴリ>/<名前>/default.nix` を読む。

実際にビルドもするときは `nix build` に切り替え、timeout を長く取る。たとえば `nix build github:NixOS/nixpkgs/nixos-26.05#mise` を timeout 600 秒で実行する。

## Why Not Fixed

flake 参照の評価は、先に nixpkgs 全体を fetch して Git cache に展開する必要があり、キャッシュがないと数分かかる。所要時間はこのリポジトリの設定ではなく、nix と回線の都合で決まる。
