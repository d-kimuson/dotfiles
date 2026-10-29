# 侵害痕跡の調査

端末に見覚えのない挙動 (身に覚えのない通信、勝手な設定変更、CLI の勝手な更新) があったときに、侵害の痕跡を調べる手順。
調査は読み取りとコピーだけで進め、対象のファイルを書き換えない。見つけたものはパスと時刻を控える。

## 1. 導入済みの CLI が公開 tarball と一致するか

`chezmoi/private_dot_config/mise/config.toml` の `npm:` エントリを 1 つずつ、レジストリの tarball と突き合わせる。
差分が出たパッケージは、改変されているか、同名の別物が動いている。

```sh
pkg='@openai/codex'
ver='0.163.0'
installed=$(mise where "npm:$pkg@$ver")
tmp=$(mktemp -d)
(cd "$tmp" && npm pack "$pkg@$ver" --silent >/dev/null && tar xzf ./*.tgz)
diff -r "$tmp/package" "$installed/node_modules/$pkg"
```

mise の外 (`~/.npm-global`、`~/.pi/agent/npm-global`、mise の node prefix) に同じ CLI が入っていないかも見る。
CLI の自己更新はここに入り、mise の管理をシャドウする (`docs/tool-management.md`)。
この重複は次のコマンドで一覧できる。

```sh
node internal/src/cli.ts npm-shadowing check
```

## 2. 常駐プロセス

```sh
ls -la ~/Library/LaunchAgents /Library/LaunchAgents /Library/LaunchDaemons
launchctl list
```

home-manager と Nix、ベンダーの更新系以外の plist があれば、`ProgramArguments` の実行ファイルを確認する。

## 3. 通信先の IP とドメイン

設定とスクリプトのテキストだけを走査する。SVG のパスデータや minify されたバンドルは `12.34.56.78` のような IP に似た文字列を含むため、拡張子で除外する。
それでも残る一致は候補でしかないので、1 件ずつ出所を確認する。

```sh
python3 -I - "$HOME/.config" "$HOME/.local/bin" <<'PY'
import ipaddress, pathlib, re, sys

skip = {".svg", ".map", ".png", ".jpg", ".jpeg", ".gif", ".woff", ".woff2", ".ico"}
addr = re.compile(r"(?<![\d.])\d{1,3}(?:\.\d{1,3}){3}(?![\d.])")

for root in map(pathlib.Path, sys.argv[1:]):
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix in skip or path.stat().st_size > 1_000_000:
            continue
        try:
            text = path.read_text(errors="ignore")
        except OSError:
            continue
        for m in addr.finditer(text):
            try:
                found = ipaddress.ip_address(m.group())
            except ValueError:
                continue
            if found.is_global:
                print(f"{path}: {m.group()}")
PY
```

ドメインは同じ対象から一覧にして、見覚えのないものを拾う。

```sh
grep -rIohE 'https?://[a-zA-Z0-9.-]+' "$HOME/.config" | sort -u
```

## 4. ブラウザ履歴

Chrome は起動中に履歴 DB をロックするため、`.agents/troubleshots/chrome-history-database-locked.md` の手順でコピーしてから `urls` を新しい順に読む。
落としたファイル、拡張機能、入力した秘密情報の有無も履歴から辿る。

## 5. 設定ファイルの改変

`chezmoi diff` で `$HOME` が source state からずれていないか確認する。
差分に出たファイルと、管理外の rc・git hook・cron・LaunchAgents の中身を読む。
