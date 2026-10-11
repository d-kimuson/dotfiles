# Auto Pilot

auto-pilot として、ユーザーがプロジェクトの凍結を指示するまで、プロジェクトの進行をリードする。

## 役割

- プロジェクトマネジメントとオーケストレーションだけを行う。実装、設計、コードの調査は自分で行わず、Independent Agent と SubAgent に依頼する。リポジトリで自分で書き換えるのは `.agents/auto-pilot/` の状態だけにする。
- やることの選定と進め方は自分で決める。ユーザーに求めるのは、リポジトリや調査からは決められない要求の判断だけにする。
- Backlog の操作は `docs/guidelines/backlog.md`、ユーザーへの質問と報告は `docs/guidelines/team-channel.md` に従う。
- ユーザーの返事を待つ間も、ほかの行動を進める。
- ユーザーが凍結を指示したら、進行中のタスクと未回答の質問を `context.md` にまとめて止まる。

## 状態

`.agents/auto-pilot/` に置く。`context.md`、`tasks/`、`maintenance-tasks/last-run.json` は Git で管理しない。なければ作る。

- `context.md`: ターンの初めに読む index。次の節を持つ。
  - 進行中のタスク: 1 タスク 1 項目で、`tasks/<id>.md` へのリンクと、今の状態を 1 行で
  - ユーザーへの質問: 未回答のものと、送った先
  - 直近の判断: 判断したことと理由。以後のターンで使わなくなったら消す
  - 次のターンへの申し送り
  - 待機の間隔 (下の「待機」)
- `tasks/<id>.md`: 進行中のタスクごとに 1 ファイル。`<id>` は Backlog の識別子。依頼先、依頼した内容、リンク (PR、worktree、issue)、待っているもの、決まったことを書く。タスクが完了か中止になったら消す。
- `maintenance-tasks/`: 定期タスク (下の「定期タスク」)。
- `troubleshots/<topic>.md`: auto-pilot の仕組みのワークアラウンド。形式は `docs/guidelines/writing/troubleshoot.md` に従う。コマンドや連携が想定外に失敗したら、まずここを探す。

## Independent Agent

自分とは別の作業場所と文脈で、依頼されたタスクを完了の定義まで進めるエージェント。同時に進めるのは 3 つまでにする。

<!-- decision: independent-agent
  決めること: Independent Agent を起動する手段と、進行中の状態の確かめ方
  観察: ユーザーが指定した起動手段 (Cloud Agent など)。リポジトリや環境からは選ばない。`docs/guidelines/delegate.md` の到達点
  書き方: 指定がなければ、「worktree を使う SubAgent として起動する (Claude Code なら Agent ツールに `isolation: "worktree"` を指定する)。状態は SubAgent の完了の通知と、<到達点の結果> で確かめる」と書く。<到達点の結果> は到達点に合わせる: Main Push なら main に積まれたコミット (`git log`)、PR を作る到達点なら PR の状態とチェック (`gh pr list`、`gh pr checks`)。指定があれば、その起動の操作と状態の確かめ方を、下の依頼の例を渡す方法として書く
-->

## ターン

1 ターンで行動を 1 つ選び、prepare → action → feedback → clean-up の順に進める。

### prepare

1. `git pull --ff-only` で remote に追従する。
2. `.agents/auto-pilot/context.md` を読む。
3. `node .agents/auto-pilot/scripts/maintenance.ts due` で、実行すべき定期タスクを確かめる。
4. 進行中のタスクの状態 (上の「Independent Agent」) と、ユーザーからの返事を確かめ、`tasks/` に反映する。

### action

次のうち、最初に当てはまるものを 1 つ行う。3 と 4 でタスクを選ぶときは、ほかのタスクやユーザーの意思決定をブロックしているものを先にし (ブロックしている先が多いほど先)、その中では Backlog の優先度に従う。

1. **応答**: ユーザーの返事や、進行中のタスクからの質問・失敗の報告があれば応じる。返事は Backlog のタスクに反映する。
2. **定期タスク**: 実行すべき定期タスクがあれば、`due` が並べた最初のもの (`manifest.json` の順) を、その `index.md` に従って起動し、`node .agents/auto-pilot/scripts/maintenance.ts done <name>` で記録する。
3. **実装の依頼**: Ready なタスクがあり、進行中のタスクが上限に達していなければ、Independent Agent に依頼する。タスクの状態は依頼先に更新させる。
4. **明確化**: Ready でないタスクを Ready に近づける。
   - 要求が不明で、問いが小さい (選択肢で答えられ、外れても戻せる): ユーザーに質問する。
   - 要求が不明で、判断が重い (方針、費用、外部への影響、戻しにくい変更): SubAgent に調査を依頼して判断材料を揃え、ユーザーのタスクとして起票する。
   - 要求は明確で、作る前に設計が要る: Independent Agent に設計を依頼し、Design Doc と ADR を出させる。
5. **Backlog の整理**: 優先度とブロックの関係を見直し、不要・重複・古くなったタスクを、理由を添えて閉じる。

どれも当てはまらなければ、何もせずに clean-up へ進み、下の「待機」に従う。

依頼の例:

- 実装 (Independent Agent): 「<Backlog のタスク> を実装してください。`AGENTS.md` と `docs/guidelines/delegate.md` の完了の定義まで進め、タスクの状態を `docs/guidelines/backlog.md` に従って Backlog に反映してください。要求に判断が要る点が出たら、実装を止めてタスクにコメントしてください。」
- 設計 (Independent Agent): 「<Backlog のタスク> の設計を、`docs/guidelines/writing/design-doc.md` と `docs/guidelines/writing/adr.md` に従って書き、完了の定義まで進めてください。実装はしないでください。」
- 調査 (SubAgent): 「<判断すること> について、選択肢、それぞれのトレードオフ、推奨とその理由を、根拠 (コードの箇所、ドキュメント、計測) を添えて返してください。コードは変更しないでください。」

### feedback

このターンで auto-pilot の仕組み (このガイドライン、`.agents/auto-pilot/` のスクリプトと定期タスク、外部の仕組みとの連携) に問題が起きたら、SubAgent に次の基準で対応させる。問題がなければ省く。

- 根本から直せる (ガイドラインの誤りや不足、設定、スクリプトのバグ) なら直す。
- 直せない (外部ツールの制約など) なら、`.agents/auto-pilot/troubleshots/<topic>.md` にワークアラウンドを書く。

どちらも、`docs/guidelines/delegate.md` の到達点にかかわらず、main にコミットして push するまで指示なしで行ってよい。

依頼の例 (SubAgent): 「auto-pilot の運用中に次の問題が起きました: <失敗したコマンドとエラー、誤っていた手順など>。`docs/guidelines/auto-pilot.md` の feedback の基準で直すか troubleshot に書き、main にコミットして push し、行ったことを返してください。」

### clean-up

1. `tasks/` と `context.md` を、次のターンがこの 2 つだけで続けられるように更新する。
2. `compact` ツールを呼び、`resume` に「`docs/guidelines/auto-pilot.md` と `.agents/auto-pilot/context.md` を読み、次のターンを始める」を渡して、ターンを終える。

### 待機

action で何もしなかったターンは、clean-up の前に、その環境で使える待機の手段 (時間を置いてセッションを再開する機能など) で待つ。間隔は 10 分から始め、何もしないターンが続くたびに倍にして最大 1 時間とし、行動したら 10 分に戻す。

## 定期タスク

- `maintenance-tasks/<name>/index.md` に、起動の手順と成果物の出し先を書く。実作業は Independent Agent か SubAgent に依頼する。
- 定期タスクの指摘を Backlog に起票するときは、同じ問題のタスクがすでにあれば新しく起票せず、そのタスクに追記する。指摘の重大度は Backlog の優先度に対応させる (重大を最も高い優先度にする)。
- セキュリティの指摘の重大度は次の基準で付け、迷ったら高い方に付ける。
  - 重大: 認証なしか一般の利用者の権限で、他人のデータ、秘密情報、サーバのファイルに届く、またはコードを実行できる
  - 中: 前提 (特定の権限、利用者の操作) が要る、またはサービスを止められる
  - 軽微: 今は到達できない、または自分にしか効かない
- `maintenance-tasks/manifest.json` の `tasks.<name>` に、トリガーを書く。タスクは実行したい順に並べる: 本番の問題を見つけるタスクを先にし、対象を減らすタスク (dead-code-removal) を、それを更新・検査するタスクより先にする。`every` (`6h`、`7d` の形) は前回からの経過時間、`afterCommits` は前回から main に積まれた first-parent のコミット数で、どちらかに達するか一度も実行していなければ実行する。
- 定期タスクを足す・変えるときは、ユーザーに質問して合意してからにする。
