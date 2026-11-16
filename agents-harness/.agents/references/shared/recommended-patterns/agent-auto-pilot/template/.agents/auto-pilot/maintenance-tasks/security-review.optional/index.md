# Security Review

コードを読んで、セキュリティの問題を探す。

## 依頼

SubAgent に次を依頼する。

「前回の実行 (`.agents/auto-pilot/maintenance-tasks/last-run.json` の `security-review` のコミット。なければリポジトリ全体) 以降の変更と、それが触れる箇所を、セキュリティの観点でレビューしてください。リポジトリ全体なら、攻撃面 (入力を受ける箇所、認証・認可、秘密情報、ファイルや外部への出入口) から読みます。サーバと Frontend の両方のコードを対象にし、入力の検証漏れ、インジェクション、パストラバーサル、クライアント側の攻撃 (XSS など)、認証・認可の抜け、秘密情報の扱い、依存の既知の脆弱性と安全でない使い方を探します。確かめられるものは、`docs/guidelines/quality-assurance/exploratory-testing.md` の手順でローカルに起動して再現を確かめます。指摘ごとに箇所、攻撃の筋道、再現できたか、重大度 (`docs/guidelines/auto-pilot.md` の基準)、直し方を返してください。秘密情報の値は書き写さず、箇所だけを示してください。コードは変更しないでください。」

## 成果物

- 公開リポジトリ (`gh repo view --json visibility`。リモートがなければ非公開) なら、指摘を公開の issue に書かない。重大・中の指摘は GitHub の draft security advisory にし、`docs/guidelines/team-channel.md` に従ってユーザーに知らせる。
- 非公開のリポジトリなら、指摘を `docs/guidelines/backlog.md` に従って Backlog に起票し、重大なものは `docs/guidelines/team-channel.md` に従ってユーザーにも知らせる。
- 指摘がなければ何も起票しない。
