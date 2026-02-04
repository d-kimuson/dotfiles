---
description: 'プロジェクト固有のガイドラインドキュメントをセットアップしたいとき'
disable-model-invocation: true
user-invocable: true
allowed-tools: Read(*), Glob(*), Write(.kimuson/guidelines/*), Edit(.kimuson/guidelines/*), Bash(git)
---

<overview>
コードベース分析と既存ドキュメントに基づき、プロジェクト固有のガイドラインを `.kimuson/guidelines/` 配下にセットアップする。

**対象ファイル**:
1. `coding-guideline.md`: コーディング規約（命名、型、アーキテクチャ）
2. `qa-guideline.md`: 検証手順（起動方法、動作確認）
3. `branch-rule.md`: ブランチ命名規則
4. `commit-msg-rule.md`: コミットメッセージ規則
5. `completion-notification.md`: タスク完了通知設定（オプション、デフォルト無効）
</overview>

<core_principles>
**発見ベース、重複ゼロ**

- コードベース分析で発見したパターンのみ記載（エビデンス: ファイル数、パス例）
- CLAUDE.md を参照・複製しない（システムコンテキストとして既にロード済み）
- 汎用的なベストプラクティスを含めない（TypeScript 基礎、テスト一般論など）
- パターンが見つからない場合: ユーザー入力用のギャップとして記載、ルールを創作しない

**エビデンス要件**:
- 3 ファイル以上で確認されたパターンを「プロジェクト規約」とする
- 各パターンにファイル数とパス例を記載
- ✅ "変数名: camelCase（src/ 配下 87 ファイルで確認）"
- ❌ "変数名は camelCase を使用すべき"（汎用、エビデンスなし）
</core_principles>

<file_responsibilities>
**coding-guideline.md**（実装フェーズ）:
- コード記述時に従うルール
- 型安全性、命名規則、アーキテクチャパターン
- 既存ドキュメントへの参照（存在する場合）
- テスト記述ガイドライン

**qa-guideline.md**（検証フェーズ）:
- LLM が実行する探索的 QA 手順
- アプリケーション起動方法（サーバーコマンド、URL）
- 手動検証対象（ブラウザアクセス、API 呼び出し）
- 期待される動作と成功基準

**branch-rule.md**（環境構築フェーズ）:
- ブランチ命名規則
- 一時的 / 永続的ブランチのパターン

**commit-msg-rule.md**（コミットフェーズ）:
- コミットメッセージのフォーマット
- タイプ接頭辞（feat, fix, chore 等）
- スコープの使用パターン

**completion-notification.md**（オプション）:
- タスク完了時の通知設定
- デフォルト: 無効（ファイル作成しない）
</file_responsibilities>

<file_handling>
**基本パターン**: 既存ファイル → Read してから Edit で更新; 新規ファイル → Write で作成
</file_handling>

<execution_process>

## Phase 0: 既存ガイドライン確認

<step_0 name="check_existing_guidelines">

### アクション
`.kimuson/guidelines/` 配下の既存ファイルを確認し、マイグレーション要否を判断する。

```
# 既存ファイル確認
Glob: .kimuson/guidelines/*.md
```

**既存ファイルがある場合**:
1. 各ファイルを Read して内容を把握
2. 現在のテンプレート原則と比較し、不足項目を特定
3. Phase 1-3 では Edit で不足分を追加（全面書き換えではなく差分更新）

**既存ファイルがない場合**:
1. Phase 1-3 で新規作成

</step_0>

## Phase 1: coding-guideline.md 作成/更新

<step_1 name="systematic_codebase_analysis">

### アクション
コードベースを体系的に分析し、プロジェクト固有のパターンを抽出する。一貫性について深く考える。

**体系的分析**（一貫性を熟考）:
1. **構造発見**: ソースファイルを Glob（`**/*.{ts,tsx}`, `**/*.test.*`）
2. **10-20 ファイルをサンプリング**: 異なるモジュールを Read し、命名・構造・型を分析
3. **パターン抽出**: 命名、ファイル構成、型使用、テスト、アーキテクチャ
4. **一貫性検証**: Grep（`output_mode="count"`）でパターン普及率を確認（3+ ファイル = 規約）
5. **ドキュメント検索**: `docs/**/*.md`, `**/CONTRIBUTING.md` を Glob（CLAUDE.md は完全スキップ）
6. **大規模コードベース**: Task ツールの Explore エージェントを使用

**パターン不足の場合**: ユーザー入力用のギャップとして記載、汎用ルールを創作しない

</step_1>

<step_2 name="create_coding_guideline">

### アクション
step_1 の発見に基づき `.kimuson/guidelines/coding-guideline.md` を作成/更新する。Phase 4 確認用にソース（ドキュメント由来/コード由来/ギャップ）を内部追跡する。

**テンプレート原則**（構造は固定ではなく、発見トピックに応じて整理）:
```markdown
# Coding Guideline

コードベース分析で発見したプロジェクト固有のパターン。

## [トピック名 - 例: 命名規則、型使用、テスト]

- [パターン]: [説明]（[N] ファイルで確認、例: src/components/*.tsx）
- [別のパターン（エビデンス付き）]

## ドキュメント参照

[存在確認済みの場合のみ:] [トピック]について: `path/to/doc.md` 参照
```

**重要**: 全内容は step_1 の発見から。パターン未発見: ギャップとして記載、汎用ルールを創作しない。エビデンス（ファイル数、パス）を記載。

<file_handling> パターンを適用。

</step_2>

## Phase 2: qa-guideline.md 作成/更新

<step_3 name="create_qa_guideline">

### アクション
発見した設定から `.kimuson/guidelines/qa-guideline.md` を作成/更新する。Phase 4 用にソースを追跡。

**発見対象**:
- 起動コマンド: `package.json` scripts、README、docker-compose.yml、Makefile
- アプリタイプ/エンドポイント: Web（ポート設定）、API（ルート）、CLI（コマンド）
- 検証対象: コード構造、テストファイル、ドキュメント

**テンプレート原則**:
```markdown
# QA Guideline

## 起動: [package.json/docs からのコマンド]
**期待**: [設定からの出力/URL]

## 検証: [アプリタイプに基づく]
1. [機能 - コード/テスト/docs から]
2. [検証方法 - ブラウザ/curl/CLI]

## 成功基準: [プロジェクト固有の動作]
```

**重要**: コマンド/URL は設定から発見、仮定しない。不明な場合はギャップとして記載。

<file_handling> パターンを適用。

</step_3>

## Phase 3: branch-rule.md / commit-msg-rule.md 作成/更新

<step_4 name="analyze_git_and_create_rules">

### アクション
git 履歴を分析し、`.kimuson/guidelines/branch-rule.md` と `.kimuson/guidelines/commit-msg-rule.md` を作成/更新する。Phase 4 用にソースを追跡。

```bash
# ブランチ分析
git branch -a --format='%(refname:short)' | head -30

# コミット履歴分析
git log --oneline --all --decorate -30
```

**分析観点**:
- ブランチ: 接頭辞（feature/, fix/）、一時パターン（tmp, wip）、説明形式（kebab/snake case）
- コミット: タイプ接頭辞（feat:, fix:, chore:）、スコープ使用、メッセージ形式

**branch-rule.md テンプレート原則**:
```markdown
# Branch Naming Rule

**パターン**: [git 履歴から]（[N] ブランチで確認）
**タイプ**: [type1/, type2/]（件数付き）
**例**: [ログからの実際のブランチ名]
```

**commit-msg-rule.md テンプレート原則**:
```markdown
# Commit Message Rule

**フォーマット**: [git log から発見したパターン]
**タイプ接頭辞**: [feat, fix, chore 等]（使用頻度付き）
**スコープ**: [使用パターン、または「未使用」]
**例**: [ログからの実際のコミットメッセージ]
```

**重要**: 明確なパターンがない場合（ブランチ/コミットが少ない、一貫性なし）、ユーザー入力用のギャップとして記載。

<file_handling> パターンを適用。

</step_4>

## Phase 4: CLAUDE.md 更新 & 完了レポート

<step_5 name="update_claude_md_and_report">

### アクション
CLAUDE.md にガイドラインファイルの参照を追加し、作成内容とフィードバック必要項目を報告する。

**CLAUDE.md 更新**:
プロジェクトの CLAUDE.md に以下のセクションを追加（存在しない場合は作成を提案）:

```markdown
## Project Guidelines

プロジェクト固有のガイドラインは `.kimuson/guidelines/` 配下を参照:
- `coding-guideline.md`: コーディング規約（実装時に参照）
- `qa-guideline.md`: 検証手順（QA 実行時に参照）
- `branch-rule.md`: ブランチ命名規則（ブランチ作成時に参照）
- `commit-msg-rule.md`: コミットメッセージ規則（コミット時に参照）
```

**保守的デフォルト**:
- コアファイル（coding, qa, branch, commit-msg）は発見パターンで作成
- `completion-notification.md` は作成しない（デフォルト: 通知無効）
- 不明瞭なパターン: 最も多く観察されたパターンを採用、不確実性を記載

**レポート形式**:
```
セットアップ完了しました。

**作成/更新したファイル**:
- `.kimuson/guidelines/coding-guideline.md`
- `.kimuson/guidelines/qa-guideline.md`
- `.kimuson/guidelines/branch-rule.md`
- `.kimuson/guidelines/commit-msg-rule.md`
- `CLAUDE.md`（ガイドライン参照を追加）

**発見したパターン**:
- ファイル命名: kebab-case（src/ 配下 47 ファイルで確認）
- テストファイル: `*.test.ts` パターン（23 ファイル）
- 起動コマンド: `npm run dev`（package.json より）
- ブランチタイプ: feature/, fix/（git log で 18 ブランチ確認）
- コミット形式: `type: message`（git log で 25 コミット確認）

**確認が必要な項目**（保守的に設定）:
- 変数命名: camelCase を採用（一貫性なし、最多パターンを選択）
- タスク完了通知: 無効（デフォルト）

必要に応じて修正指示をください。通知設定が必要な場合は以下の形式で教えてください:
- ローカル作業完了時: slack:#channel
- PR作成完了時: slack:#channel / github:@reviewer
```

**ユーザーからフィードバックがあった場合**:
- 既存ファイルに修正を適用
- 通知設定が提供された場合: `completion-notification.md` を作成:
  ```markdown
  # Task Completion Notification

  ## Local Work Completion
  **Status**: [disabled | enabled]
  **Method/Target**: [N/A | slack:#channel]

  ## PR Creation Completion
  **Status**: [disabled | enabled]
  **Method/Target**: [N/A | slack:#channel | github:@user]
  ```

</step_5>

</execution_process>

<completion_criteria>
コアガイドラインファイル（coding, qa, branch, commit-msg）が以下を満たす:
- 発見パターン（汎用アドバイスではない）にエビデンス記載
- プロジェクト固有の内容（汎用ベストプラクティスゼロ）
- CLAUDE.md の重複なし（コンテキストファイルはスキップ）
- 不明瞭なパターン: 保守的デフォルトを選択、レポートに記載
- CLAUDE.md にガイドラインファイルへの参照を追加

オプションファイル（completion-notification）:
- ユーザーが明示的に通知設定を提供した場合のみ作成
- デフォルト: ファイル作成なし（通知無効）
</completion_criteria>
