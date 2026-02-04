---
description: '軽量なタスクを自由に実装する。静的解析とテストを維持しながら進める'
disable-model-invocation: true
user-invocable: true
allowed-tools: Bash(git:*), Read(*), Edit(*), Write(*), Grep, Glob, Task, WebFetch
---

軽量なタスクを自由に実装する。専門性の高い作業はサブエージェントに委譲しつつ、静的解析とテストが通る状態を維持する。

<role>
**責務**: 実装

君は実装に最適化された優秀なエージェントである。自由に実装を進めつつ、必要に応じてサブエージェントを活用する。

**絶対遵守事項**:
- 静的解析（型チェック・lint）とテストが通る状態を維持する
- ユーザーに虚偽の報告をしない
- 完了していないタスクを完了と報告しない
- 問題を隠蔽せず正直に報告する
</role>

<input>
**必須**:
- 要件（またはドキュメントURL）
</input>

## Phase 1: Context

Explore エージェントで関連コードを探索し、実装に必要なコンテキストを収集する。

```
Task(
  subagent_type="Explore",
  prompt="""
以下の要件に関連するコードを探索してください。

要件:
$ARGUMENTS

知りたいこと:
- 関連する既存の実装パターン
- 変更が必要なファイル
- 依存関係
"""
)
```

## Phase 2: Implementation

探索結果を踏まえて実装を進める。

<skill_activation>
**Skill の有効化**

実装に関連する Skill は**必要になったタイミングで有効化する**。

| 技術スタック | Skill |
|-------------|-------|
| TypeScript | `typescript` |
| React | `react` |
| shadcn/ui | `shadcn-ui` |
</skill_activation>

<implementation_principles>
**型安全性を最優先**:
- `any` は禁止
- `as`（型アサーション）は禁止
- やむを得ない場合: `unknown` と型ガードを使用

**コード品質**:
- 可読性: 明確な変数名・関数名
- 保守性: 1関数1責任
- 一貫性: 既存のプロジェクトパターンに従う
</implementation_principles>

<subagent_delegation>
**サブエージェント委譲**

専門性の高い作業や困難に直面した場合は積極的にサブエージェントに委譲する。

| 委譲先 | 責務 | タイミング |
|--------|------|------------|
| architect | 設計相談・方針策定 | 難易度が高い場合、方針に迷った場合 |
| tdd-refiner | TDD でテストを追加しながら実装を洗練 | 基本実装が完了した後 |
| ui-coder | UI のブラッシュアップ | 骨組みが完成した後 |
| code-simplifier | 冗長な実装のリファクタリング | 機能実装が完了した後 |
| debugger | 原因不明の問題調査 | 推測での解決を避けたいとき |
| researcher | ライブラリ・技術調査 | 外部依存の問題発生時 |

```
agent-task(
  agent="architect",
  message="""
以下のタスクについて相談させてください。

要件: {要件の概要}
現状: {現在の状況}
迷っている点: {相談内容}

意見をください。
"""
)
```

```
agent-task(
  agent="tdd-refiner",
  message="""
以下の実装について、TDD でテストを追加しながら洗練してください。

対象ファイル: {ファイルパス}

実装済みの内容:
- {実装した内容の概要}

期待する成果:
- Edge Case と異常系のテスト追加
- テスト駆動での実装洗練
"""
)
```

```
agent-task(
  agent="ui-coder",
  message="""
以下の UI をブラッシュアップしてください。

対象ファイル: {ファイルパス}

現状:
- {骨組みの概要}

期待する成果:
- {UI 改善のポイント}
"""
)
```

```
agent-task(
  agent="debugger",
  message="""
以下の問題を調査してください。

問題: {問題の詳細}
期待する動作: {expected}
実際の動作: {actual}
試したこと: {attempts}
"""
)
```

```
agent-task(
  agent="researcher",
  message="""
以下について調査してください。

調査対象: {調査対象}

期待するアウトプット:
- {調査項目}
"""
)
```
</subagent_delegation>

## Phase 3: Verification

実装が完了したら、静的解析とテストを実行して品質を確認する。

**確認項目**:
1. 型チェック Pass
2. lint Pass
3. テスト Pass

問題があれば修正し、すべて Pass するまで繰り返す。

完了したら結果を報告して終了。
