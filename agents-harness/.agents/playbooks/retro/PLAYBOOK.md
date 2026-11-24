---
name: retro
description: 過去のセッションログを振り返り、ハーネスへの改善と本人の学習項目を見つけるときに使う
---

# retro

前回の retro 以降のセッションログから改善の機会を探し、Gap Report にして本人に選ばせる。選ばれたものだけを反映する。

1. `node ~/.agents/playbooks/retro/scripts/sessions.ts > <scratchpad>/sessions.md` で、Claude Code・Codex・Pi・Command Code のログから本人の発言を抽出する。既定の期間は前回の retro 以降 (初回は 2 週間)。引数で期間の指定があれば `--since <ISO 8601>` を付ける。
2. 改善の機会を探す。出力が大きければ、セッションごとに分けて SubAgent に読ませ、根拠の発言とログのパスを付けて返させる。

   | 種類 | 兆候 |
   | --- | --- |
   | 期待値 Gap | 本人が Agent を訂正した、同じ指示を繰り返した、中断した、やり直させた |
   | スキル不足 | 本人の判断が後で覆った、基礎的な質問をした、Agent の説明を鵜呑みにして進めた |

   どちらも 1 回だけの出来事より、複数のセッションで繰り返すものを先に挙げる。

3. Gap Report を dev-process-kit のページ (plain view) にして本人に渡す。1 項目は「起きたこと」「根拠の発言とログのパス」「提案」の 3 点。期待値 Gap の提案は User Scope Harness (`~/.agents` の実体) のどのファイルをどう変えるか、スキル不足の提案は学ぶトピック。項目ごとに grill の問い (採用 / 不採用) を付ける。
4. 採用された項目を反映する。
   - 期待値 Gap: `~/.agents/guidelines/harness.md` に従って User Scope Harness を直す。
   - スキル不足: `~/.agents/playbooks/personal-task-board/PLAYBOOK.md` に従い、`learning-backlog` 列に `学習` タグで積む。description に根拠の発言とログのパスを書く。
5. `node ~/.agents/playbooks/retro/scripts/sessions.ts --mark` で今回の実行を記録する。
