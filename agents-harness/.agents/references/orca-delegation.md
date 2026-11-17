# Orca で別 harness の worker に委譲する

候補 `<runtime>:<model>:<effort>` の runtime が親と違うときに使う。

## 前提

- `orca` はパイプ・リダイレクト・`cd`・`$'...'` を付けずに単独で実行する (付けると sandbox の除外から外れて失敗する)
- `--worktree path:<dir>` の `<dir>` は Orca に登録済みの repo に限る
- 親が Orca の terminal 内で動いている (`ORCA_TERMINAL_HANDLE` がある)。無ければ Orca は使えない
- ここにないコマンドやフラグが要るとき、またはコマンドが想定外に失敗したときは、`orca skills get orchestration` でインストール済みの Orca に合った手順書を読む

## 起動コマンド

| runtime | 起動コマンド |
| --- | --- |
| claude-code | `claude --model <model> --effort <effort> --dangerously-skip-permissions` |
| pi | `pi --model <model> --thinking <effort>` |
| command-code | `command-code --trust --yolo --model <model> --effort <effort>` |

- `<model>` は候補の model をそのまま渡す (例: `openai-codex/gpt-6-luna`、`deepseek/deepseek-v4.1-flash`)
- effort の `none` は pi と command-code では `off` と書く。command-code の deepseek に無い `medium` / `xhigh` は近い値 (`high` / `max`) に読み替える

## 手順

```sh
# 1. Run を作る (セッションで一度だけ)
orca orchestration run-create --objective "<目的>" --json
# 2. terminal を作り (result.terminal.handle を <T> とする)、起動コマンドを送る。wait が satisfied: true になってから次へ
orca terminal create --worktree path:<dir> --title "<名前>" --json
orca terminal send --terminal <T> --text '<起動コマンド>' --enter --json
orca terminal wait --terminal <T> --for tui-idle --timeout-ms 60000 --json
# 3. 作業を渡す
orca orchestration worker-start --terminal <T> --worktree path:<dir> --spec "<spec>" --json
# 4. バックグラウンドで待つ (長く待つので、待ちをバックグラウンドで実行できるならそうする)
orca orchestration check --wait --types worker_done,question,escalation --timeout-ms 900000 --json
# 5. 受け取ったメッセージを ack し、terminal を閉じる
orca orchestration check --ack <deliveryId> --json
orca terminal close --terminal <T> --json
```

- 3 の後に `orca terminal read --terminal <T> --json` で spec が入力されたかを見る。command-code は Taste の画面 (`Press Enter to continue`) が割り込み、spec が消えることがある。その場合は `orca terminal send --terminal <T> --enter --json` で閉じ、`worker-abandon` してから 3 をやり直す
- 4 の結果ごとの対応
  - `timedOut: true`: 同じコマンドで待ち直す
  - `question`: `orca orchestration reply --id <message_id> --body "<回答>" --json` で答えて待ち直す
  - `worker_done`: `payload.outcome` が `succeeded` かを見たうえで、成果物 (ファイル・diff) を自分で確かめる
- spec には対象・変更・制約・完了条件を書く。完了の報告方法は Orca が worker に伝えるので書かない。報告の本文にバッククォートを使わせない (送信時に欠ける)
- 複数の worker は全員を `worker-start` してから、1 つの `check --wait` ループで受ける。書き込む worker どうしは worktree か編集範囲を分ける
- `tui-idle` にならないときは `orca terminal read --terminal <T> --json` で画面を見る。`blockedReason` が `agent-trust-workspace` なら claude のフォルダ信頼ダイアログで、既定は `No, exit`。`--text 'j'` を送って `Yes, I trust this folder` に移し、別の `send` で `--enter` を送る (番号キーは効かず、先に Enter を送ると claude が終了する)
- worker が止まらなくなったら `orca orchestration worker-abandon --dispatch <dispatchId> --json` の後に `terminal close` する
