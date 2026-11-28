# CLI を介して別の Agent を呼ぶ

モデルの候補 `<runtime>:<model>:<effort>` の runtime がこのセッションと違う Agent を呼ぶときに使う。Orca CLI で、候補の runtime の Agent を候補の model で起動する。組み込みの手段 (サブエージェント呼び出しなど) に候補の model を指定すると、候補と違う runtime で model が動くので使わない。

このセッション自身が Orca の worker なら「Orca の worker から呼ぶ」、そうでなければ「worker でないセッションから呼ぶ」の手順を使う。

## 前提

- `orca` はパイプ・リダイレクト・`cd`・`$'...'` を付けずに単独で実行する (付けると sandbox の除外から外れて失敗する)
- `--worktree path:<dir>` の `<dir>` は Orca に登録済みの repo に限る
- このセッションが Orca の terminal 内で動いている (`ORCA_TERMINAL_HANDLE` がある)。無ければ Orca は使えないので、runtime の違う候補は呼べないものとして次の候補へ進む
- ここにないコマンドやフラグが要るとき、またはコマンドが想定外に失敗したときは、`orca skills get orchestration` でインストール済みの Orca に合った手順書を読む

## worker でないセッションから呼ぶ

### 起動コマンド

| runtime | 起動コマンド |
| --- | --- |
| claude-code | `claude --model <model> --effort <effort> --dangerously-skip-permissions` |
| pi | `pi --model <model> --thinking <effort>` |
| command-code | `command-code --trust --yolo --skip-onboarding --model <model> --effort <effort>` |
| antigravity | `agy --model <model> --effort <effort> --dangerously-skip-permissions` |

- `<model>` は候補の model をそのまま渡す (例: `openai-codex/gpt-6-luna`、`deepseek/deepseek-v4.1-flash`)
- effort の `none` は pi と command-code では `off` と書く。command-code の deepseek に無い `medium` / `xhigh` は近い値 (`high` / `max`) に読み替える
- antigravity の model は effort を除いた名前 (例: `gemini-4-neon`) を渡す。使える model と effort は `agy models` の一覧 (`<model>-<effort>`。localhost を listen するので sandbox の外で実行する) で確かめ、無い effort は近い値に読み替える (無い値はエラーで起動しない)

### 手順

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
# 5. 応答に deliveryId があれば ack し (無ければ受け取った時点で処理済み)、terminal を閉じる
orca orchestration check --ack <deliveryId> --json
orca terminal close --terminal <T> --json
```

- 4 の結果ごとの対応
  - `timedOut: true`: 同じコマンドで待ち直す
  - `question`: `orca orchestration reply --id <message_id> --body "<回答>" --json` で答えて待ち直す
  - `worker_done`: `payload.outcome` が `succeeded` かを見たうえで、成果物 (ファイル・diff) を自分で確かめる
- spec には対象・変更・制約・完了条件を書く。完了の報告方法は、呼び出した Agent へ Orca が伝えるので書かない。報告の本文にバッククォートを使わせない (送信時に欠ける)
- 複数の Agent を呼ぶときは、全員を `worker-start` してから、1 つの `check --wait` ループで受ける。書き込む Agent どうしは worktree か編集範囲を分ける
- `tui-idle` にならないときは `orca terminal read --terminal <T> --json` で画面を見る。`blockedReason` が `agent-trust-workspace` なら claude のフォルダ信頼ダイアログで、既定は `No, exit`。`--text 'j'` を送って `Yes, I trust this folder` に移し、別の `send` で `--enter` を送る (番号キーは効かず、先に Enter を送ると claude が終了する)
- 呼び出した Agent が止まらなくなったら `orca orchestration worker-abandon --dispatch <dispatchId> --json` の後に `terminal close` する

## Orca の worker から呼ぶ

worker は Run も terminal も作らない。起動する Agent とモデルを `worker-start` に直接指定し、Orca に新しい terminal で起動させる。呼び出した Agent は worker と同じ Run に入り、終わると Orca が terminal を解放する。

### worker かどうかの見分け

次の 2 つが両方当てはまれば、このセッションは Orca の worker である。

- 依頼の冒頭に Orca の preamble があり、Task ID と Dispatch ID が書かれている
- `orca orchestration worker-list` に、`terminal=` が `ORCA_TERMINAL_HANDLE` と同じで `outcome=in_progress` の行がある (例: `dispatchId=ctx_… taskId=task_… state=ready outcome=in_progress agent=pi terminal=term_…`)

### 起動と待ち

```sh
# 1. 候補の runtime と model を直接指定する。terminal は作らない
orca orchestration worker-start --agent <agent> --model <model> --effort <effort> --worktree current --spec-file <path> --json
# 2. 自分の mailbox に届く報告を待つ
orca orchestration check --wait --types "worker_done,question,escalation" --timeout-ms 900000 --json
```

- `--terminal` と `--on` は付けない。付けると `invalid_argument` になり、何も起動しない
- `--agent` は runtime ごとの Orca の agent id で、runtime の名前と同じとは限らない。`--model` と `--effort` を渡せるかも runtime ごとに違う

| runtime | `--agent` | `--model` と `--effort` |
| --- | --- | --- |
| claude-code | `claude` | 候補の model と effort を渡す |
| pi | `pi` | 候補の model と effort を渡す (Orca が effort を `--thinking` に渡す) |
| command-code | `command-code` | 渡さない。`~/.commandcode/config.json` の model と effort で起動するので、候補の model と effort が設定と一致するときだけ呼ぶ |
| antigravity | `antigravity` | 候補の model と effort を渡す |

- 表に無い runtime は、`--agent` の値を `orca agent installed` の一覧で、`--model` の可否を `orca orchestration worker-start --help` の Notes で確かめる
- 候補の model と effort で起動できない runtime の候補は呼ばず、次の候補へ進む
- 2 の結果ごとの対応と spec の書き方は「worker でないセッションから呼ぶ」の手順と同じ。ただし `check` は自分の mailbox (`dispatch:<自分の Dispatch ID>`) を読み、返した batch をその場で処理済みにするので `--ack` は要らない。終わった Agent の terminal は Orca が解放するので `terminal close` を呼ばない
- 起動した Agent が止まらなくなったら `orca orchestration worker-abandon --dispatch <dispatchId> --json` で止める
