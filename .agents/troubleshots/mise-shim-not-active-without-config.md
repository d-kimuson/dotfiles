# mise の shim が「not currently active」で実行できない

## Symptom

mise でインストール済みでも、どの mise config にも書かれていないツール (例: `actionlint`) を shim 経由で実行すると、バージョンが決まらず失敗する (mise 2026.10.17、macOS で確認)。

```
mise ERROR actionlint is a mise bin however it is not currently active. Use `mise use` to activate it in this directory.
```

別のプロジェクトで `mise use` したツールの shim が `~/.local/share/mise/shims/` に残っており、そのプロジェクトの外で実行した場合に起こる。

## Workaround

インストール済みのバージョンを指定して `mise exec` で実行する。config は変えない。

```sh
ls ~/.local/share/mise/installs/actionlint   # インストール済みのバージョンを確かめる
mise exec actionlint@1.7.12 -- actionlint
```

`mise use` はカレントディレクトリやグローバルの config を書き換えるため、一時的な実行には使わない。

## Why Not Fixed

マシンに常に入れるツールにするかは判断が必要で (`docs/tool-management.md`)、まだ決めていない。shim がアクティブなバージョンを要求するのは mise の挙動である。
