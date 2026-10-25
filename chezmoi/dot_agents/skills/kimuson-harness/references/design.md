# Design

project-scope の harness を設計するときの基本。スキルとプロンプトテンプレートの両方に適用する。

## Scope

- 管理する: `.agents/skills/`、`.agents/prompts/`、プロジェクト直下の `AGENTS.md`。
- 対象 CLI: Claude Code、Command Code、Pi、OpenCode、Cursor Agent CLI。
- 操作対象は project scope だけ。スキル自体の配布は dotfiles が行う。
- subagent 定義は対象外。tool ごとの built-in と探索パスが違いすぎるため、必要になったプロジェクトで個別に設計する。

## Progressive Disclosure

- 必要になったときだけ、必要な情報を読む。
- 長い文章はコンテキストを圧迫し、エージェントを混乱させる。網羅性より論旨を優先する。短ければ短いほどよい。
- `SKILL.md` は入口。詳細は `references/` に分け、`SKILL.md` に再掲しない。
- 同じ情報を 2 箇所に書かない。正本を 1 つ決め、他はリンクする。

## Skill

- エージェントが自分の判断で読み込むもの。汎用的で最小限にする。
- `description` は「いつ有効にすべきか」だけを書く。内部の手順や機能一覧を書かない。
- `SKILL.md` は目的、スコープ、参照先、最小限の使い方だけにする。マトリクスや詳細手順は `references/` に置く。
- 機械的に処理できるものは `scripts/` に置き、`SKILL.md` からは実行方法だけ示す。

## Prompt

- ユーザーが `/name` で明示的に呼ぶもの。スキルにしない。
- 1 ファイル。references、scripts、playbooks は `.agents/deps/<name>/` に置き、prompt から参照する。
- prompt 本体には起動後の手順と成果物だけを書き、起動前の判断材料は人間向けドキュメントに書く。
- Claude Code は commands ディレクトリを skill としても読むため、`disable-model-invocation: true` を frontmatter に付ける。
- 決定的な処理は `.agents/deps/<name>/scripts/` に落とす。prompt には判断と手順だけを残す。
- 各 CLI の command / prompt ディレクトリへ symlink して配布する。配布先は `harness-matrix.md` に従う。

## Harness

- `.agents` を正本にする。tool がネイティブに読むなら symlink を貼らない。
- memory はプロジェクト直下の `AGENTS.md`。`.agents/AGENTS.md` を project memory にしない。
- tool ごとの探索パスは `harness-matrix.md` に分離する。
- 追加・変更時は、まずこの design で形を決め、matrix で配布先を確認し、sync で symlink を揃える。

## Checklist

- [ ] `description` は when only。
- [ ] `SKILL.md` に matrix や詳細手順を書いていない。
- [ ] `references/` と重複していない。
- [ ] prompt の資料は `.agents/deps/<name>/` にある。
- [ ] command には `disable-model-invocation: true` がある。
- [ ] 決定的な処理は scripts にある。
- [ ] project scope only。
