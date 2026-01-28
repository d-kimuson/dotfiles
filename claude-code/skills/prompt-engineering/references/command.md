## Commands（コマンド）詳細リファレンス

### 概要
`/command-name [args]` でユーザーが呼び出す再利用可能な指示プリセット。

### 構造
- **配置場所**: `.claude/commands/<command-name>.md`
- **呼び出し方**: `/command-name [追加指示]`
- **処理方法**: フロントマターは除外され、本文が指示として渡される

### フロントマター
```yaml
---
description: 'When to use: このコマンドを使うべき状況の説明（必須、80文字以下、リポジトリの主要言語）'
disable-model-invocation: true  # 必須: エージェントからの自動呼び出しを防止
user-invocable: true            # 必須: ユーザーの / メニューに表示
allowed-tools: Bash(git, gh), Read(*), Edit(*.ts), Grep  # 任意だが推奨
---
```

### 必須フロントマターフィールド

| フィールド | 値 | 説明 |
|----------|-----|------|
| `description` | 文字列 | コマンドの用途説明（80文字以下） |
| `disable-model-invocation` | `true` | エージェントからの自動呼び出しを防止 |
| `user-invocable` | `true` | `/` メニューにコマンドを表示 |

**Command は常にユーザー起点で呼び出される想定**。エージェントが自動で呼び出すべきものは Agent または Skill として定義する。

### description フィールド
- **中心内容**: 「When to use」- このコマンドをいつ使うべきか
- **言語**: プロジェクトの主要言語で記述
- **長さ**: 80文字以下

### allowed-tools フィールド
権限構文の詳細は `references/permission-syntax.md` を参照。

**デフォルト許可ツール（省略可）**: `TodoWrite`, `Task`, `Glob`, `Grep`, `Read`

### 変数置換

コマンド本文では以下の変数が利用可能:

| 変数 | 説明 |
|------|------|
| `$ARGUMENTS` | コマンド呼び出し時に渡された引数。`/fix-issue 123` → `$ARGUMENTS` は `123` |

`$ARGUMENTS` が本文に存在しない場合、引数は末尾に `ARGUMENTS: <value>` として自動追加される。

### 対象読者
- `description` → ユーザー（プロジェクト言語）
- 本文 → LLM ワーカー

### 設計原則

### 単一責任
コマンドは一つの明確なタスクを実行すべき。
- ✅ `/format` - コードフォーマット
- ✅ `/test` - テスト実行

### 簡潔さ
- 実行に必要な情報のみを含める
- 冗長な説明を削除
- LLM が推論できることは省略

### Command と Skill の使い分け

| 観点 | Command | Skill |
|------|---------|-------|
| 呼び出し元 | ユーザー（`/` で明示的） | エージェント（自動判断）＋ユーザー |
| `disable-model-invocation` | `true`（必須） | `false`（必須） |
| 用途 | タスク実行 | 知識・ガイドライン付与 |

**判断基準**: ユーザーが明示的に呼び出すタスク → Command、エージェントが状況に応じて有効化する知識 → Skill

### 良い例

**ファイル名**: `.claude/commands/review-changes.md`

```markdown
---
description: 'When to use: コード変更のレビューが必要なとき'
disable-model-invocation: true
user-invocable: true
allowed-tools: Bash(git), Read(*), Grep
---

現在のブランチの変更をレビューする。

チェック項目:
- 型安全性
- セキュリティ問題
- パフォーマンス懸念
- テストカバレッジ

出力形式:
- 重要度別に問題をリスト
- 具体的な改善提案を含める
```
