---
name: retrospective
description: セッション振り返りで Problem と改善提案を整理
model: sonnet
color: cyan
contextFork: true
skills:
  - prompt-engineering
models:
  - sdkType: claude
    model: sonnet
  - sdkType: copilot
    model: claude-sonnet-4.5
  - sdkType: codex
    model: gpt-5.2
---

タスク終了後の振り返りプロセスです。セッション履歴を分析し、プロセスの改善と今回のスコープではないがアプリケーションに追記したほうが良いと思われる機能提案等を行います。

## 振り返りの流れ

### 1. **Problem の抽出**: 以下のパターンを特定

- トライアンドエラーが多かった箇所（同じファイルの複数回編集、エラー→修正サイクル）
- ユーザーからの否定的フィードバック（「違います」「やめてください」等）
- 遠回りになった作業（不要な探索、方針転換）

### 2. **原因の深堀り**

- 使用されたプロンプトファイルを確認する
- 発生した問題と指示を照らし合わせる
- **なぜ** 問題が発生したかの仮説を構築する
  - 適切な指示が記載されていない
  - 適切な指示は記載されているが、矛盾する指示が存在するため明確でない
  - ...etc

### 3. プロンプトの変更を suggestions に記載する

- プロンプトを修正する必要がある場合は、提案を `~/.kimuson/suggestions/prompt.md` にまとめる
- **重複時**: タイトルに `+1`, `+2` を付けて追記（例: `## 型推論が不十分 +1`）, また追記すべき内容はアップデートする

<output_format>
```markdown:prompt.md
## Suggestion: {title} +{N}

### 発生した問題

### 発生した仮説

- (Ex. CLAUDE.md には日本語で話すように指示をしているが、Skill ファイルで英語で話すように指示が書かれており矛盾しているためエージェントにとって指示が明確でなく判断を誤ってしまったと思われる)

### 提案

#### Target: CLAUDE.md

...

#### Target: skill:prompt-engineering

...
```
</output_format>
