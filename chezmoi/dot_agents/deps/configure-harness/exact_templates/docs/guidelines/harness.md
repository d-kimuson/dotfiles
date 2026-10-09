# Harness

エージェントが参照する仕組み (AGENTS.md、ガイドライン、skills、prompts、troubleshots) の配置と更新のルール。

## 原則

- 常に読み込まれる AGENTS.md は薄く保つ。載せるのはプロダクト概要、depth 2 程度のディレクトリ説明、変更のたびに回す検証のコマンド (Feedback Loop)、ガイドラインへのマッピング表だけにする。
- 詳細はガイドラインに分割し、AGENTS.md の表に「いつ読むか」を添えて登録する。必要になった時点で読まれる (Progressive Disclosure) ことを前提に、1 ファイルは 1 つの状況に閉じる。
- Lint・型・テスト・スクリプトで強制できるルールはそちらで強制し、ガイドラインには書かない。ガイドラインに残るのは、機械的に検査できない判断基準と思想だけにする。
- AGENTS.md、REVIEW.md、ガイドライン、skills、prompts には、それを読んだエージェントが作業に使うことだけを書く。作業に使わない説明 (そのファイルの成り立ち、ほかにどのツールが読むかなど) は書かない。
- 正本は 1 つにする。ツール固有の場所は symlink か参照で正本を指す。

<!-- decision: tool-links
  決めること: どのコーディングエージェントに対応し、ツール固有の場所から正本をどう指すか
  観察: 既存の CLAUDE.md、.claude/、.codex/、.cursor/ など。ユーザーが使うエージェント
  書き方: 原則の最後の項目の後に、対応する組み合わせを括弧書きで列挙する (例: `.claude/skills` → `.agents/skills`)。AGENTS.md を直接読むエージェント (Claude Code、Codex など) のために CLAUDE.md などの指示ファイルは置かない。symlink は生成時に実際に作る。レビューの観点は `REVIEW.md` が正本なので、この列挙に含めない
-->

## 配置

| 種類 | 場所 |
| --- | --- |
| ガイドライン | `docs/guidelines/<name>.md`。分割する場合は `docs/guidelines/<name>/*.md` とし、共通部分を `index.md` に置く |
| レビューの観点 | `REVIEW.md`。REVIEW.md を読まないツールには AGENTS.md の `Code Review Rules` から参照させ、ツール向けのファイルは別に置かない |
| Agent Skills | `.agents/skills/<name>/` (`SKILL.md` と `README.md`) |
| Prompts | `.agents/prompts/<name>.md` |
| ワークアラウンド | `.agents/troubleshots/<topic>.md` (`docs/guidelines/writing/troubleshoot.md`) |
| 用語と不変条件 | `docs/CONTEXT.md` (`docs/guidelines/writing/context.md`) |
| ADR | `docs/adr/` (`docs/guidelines/writing/adr.md`) |
| Design Doc | `docs/design-doc/` (`docs/guidelines/writing/design-doc.md`) |

<!-- decision: placement
  決めること: 配置の表に載せる種類と場所
  観察: 生成するもの (ADR・Design Doc のガイド、Prompts を置くか、context-layout) と、既存のドキュメントの置き場所 (docs/ 配下の構成、既存の ADR ディレクトリなど)
  書き方: 生成しなかった種類の行を消し、既存の置き場所があればそちらに合わせて書き換える。context-layout で Context ごとに分けたなら、用語と不変条件・ADR・Design Doc の場所を Context 横断と Context ごとの 2 つにする。既存のドキュメントの種類 (アーキテクチャ、運用手順など) で今後も増えるものは行を足す
-->

## Prompts

Skills は Agent が自発的に利用する知識・能力に限る。ユーザーや他の仕組みが `/<name>` で明示的に起動する手順は Skill にせず、Prompts として切り出す。本体には起動後の手順と成果物だけを書き、いつ使うかなど起動前の判断材料は人間向けのドキュメントに書く。

<!-- decision: prompts
  決めること: Prompts を置くか。置くなら、人間向けドキュメントの場所と、ツール固有の場所 (.claude/commands など) からの参照方法
  観察: 既存の .claude/commands、.codex/prompts、.agents/prompts。ユーザーが明示的に起動する手順を持っているか
  書き方: 置かないなら節ごと消し、配置の表からも Prompts の行を消す。置くなら、人間向けドキュメントのパス (例: `docs/agents/prompts/<name>.md`) と symlink の向きを本文に足す
-->

## 更新

- ガイドラインを追加・削除・改名したら、同じ変更で AGENTS.md のマッピング表を更新する。
- ディレクトリ構成の変更が AGENTS.md の Directory Structure に現れる粒度なら、同じ変更で更新する。
- 作業中に見つかった仕組みの不備は、コミット時のボーイスカウト (`docs/guidelines/commit.md`) で扱う。
