# Review

変更をレビューするときの観点の正本。内部レビュー (`docs/guidelines/delegate.md`) も、AI レビューツールも、これに従う。ツール向けのファイルには、このファイルへの参照だけを書く。

## 共通

- レビューの対象 (PR、ブランチ、コミットの範囲、作業ツリー) と出力の形式 (PR コメント、レポートなど) は、呼び出す側に従う。
- 指摘する前に周辺のコードやドキュメントを読み、本当に問題かを確かめる。
- Lint・型検査・テストが強制するルールは指摘しない。機械的に検査される。

## パターン

変更の中身から、行うパターンを選ぶ。

| パターン | 行う条件 |
| --- | --- |
| `Code Review` | コードを変更した。ドキュメントだけの変更なら行わない |
| `Guideline Review` | 常に |
| `Docs Review` | ドキュメント (`docs/`、`AGENTS.md`、skills、prompts、troubleshots) を変更した |
| `Quality Assurance` | プロダクトの振る舞いを変更した |
| `Secret Review` | `config/`、`shell/env-secrets.sh.tpl`、`chezmoi/` のテンプレート (`*.tmpl`)、internal-cli の出力 (dry-run、ログ、エラー) のいずれかを変更した |

### Code Review

変更そのものの欠陥を見る: 誤った振る舞い、境界の漏れ、エラー処理の抜け、実行順序や並行性の問題、セキュリティの問題、責務の混在などの設計の問題。ガイドラインへの準拠は `Guideline Review` に任せる。

### Guideline Review

1. AGENTS.md の References から、「いつ読むか」が変更に当てはまるガイドラインをすべて選ぶ。
2. 選んだガイドラインを全文読む。
3. 変更がガイドラインに違反している箇所を指摘する。`docs/guidelines/writing/` は `Docs Review` に任せる。

### Docs Review

1. `docs/guidelines/writing/index.md` を全文読む。
2. 変更したドキュメントごとに、それを扱う文書タイプ別のガイド (`docs/guidelines/writing/`) を読む。どのガイドも扱わないドキュメントは `index.md` だけで見る。
3. 変更したドキュメントは差分だけでなく全文を読む。論旨が 1 つか、繰り返していないかは全体で決まる。
4. 違反している箇所を、該当する文と破っているルールを引用して指摘する。

### Quality Assurance

1. `docs/guidelines/quality-assurance/index.md` と、AGENTS.md の References で変更に当てはまる `docs/guidelines/quality-assurance/` のガイドを読む。
2. ガイドの手順で実際に動かして確かめ、ガイドの形式で結果を報告する。
3. 当てはまるガイドがなければ、そう報告して終える。

### Secret Review

秘密情報の値がリポジトリや出力に漏れないかを見る。

1. 1Password の参照 (`op://…`) 以外の秘密情報の値 (API キー、トークン、MCP の env や headers の値) をコミットしていない。
2. dry-run、ログ、エラーメッセージに設定の値を出していない。dry-run の差分表示は `internal/src/dry-run/describe-changes.ts` を通し、変わるキーパスだけを出す。
