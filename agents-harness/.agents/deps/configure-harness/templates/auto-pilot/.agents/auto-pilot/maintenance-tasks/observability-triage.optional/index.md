# Observability Triage

本番の監視の情報から、不具合と改善のタスクを見つける。

## 依頼

SubAgent に次を依頼する。

「下の情報源で、前回の実行 (`.agents/auto-pilot/maintenance-tasks/last-run.json` の `observability-triage`。なければ直近 7 日) からの期間を、その前の同じ長さの期間と比べてください。エラーの種類ごとの件数と、エンドポイントごとのエラー率とレイテンシ (p50、p95) を比べ、新しいエラー、増えたエラー、レイテンシやエラー率の悪化、リソースの逼迫を探します。問題ごとに、根拠 (件数、時刻、ログやトレースへのリンク)、影響の範囲、推定される原因の箇所を返してください。情報源にデータがない観点は、推測で埋めずに「観察できない」と返してください。本番の環境と設定は変更しないでください。」

<!-- decision: observability-sources
  決めること: 見る監視の情報源 (エラー監視、ログ、メトリクス、トレース) と、使える手段
  観察: 使っている監視の仕組み (Sentry、Datadog、Cloudflare の Observability など) の設定と SDK、使える連携 (MCP、CLI)。ユーザーに聞く: 本番の環境の名前
  書き方: 情報源ごとに、名前、手段 (MCP のツール名、CLI、定期的に書き出すファイル)、対象の環境を 1 項目で書く
-->

## 成果物

- 問題を、`docs/guidelines/backlog.md` に従って Backlog に起票する。利用者に影響が出ているものは、`docs/guidelines/team-channel.md` に従ってユーザーにも知らせる。
