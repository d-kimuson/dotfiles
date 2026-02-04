## Skills（スキル）詳細リファレンス

### 概要
セッションにロードされる再利用可能な知識・ガイドライン。

### 構造
- **配置場所**: `${.claude,.github,.codex,.gemini}/skills/<skill-name>/SKILL.md`
- **呼び出し方**: Skill ツールまたは description に基づく自動ロード
- **処理方法**: フロントマターは除外され、本文がコンテキストに注入される

### フロントマター

```yaml
---
name: skill-name                    # 省略時はディレクトリ名を使用。小文字・数字・ハイフンのみ（最大64文字）
description: 'このスキルを有効化すべきタイミング'  # 推奨。省略時は本文の最初の段落を使用
disable-model-invocation: false     # 必須: エージェントからの自動呼び出しを許可
user-invocable: true                # 必須: / メニューに表示（false にする場合は理由を明記）
# argument-hint: '[issue-number]'   # オートコンプリート時に表示されるヒント
# allowed-tools: Read, Grep, Glob   # スキルがアクティブ時に許可なしで使用できるツール（構文は references/permission-syntax.md 参照）
# model: sonnet                     # スキルがアクティブ時に使用するモデル
# context: fork                     # fork でサブエージェントコンテキストで実行
# agent: Explore                    # context: fork 時に使用するサブエージェントタイプ
# hooks:                            # スキルのライフサイクルにスコープされたフック
#   PreToolUse:
#     - matcher: "Bash"
#       hooks:
#         - type: command
#           command: "./scripts/validate.sh"
---
```

### 必須フロントマターフィールド

| フィールド | 値 | 説明 |
|----------|-----|------|
| `disable-model-invocation` | `false` | エージェントからの自動呼び出しを許可 |
| `user-invocable` | `true` / `false` | `/` メニューへの表示制御 |

**Skill はエージェントが必要に応じて自動ロードする想定**。`disable-model-invocation: false` でエージェントの判断による有効化を許可する。

### user-invocable の使い分け

| 値 | ユースケース |
|----|-------------|
| `true`（基本） | ユーザーが明示的に有効化する可能性があるスキル |
| `false` | バックグラウンド知識、内部用スキル、他プロンプトからの参照専用 |

### その他のフィールド解説

| フィールド | 用途 |
|----------|------|
| `context: fork` | サブエージェントで分離実行。明示的なタスク指示を含むスキルにのみ有効 |
| `hooks` | `PreToolUse`, `PostToolUse`, `Stop` をサポート。`references/hooks.md` 参照 |

### 対象読者
任意の LLM（メインセッション、オーケストレーター、サブエージェント）

### 設計原則
- ワークフローのオーケストレーションではなく、**知識・能力の付与**
- 原則、ベストプラクティス、ルール（「まずXをして、次にY」ではない）
- 再現可能で解釈が安定した内容

### Command と Skill の使い分け

| 観点 | Command | Skill |
|------|---------|-------|
| 呼び出し元 | ユーザー（`/` で明示的） | エージェント（自動判断）＋ユーザー |
| `disable-model-invocation` | `true`（必須） | `false`（必須） |
| 用途 | タスク実行 | 知識・ガイドライン付与 |

**判断基準**: ユーザーが明示的に呼び出すタスク → Command、エージェントが状況に応じて有効化する知識 → Skill

### 良い例

#### 標準（`user-invocable: true`）

```markdown
---
name: typescript
description: 'TypeScript コードを書く・レビューする際に有効化'
disable-model-invocation: false
user-invocable: true
---

## 型安全性の原則
- `any` の使用を避け、`unknown` を優先
- 型推論が十分な場合は明示的な型注釈を省略
- Union types と discriminated unions を活用

## エラーハンドリング
- Result 型パターンを使用（例外よりも明示的な戻り値）
- カスタムエラー型を定義して型安全なエラーハンドリング
```

#### 内部用（`user-invocable: false`）

他のプロンプトから参照される補助スキル、バックグラウンド知識用。

```markdown
---
name: legacy-api-context
description: 'レガシー API の内部知識'
disable-model-invocation: false
user-invocable: false
---

## レガシー API の制約
- v1 エンドポイントは廃止予定、v2 を使用
- 認証トークンは X-Legacy-Auth ヘッダーで送信
- レート制限: 100 req/min
```
