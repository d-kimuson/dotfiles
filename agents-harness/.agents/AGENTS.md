# AGENTS.md (User)

## Communication and Language

- User communication: Japanese (日本語)
- Documentation and code comments: Preserve the existing language; do not translate them.

## Harness

構成されたユーザー定義ハーネスに従う。agent-core CLI (`~/.agents/scripts/agent-core.ts`) と Role/Playbook のプロンプトを活用し、タスクを実施する。

### Role

- Role は ~/.agents/roles/${name}/ROLE.md として定義される
- セッションごとに事前定義された単一の Role を適用し、その原則にしたがって行動する
- 指定されていない場合は `~/.agents/scripts/agent-core.ts roles list` で Role の一覧を取得し、description から今回のユーザー要求を満たすのに最も適した Role をただ1つ選択して `~/.agents/scripts/agent-core.ts roles use 'product-engineer'` のように取得し、原則を遵守する
- `roles use` は Role 本文の後ろに、その Role が推奨する principle (`~/.agents/principles/${name}/PRINCIPLE.md`) の全文も返す。状況に応じて他の原則が必要なときは `~/.agents/scripts/agent-core.ts principles search <query>` で探し、`principles use '<name>'` で取得する

### Playbook

- Playbook は ~/.agents/playbooks/${name}/PLAYBOOK.md として定義された、再現性のある一連の手順
- `~/.agents/scripts/agent-core.ts playbooks list` で一覧を取得する (`playbooks search <query>` で全文検索も可)。description から今回のユーザー要求に合うものがあれば、`~/.agents/scripts/agent-core.ts playbooks use 'initialize-project'` のように本文を取得し、手順に従う
- 合う Playbook が無ければ使わずに進めてよい

### SubAgent Delegation

- SubAgent をタスクの本筋に集中するために利用する
- Agent (あなた) の Context は限られたリソースであり、Yak-shaving 的作業を SubAgent に適切に移譲することで本筋の作業に集中する
- SubAgent 呼び出し時は下記の情報を提示して呼び出す:
  - 期待する Role
  - SubAgent に実施させたい作業の完了条件
  - やらないことの明示
  - (Optional) 実施してほしい Playbook
- 使うモデルは、作業の種類を 1 つ選び、次の手順で決める
  1. `~/.agents/scripts/agent-core.ts models list worker|judge|arbiter|scout` で利用すべきモデルのリストを取得
  2. 上から有効なものを選択し、失敗した場合に下位のモデルにフォールバックする。このセッションと同一の harness の場合は組み込まれたサブエージェント呼び出しを行う。別ハーネスの場合は `~/.agents/references/orca-delegation.md` を参考に Orca CLI を用いる。いずれも利用できない場合は自信と同一モデルの SubAgent で代用する
- 別系統のセカンドオピニオンがほしいときは、1 番目とは runtime やモデル系統の違う候補を使う

### Other CLI Usage

```bash
~/.agents/scripts/agent-core.ts --help
```

## 行動原則

- 承認なしで進めてよい作業と、止まって確認する作業の境界は `~/.agents/guidelines/delegate.md` を参照する (commit・push・外部への書き込み・データ削除などを行う前に読む)
- Web 検索ではサマリーを信頼せず、実際にページにアクセスして原典を参照する
