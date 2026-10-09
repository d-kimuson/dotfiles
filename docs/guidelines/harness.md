# Harness

エージェントが参照する仕組み (AGENTS.md、ガイドライン、skills、prompts、troubleshots) の配置と更新のルール。

## 原則

- 常に読み込まれる AGENTS.md は薄く保つ。載せるのはプロダクト概要、depth 2 程度のディレクトリ説明、変更のたびに回す検証のコマンド (Feedback Loop)、ガイドラインへのマッピング表だけにする。
- 詳細はガイドラインに分割し、AGENTS.md の表に「いつ読むか」を添えて登録する。必要になった時点で読まれる (Progressive Disclosure) ことを前提に、1 ファイルは 1 つの状況に閉じる。
- Lint・型・テスト・スクリプトで強制できるルールはそちらで強制し、ガイドラインには書かない。ガイドラインに残るのは、機械的に検査できない判断基準と思想だけにする。
- 正本は 1 つにする。ツール固有の場所は symlink か参照で正本を指す (`CLAUDE.md` → `AGENTS.md`、`.claude/skills` → `.agents/skills`、`.claude/commands` → `.agents/prompts`、`.pi/prompts` → `.agents/prompts`)。

## 配置

| 種類 | 場所 |
| --- | --- |
| ガイドライン | `docs/guidelines/<name>.md`。分割する場合は `docs/guidelines/<name>/*.md` とし、共通部分を `index.md` に置く |
| レビューの観点 | `docs/guidelines/review/index.md` |
| Agent Skills | `.agents/skills/<name>/` (`SKILL.md` と `README.md`) |
| Prompts | `.agents/prompts/<name>.md` |
| Prompts が使う資料 | `.agents/deps/<name>/` (`references/`、`scripts/`、`templates/` など) |
| ワークアラウンド | `.agents/troubleshots/<topic>.md` (`docs/guidelines/writing/troubleshoot.md`) |
| 用語と不変条件 | `docs/CONTEXT.md` (`docs/guidelines/writing/context.md`) |
| ADR | `docs/adr/YYYYMMDD-<name>.<status>.md` (`docs/guidelines/writing/adr.md`) |
| Design Doc | `docs/design-doc/YYYYMMDD-<name>.md` (`docs/guidelines/writing/design-doc.md`) |
| 機能仕様 | `docs/features/<name>.md` |
| 運用文書 (管理層、配布の仕組み、コマンド) | `docs/<topic>.md` |

## Prompts

Skills は Agent が自発的に利用する知識・能力に限る。ユーザーや他の仕組みが `/<name>` で明示的に起動する手順は Skill にせず、Prompts として切り出す。本体には起動後の手順と成果物だけを書き、いつ使うかなど起動前の判断材料は人間向けのドキュメントに書く。

人間向けのドキュメントは `docs/agents/prompts/<name>.md` に置く。Claude Code と Pi は、`.claude/commands` と `.pi/prompts` の symlink を通して `.agents/prompts/` を読む。

Prompts は 1 ファイルなので、手順書・スクリプト・テンプレートなどの資料は `.agents/deps/<name>/` に分ける。本体の冒頭で資料のディレクトリを示し、本体と資料の中のパスはそこからの相対パスで書く。本体は symlink を通して読まれるため、本体の位置からの相対パスは使わない。

全マシンに配るグローバルの skills と prompts も同じパターンを使う (`docs/coding-agents.md`)。

## 更新

- ガイドラインを追加・削除・改名したら、同じ変更で AGENTS.md のマッピング表を更新する。
- ディレクトリ構成の変更が AGENTS.md の Directory Structure に現れる粒度なら、同じ変更で更新する。
- 作業中に見つかった仕組みの不備は、コミット時のボーイスカウト (`docs/guidelines/commit.md`) で扱う。
