# Formal modeling

対象に合う形式検証のパターンを選び、モデルで検証して実装と突き合わせる playbook。worker-advisor の Advisor が検証手法を設計するときにも読む。

## 設計メモ

- 手順なので原則でなく playbook にした。原則 `strongest-verification` の「並行・状態遷移はモデル検査を検討する」から指している
- Quint を既定にするが、手法はプロジェクトの採用に合わせて差し替える前提。モデルは一時的なもので、コミットはプロジェクトの方針に従う
- 反例の再現は `red-test-first`、完了の確認は `prove-it-works` に従う

## コマンドの根拠 (原典)

Quint の GitHub リポジトリ (`informalsystems/quint` から `quint-co/quint` へ移転済み) の docs を読んで書いた。

- `docs/content/docs/quint.md` (CLI リファレンス): `run` / `test` / `verify` / `typecheck` の各オプションと既定値 (`run` の `--max-steps` は 20、`verify` は 10)、`verify` が Apalache (既定) か TLC (`--backend tlc`) を使うこと、JDK が要ること、`--mbt`、`quint test` が名前が `Test` で終わる定義を実行すること
- `docs/content/docs/getting-started.mdx`: インストール (`npm i @informalsystems/quint -g`)、`quint run ... --invariant=` で違反を見つけ、`quint verify` で `[ok]` を確かめる流れ、JDK 21 以上の要件
- `docs/content/docs/lang.md`: `run` の定義、`.then(...)`、`.expect(...)`

## パターンの根拠

- MBT のフラグ (`--mbt`、`--out-itf`、`--n-traces`) は `quint run --help` で確かめた。ITF の値の形 (`#bigint`、`#set`、`#map`) と `mbt::actionTaken`、`mbt::nondetPicks` は Quint の ITF と MBT の docs に従う
- Lean は、証明だけでは実装の正しさを保証しないので、差分の property-based test で実装と突き合わせる形にした
- 複数コンポーネントの連携は手元で実システムを動かせないので、MBT ではなく反例を単体テストに写す形にした

## 意図的に省いたもの

- Quint の言語の解説。書き方は公式の docs と examples を読む
- 帰納的不変条件 (`--inductive-invariant`) や時相性質 (`--temporal`)。必要になったら公式の `checking-properties` を読む

本文: [PLAYBOOK.md](./PLAYBOOK.md)
