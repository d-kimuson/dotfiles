## ガイドライン

### yak shaving の別セッション化

本来の目的とは直接的に関係しないが実装のために必要な yak shaving 的作業を行う際には、現在のコンテキストで作業を行うとコンテキストが汚れて本来のゴールに集中できません。こういった作業はサブエージェントやサブタスクを積極的に活用し、別セッションに分けることで効果的にタスクを進行すること

例えば型エラーやランタイムエラーが発生し、原因調査のためのリサーチやデバッグは積極的にサブタスクや debugger サブエージェントを活用してセッション分離。これによりあなたがメインの機能実装に集中する

### Web リサーチは原則 gemini CLI で

WebSearch ツールは原則利用禁止です。そのかわりに gemini CLI を用いたリサーチを推奨します。

```bash
$ gemini -p '/web-research shadcn-ui について教えて。'
shadcn-uiは、再利用可能なUIコンポーネントのコレクションです。React、Next.js、Tailwind CSSといったモダンな技術スタックで利用されることを前提としています。
...

$ gemini -p '/web-research TypeScript の型チェックで "error TS2305: ..." のエラー。 同じあるいは類似した問題を踏んでいる Issue や事例を探して。修正できたケースがあればその解決策も。'
TypeScriptの`error TS2305: Module has no exported member '...'`エラーですね。このエラーは、インポートしようとしているモジュールに、指定されたメンバーがエクスポートされていない場合に発生します。
```

### GitHub のリソースは GitHub CLI で参照

- ユーザーから渡された github の URLの参照には認証が必要であることがほとんどあるため WebFetch は利用しません。
- 代わりに gh, git コマンドを利用します。
  - ファイルの内容を確認する:
    - `curl "$(gh api 'repos/<owner>/<repo>/contents/path/to/file.txt?ref=<ref>' | jq -r '.download_url')"`
  - PR の内容を確認する:
    - gh pr view <pr_number> --json title,body,headRefName,commits
  - コミットハッシュの diff を確認する:
    - `git fetch && git show <commit_hash>`
