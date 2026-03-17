---
name: beads
description: 'beadsを利用したタスク管理のガイドライン'
disable-model-invocation: false
user-invocable: true
---

## ステークホルダー

- **人間(ユーザー)**: gate の approve/NG、ACの合意
- **beads-loop**: 独立したプロセスとして常駐し、ready 状態になったタスクを検知して適切なエージェントに自動でアサインしてセッションを起動
- **エージェント**: bd-architect/bd-pdm/bd-engineer が存在。beads-loop やユーザーから呼び出されそれぞれの責務でタスクを進行

beads タスクによって各ロール向けのタスクが Assign されますが、他 Role の意見を聞きたい場合にはサブエージェント(Ex. Agent(subagent_type=bd-pdm)として呼び出すことも可能です。プロダクト上の意思決定を PDM に相談したり、技術的な設計を architect に相談しても良いです。

## ライフサイクル

```
Issue作成 → [step:plan] → PDMリファインメント → [step:implement] → Engineer実装 → (gate:feature-review) → close
                              ↓ AC不明確なら
                         gate:plan-review → 人間承認 → step:implement へ
```

※ 省略可能Stepは `()` 表記で記載

## Issue の属性ルール

Issue には複数種の属性を持たせることが可能。下記の制約の元タスクを管理する。あえて制約を強くしており `--help` 等で設定可能な値よりこちらを優先。

- status: open|in_progress|blocked|closed
- type: bug|feature|task|epic|chore|gate
- assignee: bd-architect|bd-engineer|bd-pdm
- priority: P0|P1|P2|P3|P4
- description: string
- labels: `Array<string>`
- children: `Array<{issueId}>`
- blocks: `Array<{issueId}>`
- acceptance: string (受け入れ条件)
- comments: `Array<string>`

## タスク管理の設計

- bd は依存グラフを使った管理を行なうコンセプトの issue tracking tool. したがって、グルーピングのためにEpicを使っても良いが必須ではないという建付けにする
- 人間が入るべきものは全部 gate + 種別を label (gate:feature-review, gate:plan-review) で表現
  - ※ beads 上で承認や時間経過などによるタスクブロックを表現する概念

## ラベル

| ラベル | 説明 | 付与者 |
| :-- | :-- | :-- |
| `branch:{branch-name}` | issue は1ブランチと紐付く (Ex. `branch:beads/tasks/beads-abc`) | beads-loop |
| `session-id:{agent}:{id}` | issue は1セッションと紐付く (Ex. `session-id:claude:{uuid}`) | beads-loop |
| `step:plan` | 計画待ちチケット | bd-pdm |
| `step:implement` | 実装待ちチケット | bd-pdm |
| `gate:*` | gate の種類を表現 (Ex. `gate:feature-review`, `gate:plan-review`) | bd-engineer, bd-pdm |
| `needs:feature-review` | マージ条件として `gate:feature-review` が必要。存在しない場合はマージに承認不要 | bd-pdm |
| `feature-review:approved` | feature-review で承認された | 人間 |
| `feature-review:ng` | feature-review で deny された | 人間 |

## 新規 Issue の作成

チケットのACが生煮えである場合(planあり):

```bash
bd create "ほげほげ機能の実装"\
  --type feature\ # 適切なものを設定
  --priority 1\
  --labels 'step:plan'\
  --description "ほげほげ機能の詳細"
```

チケットのACが自明である場合(planなし):

```bash
bd create "ほげほげ機能の実装"\
  --type task\
  --priority 1\
  --labels 'step:implement'\
  --acceptance 'ほげほげ機能のAC'\
  --description "ほげほげ機能の詳細"
```

※ bug 修正やリファクタは AC が自明になりやすいが、新規機能開発かつ要件がふわっとしている場合は plan ありで作成

## その他の手順リファレンス

スキルディレクトリ(./.claude/skills/beads)以下の references 以下に配置されている。下記の作業を行う際は必ずリファレンスを参照すること。スキップすると状態の不整合が発生する可能性がある

| リファレンス | 主な利用者 | 内容 |
| :---: | :---: | :---: |
| develop.md | bd-engineer | implement issues の実装を行なう |
| refine-issues.md | bd-pdm | plan issues のリファインメントを行なう |
