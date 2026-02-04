# Agents（エージェント）詳細リファレンス

## 概要
Taskツール(Claude Code標準)やagent-task(super-agent MCP)から呼び出される特化型サブエージェント。

## 構造
- **配置場所**: `.claude/agents/<agent-name>.md`
- **呼び出し方**: `agent-task(agentType="agent-name", ...)`, `Task(subagent_type="agent-name", ...)`
- **処理方法**: フロントマターは除外され、本文が指示として渡される

## Task vs agent-task

- 基本は super-agent を利用するためテンプレートには `agent-task(...)` の形で記載
- `context: fork` 等の Claude Code 独自機能を利用する場合のみ Task でテンプレートも記載する
- 利用できない場合のフォールバックは別途明示しているので、都度書かなくてOK

## フロントマター

`name` と `description` は必須。その他は任意（必要に応じてコメント解除して使用）。

```yaml
---
name: agent-name  # ファイル名（.md除く）と一致させる
description: 'エージェントの簡潔な説明'
model: sonnet     # Claude Code 用: haiku | sonnet | opus | inherit
color: cyan       # 表示色: red | blue | green | yellow | magenta | orange | pink | cyan
# skills:         # エージェント起動時に自動ロードするスキル
#   - typescript
#   - react
# tools: Read, Grep, Glob, Bash  # 使用可能なツール（省略時は全ツール継承）
# disallowedTools: Write, Edit   # 拒否するツール（継承から削除）
# permissionMode: default        # default | acceptEdits | dontAsk | bypassPermissions | plan
# hooks:                         # エージェントにスコープされたライフサイクルフック
#   PostToolUse:
#     - matcher: "Edit|Write"
#       hooks:
#         - type: command
#           command: "./scripts/run-linter.sh"
models:           # super-agent 用: 複数プロバイダー対応
  - sdkType: claude
    model: sonnet
  - sdkType: codex
    model: gpt-5.2
  - sdkType: copilot
    model: gpt-5.2
---
```

## 追加フィールド解説

| フィールド | 説明 |
|----------|------|
| `tools` | 使用可能なツールを制限（省略時は全ツール継承） |
| `disallowedTools` | 継承または指定リストから特定ツールを拒否 |
| `permissionMode` | 権限プロンプトの処理方法を制御 |
| `hooks` | `PreToolUse`, `PostToolUse`, `Stop` をサポート。`references/hooks.md` 参照 |

### permissionMode 値

| 値 | 動作 |
|----|------|
| `default` | プロンプト付きの標準権限チェック |
| `acceptEdits` | ファイル編集を自動受け入れ |
| `dontAsk` | 権限プロンプトを自動拒否（明示的に許可されたツールは機能） |
| `bypassPermissions` | すべての権限チェックをスキップ（注意して使用） |
| `plan` | プランモード（読み取り専用探索） |

## model フィールド（Claude Code 用）

Claude Code でのモデル選択:
- **haiku**: 速度重視、簡易タスク
- **sonnet**: バランス型、標準タスク
- **opus**: 複雑な推論、高品質な出力が必要なタスク
- **inherit**: 呼び出し元のモデルを継承

## models フィールド（super-agent 用）

複数の AI プロバイダーをフォールバック付きで指定。配列形式で `sdkType` と `model` を指定。

```yaml
models:
  - sdkType: claude
    model: opus
  - sdkType: codex
    model: gpt-5.2
  - sdkType: copilot
    model: gpt-5.2
```

### 選択ルール

利用できない場合にフォールバックされるため、**codex, copilot, claude の3つを必ず指定**。

**設計や相談など難易度の高くコンテキストサイズが膨らみづらいタスク**:
```yaml
models:
  - sdkType: copilot
    model: gpt-5.2
  - sdkType: codex
    model: gpt-5.2
  - sdkType: claude
    model: opus
```

**簡易だがコンテキストサイズを多く必要とするタスク**（コンテキスト収集など）:
```yaml
models:
  - sdkType: copilot
    model: gpt-5-mini
  - sdkType: claude
    model: haiku
  - sdkType: codex
    model: gpt-5.2-mini
```

**文章系タスク**（記事執筆、プロンプト記載など）:
```yaml
models:
  - sdkType: claude
    model: sonnet
  - sdkType: copilot
    model: claude-sonnet-4.5
  - sdkType: codex
    model: gpt-5.2
```

**選択の指針**:
- **Claude の得意**: 柔軟性と文章力
- **OpenAI Model の得意**: 純粋な賢さ
- **料金体系**: Copilot が安い（Opus だけ例外）。同じモデルが利用できるなら Copilot CLI 優先

## skills フィールド
- ここにリストしたスキルはエージェント呼び出し時に自動ロードされる
- 本文での手動 `Skill(...)` 呼び出しや「X スキルを有効化」指示は不要
- エージェントが**常に**必要とするスキルに使用（条件付きは除く）
- 動的・条件付きのスキルロードにはプロンプト本文で `Skill(...)` ツールを使用

## 対象読者
呼び出し側（オーケストレーター LLM）と実行側（サブエージェント LLM）の両方が LLM。

## 設計原則

### 単一責任
- 各エージェントは一つの明確に定義された責任を持つ
- 複数の関心事を混在させない
- ✅ エージェント A: 環境セットアップのみ
- ✅ エージェント B: コード実装のみ

### 呼び出し元からの独立
- オーケストレーターの関心事（いつ呼び出すか、出力をどうするか）は含めない
- 能力の付与と入出力契約に集中
- ✅ "提供されたコードを分析し、問題を特定..."
- ✅ "指示に基づき、実装アプローチを設計..."

### ドメイン内で汎用的に
- タスク固有にしすぎない
- ✅ `name: engineer`（オーケストレーターが具体的なタスクを指定）

## 良い例
```markdown
---
name: reviewer
description: 'コード変更をレビューし、問題を特定'
model: sonnet
color: yellow
skills:
  - typescript
models:
  - sdkType: claude
    model: sonnet
  - sdkType: copilot
    model: claude-sonnet-4.5
  - sdkType: codex
    model: gpt-5.2
---

コード変更の品質と正確性をレビューする。

チェック項目:
- 型安全性と正確性
- セキュリティ脆弱性
- パフォーマンス問題
- コードスタイルの一貫性
- テストカバレッジの十分性

レポート形式:
- 重要度レベル（critical/moderate/minor）
- ファイルパスと行番号
- 具体的な推奨事項
- 優先順序（critical を先に）
```
