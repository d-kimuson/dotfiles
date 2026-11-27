# agent-core

`agent-core.ts` は Node の type stripping で動く、依存のない CLI。実装は `agent-core/`、テストは `*.test.ts`。

```sh
node .agents/scripts/agent-core.ts --root . <command>   # 開発中。本番は ~/.agents/scripts/agent-core.ts
node --test .agents/scripts
node_modules/.bin/tsc -p . --noEmit
```

## models list

`models list [<kind>] [--json]` は `config/models.json` の候補を、`state/providers.json` で絞って出す。

- `config/models.json`: 作業の種類ごとの候補 (`<runtime>:<model>:<effort>`、優先順)。コミットする。`verify` が必須にする
- `state/providers.json`: このマシンで使える provider。マシン固有のローカルファイルで、コミットしない。`{ "providers": ["claude-code", "openai-codex"] }` の形で、値は `claude-code | opencode-go | openai-codex | command-code | antigravity`。`models list` と同じく `--root` の harness dir 配下 (`<root>/.agents/state/providers.json`) を読む
- 候補の provider は `agent-core/providers.ts` の `providerOfCandidate` が決める。runtime が `claude-code` / `command-code` / `antigravity` ならそのまま、`pi` なら model の最初の `/` より前 (`opencode-go` → `opencode-go`、`openai-codex` → `openai-codex`)。決まらない候補は `verify` がエラーにする
- 許可された provider の候補だけを優先順のまま残し、番号は残った候補で振り直す。候補がすべて外れた種類も残し、text は「候補なし」、JSON は `candidates: []` になる (呼び出し側は親と同じモデルで代替する)
- `state/providers.json` がなければ exit 1。旧パス (`<root>/.agents/providers.json`) にファイルがあれば移動コマンドを、なければ期待するパスと `playbooks use 'configure-providers'` を stderr に出す。不正なら exit 1 でパースエラーを出す

## principles と playbooks use

`principles list` / `principles search <query>` / `principles use <name>` は `playbooks` と同じ実装 (`commands/collection.ts`、`content.ts` の `CONTENT_SPECS`) を使う。`principles/<name>/PRINCIPLE.md` と `README.md` を持つ。

- PLAYBOOK.md の frontmatter に `principles: [a, b]` (または `- a` の行のリスト) で推奨する principle を書く。順序が出力の順序になる。名前は kebab-case で、重複と、リストでない値 (`principles: a`、値なしの `principles:`) はエラー。キーがなければ principle なし。`principles: []` は空のリスト
- `playbooks use <name>` (と `prompt <playbook>`) は、Playbook 本文の後ろに `---` と `# 推奨される原則` の見出しを置き、各 principle の全文を `<principle name="...">` から `</principle>` で囲んで列挙順に続ける。principle がない Playbook は本文のまま。`--json` の `body` は Playbook 本文のままで、`principles` に `{ name, path, body }` の配列を持つ。`--with-frontmatter` は元ファイルだけを出す
- 参照先がなければ、何も出力せず exit 1 (`principles/<name>` が見つからないと stderr に出す)
- 実装は `agent-core/principles.ts` (`readPrincipleRefs` / `loadPlaybookPrinciples` / `renderPlaybookWithPrinciples`)。frontmatter のリストは `frontmatter.ts` の `readStringList` が厳密に読む。パーサは、値のあるキーに続くリスト項目とキーの重複もエラーにする

## verify

`verify` は `config/models.json` を必須にする (なければエラー)。`state/providers.json` は必須にせず、なくてもエラーにも警告にもしない。あれば書式だけを検証してエラーを報告する。

`verify` は `principles/` も playbooks と同じ基準 (`PRINCIPLE.md`・`README.md`・frontmatter) で検証し、さらに Playbook の `principles` を静的に検査する。書式が不正なら `invalid-principles`、存在しない principle (`principles/<name>/PRINCIPLE.md` がない) を指していれば `unknown-principle` で、どちらもエラー。

## export

`export --to <dir> [--profile <name>]` は、配布元 (`--root` で解決した `.agents`) の Git 追跡ファイルを `<dir>/.agents` へコピーする。通常マシンは chezmoi の symlink で配布するので、コピーが要る使い捨て環境 (Claude Code on the web) でだけ使う。

- 配る集合は `git -C <配布元> ls-files` の追跡ファイル。`.gitignore` の対象 (マシン固有ファイル、`skills/synced` など) は自動的に外れる。実行時に Git を呼ぶので、除外リストを `.gitignore` と二重管理しない
- `--profile <name>` は `agent-core/export.ts` の `EXPORT_PROFILES` の定数。`claude-code-web` は `skills/orca-cli`、`skills/orca-computer-use`、`references/agent-call-over-cli.md`、`.skill-lock.json` を除外し、`state/providers.json` に `{ "providers": ["claude-code"] }` を書く。正本は 1 つのままで、中身は書き換えない
- 除外パスが追跡ファイルに 1 件も一致しなければ stderr に警告を出して続ける。正本から skill を外しただけでセットアップが止まらないようにするため
- `<dir>/.agents` が既にある (symlink を含む) ときは、削除も上書きもせずに exit 1。更新するときは呼び出し側が先に削除する
- 一時ディレクトリにコピーしてから rename するので、途中で失敗しても配布先の親に `.agents` や残骸を残さない
