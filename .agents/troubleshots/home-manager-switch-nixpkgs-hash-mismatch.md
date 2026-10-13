# nixos-unstable の破損 revision で home-manager switch が hash mismatch で失敗する

## Symptom

`~/.config/home-manager/flake.lock` が追跡する `nixpkgs` (nixos-unstable) のある revision で、個別パッケージのソース hash が壊れていることがあり、`home-manager switch` が fixed-output derivation の hash mismatch で失敗する。
例: rev `7fd4004` で `typescript-language-server` 6.0.2 がこれで失敗した。

```
error: hash mismatch in fixed-output derivation '/nix/store/...-typescript-language-server-6.0.2...':
         specified: sha256-...
            got:    sha256-...
```

## Workaround

マシンローカルの `~/.config/home-manager/flake.lock` (Git 管理外) だけを、動作確認済みの別の nixpkgs revision にピン留めする。

```
nix flake lock --override-input nixpkgs github:NixOS/nixpkgs/<working-rev>
```

flake の input 自体 (`flake.nix`) は `nixos-unstable` のままなので、次に `nix flake update` すれば自動的にその時点の head に戻る。

## Why Not Fixed

nixpkgs 側の一時的な破損で、このリポジトリの設定では防げない。`nix flake update` で直るまでの暫定対応。
