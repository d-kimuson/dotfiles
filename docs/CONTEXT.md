# chezmoi dotfiles

複数のマシンで同じ開発環境を再現するための設定と、その配布の仕組み。

## Ubiquitous Language

| 用語 | コード | 定義 |
| ---- | ------ | ---- |
| source state | `chezmoi/` (`.chezmoiroot`) | chezmoi が `$HOME` へ配布するファイルの元 |
| target state | `$HOME` 以下 | source state を apply した結果 |
| 管理層 | — | chezmoi・home-manager・mise・internal CLI・nix profile の区分。ツールや設定はどれか 1 つで管理する (`docs/overview.md`) |
| 反映 | — | 変更を対象マシンに適用すること (apply、switch、install、deliver) |
| 配布 (deliver) | `mcp deliver`、`pi-agent deliver` | `config/` から各ツールの設定ファイルを生成して書き込む |
| マージ設定 | `merge-config` | ツールが書き換える既存の設定を残し、管理するキーだけを合わせる |
| dry-run | `--dry-run`、`internal/src/dry-run/describe-changes.ts` | 反映せず、変わるキーパスだけを示す |
| 秘密情報 | `shell/env-secrets.sh.tpl` | API キーなど。1Password の参照 (`op://…`) としてだけコミットする |

## Invariants

- dry-run は設定の値を出力しない (`internal/src/dry-run/describe-changes.test.ts`)
- 秘密情報の値はコミットしない (`docs/guidelines/review/index.md` の `Secret Review`)
