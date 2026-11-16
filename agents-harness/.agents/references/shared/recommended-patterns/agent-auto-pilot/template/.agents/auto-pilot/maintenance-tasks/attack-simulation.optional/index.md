# Attack Simulation

ローカルで起動したプロダクトを攻撃して、セキュリティの問題を探す。

## 依頼

Independent Agent に次を依頼する。

「`docs/guidelines/quality-assurance/exploratory-testing.md` の手順でプロダクトをローカルで起動し、攻撃者として攻撃してください。攻撃面は、ドキュメントではなくルーティングのコード (すべてのエンドポイント、静的ファイルの配信、Frontend が入力を描画する箇所) から洗い出します。認可の回避 (他人のリソースへのアクセス、権限の昇格)、インジェクション、パストラバーサル、SSRF、クライアント側の攻撃 (XSS、CSRF、オープンリダイレクト)、認証の弱さ (総当たり、セッションの扱い)、入力の上限を超えた要求など、そのプロダクトにある攻撃面に当てはまるものを試します。攻撃はローカルで起動したものだけに行い、本番や共有の環境、外部のサービスには行わないでください。成功した攻撃ごとに、再現の手順、影響、重大度 (`docs/guidelines/auto-pilot.md` の基準)、直し方を返してください。秘密情報の値は書き写さず、どこから読めたかだけを示してください。コードは変更しないでください。」

## 成果物

- 公開リポジトリ (`gh repo view --json visibility`。リモートがなければ非公開) なら、成功した攻撃を公開の issue に書かない。重大・中のものは GitHub の draft security advisory にし、`docs/guidelines/team-channel.md` に従ってユーザーに知らせる。
- 非公開のリポジトリなら、`docs/guidelines/backlog.md` に従って Backlog に起票し、重大なものは `docs/guidelines/team-channel.md` に従ってユーザーにも知らせる。
