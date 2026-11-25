# agent-core

`agent-core.ts` は Node の type stripping で動く、依存のない CLI。実装は `agent-core/`、テストは `*.test.ts`。

```sh
node .agents/scripts/agent-core.ts --root . <command>   # 開発中。本番は ~/.agents/scripts/agent-core.ts
node --test .agents/scripts
node_modules/.bin/tsc -p . --noEmit
```

## models list

`models list [<kind>] [--json]` は `config/models.json` の候補を、`providers.json` で絞って出す。

- `config/models.json`: 作業の種類ごとの候補 (`<runtime>:<model>:<effort>`、優先順)。コミットする。`verify` が必須にする
- `providers.json`: このマシンで使える provider。マシン固有のローカルファイルで、コミットしない。`{ "providers": ["claude-code", "openai-codex"] }` の形で、値は `claude-code | opencode-go | openai-codex | command-code | antigravity`。`models list` と同じく `--root` の harness dir 直下 (`<root>/.agents/providers.json`) を読む
- 候補の provider は `agent-core/providers.ts` の `providerOfCandidate` が決める。runtime が `claude-code` / `command-code` / `antigravity` ならそのまま、`pi` なら model の最初の `/` より前 (`opencode-go` → `opencode-go`、`openai-codex` → `openai-codex`)。決まらない候補は `verify` がエラーにする
- 許可された provider の候補だけを優先順のまま残し、番号は残った候補で振り直す。候補がすべて外れた種類も残し、text は「候補なし」、JSON は `candidates: []` になる (呼び出し側は親と同じモデルで代替する)
- `providers.json` がなければ exit 1。期待するパスと `playbooks use 'configure-providers'` を stderr に出す。不正なら exit 1 でパースエラーを出す

## principles と roles use

`principles list` / `principles search <query>` / `principles use <name>` は `playbooks` / `roles` と同じ実装 (`commands/collection.ts`、`content.ts` の `CONTENT_SPECS`) を使う。`principles/<name>/PRINCIPLE.md` と `README.md` を持つ。

- ROLE.md の frontmatter に `principles: [a, b]` (または `- a` の行のリスト) で推奨する principle を書く。順序が出力の順序になる。名前は kebab-case で、重複と、リストでない値 (`principles: a`、値なしの `principles:`) はエラー。キーがなければ principle なし。`principles: []` は空のリスト
- `roles use <name>` (と `prompt <role>`) は、Role 本文の後ろに `---` と `# 推奨される原則` の見出しを置き、各 principle の全文を `<principle name="...">` から `</principle>` で囲んで列挙順に続ける。principle がない Role は本文のまま。`--json` の `body` は Role 本文のままで、`principles` に `{ name, path, body }` の配列を持つ。`--with-frontmatter` は元ファイルだけを出す
- 参照先がなければ、何も出力せず exit 1 (`principles/<name>` が見つからないと stderr に出す)
- 実装は `agent-core/principles.ts` (`readPrincipleRefs` / `loadRolePrinciples` / `renderRoleWithPrinciples`)。frontmatter のリストは `frontmatter.ts` の `readStringList` が厳密に読む。パーサは、値のあるキーに続くリスト項目とキーの重複もエラーにする

## verify

`verify` は `config/models.json` を必須にする (なければエラー)。`providers.json` は必須にせず、なくてもエラーにも警告にもしない。あれば書式だけを検証してエラーを報告する。

`verify` は `principles/` も playbooks / roles と同じ基準 (`PRINCIPLE.md`・`README.md`・frontmatter) で検証し、さらに Role の `principles` を静的に検査する。書式が不正なら `invalid-principles`、存在しない principle (`principles/<name>/PRINCIPLE.md` がない) を指していれば `unknown-principle` で、どちらもエラー。
