# Context Files（コンテキストファイル）詳細リファレンス

## 概要
CLAUDE.md, GEMINI.md, AGENTS.md など、毎セッション自動ロードされるプロジェクト全体またはグローバルなコンテキスト。

## ファイル構造
- **配置場所**:
  - プロジェクト: `.claude/CLAUDE.md`, `.gemini/GEMINI.md`, `.claude/AGENTS.md`
  - グローバル: `~/.claude/CLAUDE.md`, `~/.gemini/GEMINI.md`, `~/.claude/AGENTS.md`
- **処理方法**: 内容全体が毎セッションのベースコンテキストに注入される
- **フロントマターなし**: 内容を直接記述

## 重要な特性
- **常時ロード**: タスクに関係なく毎セッション読み込まれる
- **最大コスト**: 毎インタラクションでコンテキストトークンを消費
- **最小コンテンツ**: タスクの80%が必要とするものだけを含める

> **注意**: これらはガイドラインであり、絶対的なルールではない。プロジェクトの固有事情によっては例外が正当化される場合もある。判断を用いつつ、不確かな場合はミニマリズムをデフォルトとする。

## コンテンツ原則

### 1. インデックス優先
詳細ドキュメントへのポインタ、網羅的な内容ではない。
- ✅ "コーディング規約: docs/coding-style.md"
- 直接内容を記述するのは: 発見不可能、全タスクに影響、極めて簡潔（1-2行）の場合のみ

### 2. 80%ルール
タスクの80%が必要とする情報のみ。
- ✅ リポジトリ構造、主要規約、重要な制約

### 3. 抽象的・ナビゲーション的
情報を見つけるための素材、詳細の羅列ではない。
- ✅ "データベース: alembic ファイルは db/migrations/"

### 4. コマンドの吟味
LLM が典型的なタスクで自律実行するコマンドのみ。
- ✅ `pnpm build`, `pnpm test`（LLM が実行）

## 良い例
```markdown
# CLAUDE.md (my-project)

## Architecture
- Monorepo: pnpm workspaces
- API: packages/api (NestJS), Frontend: packages/web (Next.js)
- Details: docs/architecture/README.md

## Key Conventions
- Branch naming: feature/*, bugfix/* (docs/git-workflow.md)
- Never modify: src/generated/* (auto-generated)
- Testing: Vitest/Playwright (docs/testing.md)

## Critical Constraints
- Database changes require migration (alembic)
- Public API changes require version bump (semver)
```
