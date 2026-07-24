---
name: project-reference-creator
description: プロジェクト固有のガイドライン（コミットメッセージ・ブランチ命名・QA手順等）の用意
disable-model-invocation: false
user-invocable: true
context: fork
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(git log:*), Bash(git branch:*), Bash(ls:*)
---

プロジェクトの Git 履歴・ブランチ名・テスト環境を分析し、規約ガイドラインファイル群を生成して CLAUDE.md から参照する。

<output_files>

## 生成するファイル

| ファイル | 内容 |
|----------|------|
| `commit_message.md` | コミットメッセージの規約（prefix, scope, format） |
| `branch_naming.md` | ブランチ命名規約（prefix, 区切り文字, 例） |
| `definition_of_done.md` | 開発タスクの完了の定義。依頼ごとのACに加えて特に指示がなくともこのファイルの内容が完了していることを期待される |
| `qa_guideline.md` | 機能実装時の動作確認手段（E2E 検証フロー、探索的テストの方針） |
| `internal_review.md` | 内部レビューが必要な際のサブエージェント呼び出し方法 |

</output_files>

<procedure>

## 手順

### 1. ガイドライン配置先の決定

プロジェクト内の既存ドキュメントディレクトリ（`docs/`, etc.）を確認する。
既存の慣習がなければ `docs/guidelines/` に配置する。

### 2. コミットメッセージ規約の推測

`git log --oneline -50` で直近のコミットメッセージを分析し、以下を特定する:

- **Prefix**: `feat:`, `fix:`, `chore:` 等の Conventional Commits 形式か、独自形式か
- **Scope**: `feat(api):` のようなスコープの有無
- **Format**: 英語/日本語、命令形/過去形、大文字/小文字の先頭
- **その他**: Issue 番号の記法（`#123`, `PROJ-123` 等）

分析結果から `commit_message.md` を生成する。

### 3. ブランチ命名規約の推測

`git branch -a` でブランチ名を分析し、以下を特定する:

- **Prefix**: `feature/`, `fix/`, `hotfix/` 等
- **区切り文字**: `/`, `-`, `_`
- **命名パターン**: `feature/issue-123-description`, `fix/short-desc` 等

分析結果から `branch_naming.md` を生成する。

### 4. QA ガイドラインの作成

アプリケーションの動作検証手段を調査・整理し、以下のテンプレートに沿って `qa_guideline.md` を作成する。コード品質（lint, type check 等）はここでは扱わない。

**ブラウザ CLI の特定**: プロジェクトに Playwright, Cypress 等の E2E ツールが導入されているか確認する。導入されていなければ Playwright CLI をデフォルトとして使用する。

```
npx -y --package '@playwright/cli@latest' -- playwright-cli --help
```

以下のテンプレートを埋める形で `qa_guideline.md` を生成する:

````markdown
## QA Guideline

### 開発サーバー

- 起動コマンド: `{例: pnpm dev}`
- ポート: `{例: http://localhost:3000}`
- 起動確認: `{例: curl -s http://localhost:3000 > /dev/null && echo "OK"}`

### E2E 動作確認フロー

ブラウザ CLI: `{例: npx playwright-cli}` ({プロジェクト導入済み / Playwright CLI fallback})

1. 開発サーバーが起動しているか確認し、起動していなければ起動する
2. ブラウザ CLI でアプリにアクセスし、変更箇所に関連する画面を操作する
3. 正常系のユーザーフローを一通り確認する

### 異常系・エッジケースの検証

- 変更に関連する自動テストを探し、実行する
- 不足しているケース（異常系、境界値等）があればテストを追加して実行する

### 探索的テストの注意点

- {プロジェクト固有の注意点: 状態リセット方法、認証フロー、非同期待ちのポイント等}
````

### 5. 内部レビューガイドの作成

`internal_review.md` を作成する。

記載すべき内容:

- レビュー依頼時のサブエージェント呼び出し方法（デフォルトは general-purpose サブエージェントを使用）
- レビューに適したサブエージェントが登録されていれば、そのエージェント名と用途を明記して指定

### 6. Definition of Done の作成

プロジェクトで用意されている検査コマンドを調査し、以下のテンプレートに沿って `definition_of_done.md` を生成する。

````markdown
## Definition of Done

タスク完了時、AC の達成に加えて以下がすべて通ることを確認する。

### チェックコマンド

```bash
{例: pnpm typecheck && pnpm lint && pnpm test}
```
````

### 7. CLAUDE.md への参照追加

生成したファイルへのポインタを CLAUDE.md の `## References` セクションに追加する。Progressive Disclosure の原則に従い、必要時に参照する形式とする。

```markdown
## References

下記はこのプロジェクト固有の規約や手順をまとめたリファレンスです。
Progressive Disclosure に基づき、**冒頭ですべて読み込むのではなく、必要になった際に必要なリファレンスのみを** 参照してガイドラインに従って進行してください。

| Path | Description | いつ参照すべきか, 参照方法 |
|------|-------------|-------------|
| `{dir}/commit_message.md` | コミットメッセージの命名規則 | コミット作成時 |
| `{dir}/branch_naming.md` | ブランチ名の命名規則 | ブランチ作成時 |
| `{dir}/definition_of_done.md` | 完了の定義チェックリスト | タスク完了前にセルフチェック |
| `{dir}/qa_guideline.md` | 動作確認の手順とコマンド | 機能実装の動作確認時。直接自身で参照せず、QA 系または general-purpose サブエージェントにこのファイルのパスを渡して動作確認を依頼する |
| `{dir}/internal_review.md` | 内部レビューの呼び出し方法 | コードレビューを依頼する際 |
```

</procedure>

<guidelines>

## ガイドライン生成の原則

- **観察に基づく**: 推測は必ず Git 履歴やプロジェクト設定の実データに基づく。データが不足する場合はその旨を記載する
- **簡潔**: 各ファイルは規約の要点のみ。冗長な説明や一般論は不要
- **具体例を含める**: 規約だけでなく、実際のコミットメッセージやブランチ名の Good/Bad 例を含める
- **既存慣習の尊重**: プロジェクト固有の規約があればそれに従う。一般的なベストプラクティスを押し付けない

</guidelines>
