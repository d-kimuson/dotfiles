# Hooks（フック）詳細リファレンス

## 概要
ツール実行の前後やセッションのライフサイクルで実行されるカスタムコマンド。
Agents や Skills のフロントマターでも、settings.json でも定義可能。

## 設定場所

| 場所 | スコープ |
|------|----------|
| `~/.claude/settings.json` | ユーザー全体 |
| `.claude/settings.json` | プロジェクト共有 |
| `.claude/settings.local.json` | プロジェクトローカル |
| Agent/Skill フロントマター | そのコンポーネントがアクティブな間のみ |

## イベントタイプ

### マッチャー使用イベント

| イベント | 実行タイミング | マッチャー対象 |
|---------|---------------|----------------|
| `PreToolUse` | ツール呼び出し前 | ツール名 |
| `PostToolUse` | ツール呼び出し後 | ツール名 |
| `PermissionRequest` | 許可ダイアログ表示時 | ツール名 |
| `Notification` | 通知送信時 | 通知タイプ |

### マッチャー不要イベント

| イベント | 実行タイミング |
|---------|---------------|
| `UserPromptSubmit` | ユーザープロンプト送信時（処理前） |
| `Stop` | メインエージェント応答終了時 |
| `SubagentStop` | サブエージェント応答終了時 |
| `SessionStart` | セッション開始・再開時 |
| `SessionEnd` | セッション終了時 |
| `PreCompact` | コンパクト操作前 |

## 設定形式

### settings.json での設定

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/lint.sh",
            "timeout": 30
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "./scripts/cleanup.sh"
          }
        ]
      }
    ]
  }
}
```

### Agent/Skill フロントマターでの設定

```yaml
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate.sh"
  PostToolUse:
    - matcher: "Edit|Write"
      hooks:
        - type: command
          command: "./scripts/lint.sh"
```

Agent/Skill で利用可能なイベント: `PreToolUse`, `PostToolUse`, `Stop`

## マッチャー構文

- 単純文字列: `Write` → Write ツールのみ
- 正規表現: `Edit|Write`, `Notebook.*`
- 全マッチ: `*` または空文字列 `""`

## フック入力（stdin JSON）

全イベント共通フィールド:

```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/current/working/directory",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse"
}
```

### PreToolUse / PostToolUse 追加フィールド

```json
{
  "tool_name": "Write",
  "tool_input": { "file_path": "/path/to/file.txt", "content": "..." },
  "tool_use_id": "toolu_01ABC123..."
}
```

PostToolUse は追加で `tool_response` を含む。

## 終了コード

| コード | 動作 |
|--------|------|
| `0` | 成功。stdout を処理（JSON または テキスト） |
| `2` | ブロック。stderr をエラーメッセージとして使用 |
| その他 | 非ブロッキングエラー。stderr を表示して続行 |

### 終了コード 2 の動作（イベント別）

| イベント | 動作 |
|---------|------|
| `PreToolUse` | ツール呼び出しをブロック、stderr を Claude に表示 |
| `PermissionRequest` | 許可を拒否、stderr を Claude に表示 |
| `PostToolUse` | stderr を Claude に表示（ツールは実行済み） |
| `UserPromptSubmit` | プロンプト処理をブロック、stderr をユーザーに表示 |
| `Stop` / `SubagentStop` | 停止をブロック、stderr を Claude に表示 |

## 環境変数

| 変数 | 説明 |
|------|------|
| `CLAUDE_PROJECT_DIR` | プロジェクトルートへの絶対パス |
| `CLAUDE_ENV_FILE` | SessionStart のみ。環境変数を永続化するファイルパス |

## よく使うパターン

### 読み取り専用クエリの強制

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "./scripts/validate-readonly.sh"
          }
        ]
      }
    ]
  }
}
```

validate-readonly.sh:
```bash
#!/bin/bash
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if echo "$COMMAND" | grep -iE '\b(INSERT|UPDATE|DELETE|DROP)\b' > /dev/null; then
  echo "ブロック: SELECT クエリのみ許可" >&2
  exit 2
fi
exit 0
```

### ファイル編集後の自動リント

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "npm run lint --fix"
          }
        ]
      }
    ]
  }
}
```
