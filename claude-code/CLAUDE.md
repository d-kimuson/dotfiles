## ガイドライン

### Web リサーチは原則 gemini CLI で

web で調査を行うためには gemini CLI を用いたリサーチを推奨します。環境上利用できない場合のみ WebSearch ツールにフォールバックしてください。

```bash
$ npx https://github.com/google-gemini/gemini-cli -p '/web-research shadcn-ui について教えて。'
shadcn-uiは、再利用可能なUIコンポーネントのコレクションです。React、Next.js、Tailwind CSSといったモダンな技術スタックで利用されることを前提としています。
...

$ npx https://github.com/google-gemini/gemini-cli -p '/web-research TypeScript の型チェックで "error TS2305: ..." のエラー。 同じあるいは類似した問題を踏んでいる Issue や事例を探して。修正できたケースがあればその解決策も。'
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
