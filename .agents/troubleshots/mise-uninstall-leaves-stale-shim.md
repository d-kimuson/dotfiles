# mise uninstall と mise reshim の後も削除したツールの shim が残る

## Symptom

config から npm CLI を外し、`mise uninstall npm:@github/copilot@1.0.102` と `mise reshim` を実行しても、`~/.local/share/mise/shims/copilot` が残る。
その shim を実行すると次のエラーになる (mise 2026.10.17、macOS で確認)。

```
copilot is a mise bin however it is not currently active
```

`~/.local/share/mise/installs/npm-github-copilot/` に `.mise.backend` と、存在しないバージョンを指す alias の symlink (`1`、`1.0`、`latest` -> `./1.0.102`) が残っている。

## Workaround

1. `rm -rf ~/.local/share/mise/installs/<backend ディレクトリ>` で、そのツールの installs ディレクトリごと消す (例: `npm-github-copilot`)。
2. `mise reshim --force` を実行して shim を作り直す。

`mise prune` で 1 ツールだけを消す方法は使わない。どの config からも参照されていない無関係のバージョン (python、terraform、古い node など) も一緒に削除されるため。

## Why Not Fixed

`mise uninstall` が alias の symlink と `.mise.backend` を消さず、通常の `mise reshim` が shim を取り除かないのは外部ツール (mise) の挙動であり、このリポジトリ側では直せない。
