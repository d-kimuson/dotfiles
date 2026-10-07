# <project-name>

## Overview

<!-- decision: overview
  決めること: プロダクトが誰のどんな課題を解くか (1〜2 文) と、主要な技術スタック
  観察: README、package.json などのマニフェスト、既存の AGENTS.md・CLAUDE.md
  書き方: エレベーターピッチを 1〜2 文、技術スタックを 1 行で書く。リポジトリから読み取れない目的や利用者は、推測で書かずにユーザーに聞いて書く
-->

## Directory Structure

<!-- decision: directory-structure
  決めること: depth 2 程度のディレクトリ構成と、各ディレクトリの責務
  観察: リポジトリのツリー。生成するハーネス (docs/guidelines/、.agents/ など) も含める
  書き方: text のツリーで書き、責務はコメントで添える。パス名だけを根拠に責務を書かない。全ファイルを列挙しない
-->

## Feedback Loop

<!-- decision: feedback-loop
  決めること: 変更のたびに、指示がなくても回す検証のコマンドと、それぞれを実行する条件
  観察: package.json の scripts、Makefile、justfile、CI の設定 (.github/workflows など)、pre-commit hook の設定。コードを持たないリポジトリか
  書き方: 「コマンド | 検証内容 | 実行する条件」の表にする。実行する条件は「常に」か、変更したファイルの種類で書く。自動修正のコマンドがあれば先頭に置く。表の後に、CI がどれを実行するかを 1〜2 文で書く。載せるのは実行して通ることを確かめたコマンドだけにし、通らないものや見つからない検証はユーザーに聞いて決める。回す検証がないリポジトリなら節ごと省く
-->

## References

References contain important instructions that are intentionally separated for progressive disclosure.
Always read every reference relevant to the task before making changes.

| いつ読むか | 参照先 |
| --- | --- |
| タスクの進め方や内部レビューを決める、指示のない操作 (コミット、push など) をするか判断する | `docs/guidelines/delegate.md` |
| コミットする | `docs/guidelines/commit.md` |
| 変更をレビューする | `docs/guidelines/review/index.md` |
| ドキュメントを書く | `docs/guidelines/writing/index.md` と文書タイプ別のガイド |
| AGENTS.md、ガイドライン、skills、prompts を変更する | `docs/guidelines/harness.md` |
| コードを書く・変更する | `docs/guidelines/coding/index.md` |
| テストの種類や範囲を決める、失敗したテストを再現する | `docs/guidelines/quality-assurance/index.md` |
| ツールや依存を追加する | `docs/guidelines/local-dev.md` |
| コマンドやツールが想定外に失敗する | `.agents/troubleshots/` |

<!-- decision: references-table
  決めること: マッピング表に載せる行。生成しなかったガイドラインの行を消し、既存のドキュメントや追加したガイドラインの行を足す
  観察: 生成・マージ後の docs/guidelines/ と、既存のドキュメント (アーキテクチャ、デプロイ手順など) のうちエージェントが作業時に読むべきもの
  書き方: 「いつ読むか」は、エージェントがその状況に入ったと判断できる動作 (〜を変更する、〜する) で書く。1 行 1 状況にし、参照先はリポジトリルートからのパスにする。文書の言語が日本語以外なら、見出しと「いつ読むか」をその言語にする。References の導入文 2 行は英語のまま残す
-->

<!-- decision: codex-review-section
  決めること: Codex のコードレビューを使う場合に、AGENTS.md にレビュー用の節を置くか
  観察: Codex のコードレビューが有効か (ユーザーに確認する)。Codex がレビュー時に読む AGENTS.md の節の名前は、生成時点の公式ドキュメントで確かめる
  書き方: 使うなら、その名前の H2 を References の後に足し、本文は「`docs/guidelines/review/index.md` に従ってレビューする」の 1 文だけにする。使わないなら何も書かない
-->
