# Design

スキルとプロンプトテンプレートを設計するときの基本。

## Scope

| 対象 | 使う | 備考 |
| --- | --- | --- |
| `.agents/skills/` | 使う | エージェントが自動で読むスキル |
| `.agents/prompts/` | 使う | ユーザーが `/name` で呼ぶプロンプト |
| `AGENTS.md` | 使う | project memory。`.agents/AGENTS.md` は使わない |
| subagent 定義 | 使わない | tool ごとの built-in と探索パスが違いすぎる |
| rules | 使わない | 揃える対象にしない |

## ディレクトリ構造

### Skill

```text
.agents/skills/<name>/
├── SKILL.md
├── README.md
├── references/
├── playbooks/
└── scripts/
```

### Prompt

```text
.agents/prompts/<name>.md
.agents/deps/<name>/
├── README.md
├── references/
└── scripts/
```

prompt 本体は `.agents/prompts/<name>.md` の 1 ファイル。README、references、scripts は `.agents/deps/<name>/` に置き、prompt から参照する。

## 原則

### Progressive Disclosure

- 必要になったときだけ、必要な情報を読む。
- 長い文章はコンテキストを圧迫し、エージェントを混乱させる。網羅性より論旨を優先する。短ければ短いほどよい。
- 同じ情報を 2 箇所に書かない。正本を 1 つ決め、他はリンクする。

### インデックスを軽くする

- 常に読まれるもの (`AGENTS.md`、`SKILL.md`) は薄くする。
- 詳細は `references/` に分ける。
- reference はユースケースごとに分割し、読むべきものと読まないものを分ける。

### `.agents` を正本にする

- `.agents` を正本にし、ツール固有の差分は symlink で吸収する。
- tool がネイティブに読むなら symlink を貼らない。
- コピーを作らない。

### 端的に書く

- 冗長な文章を書かない。
- 説得力を増すために同じ内容を表現を変えて何度も繰り返さない。
- 端的でわかりやすい文章を書く。

## Skill

- エージェントが自分の判断で読み込むもの。汎用的で最小限にする。
- `description` は「いつ有効にすべきか」だけを書く。内部の手順や機能一覧を書かない。
- `SKILL.md` は目的、スコープ、参照先、最小限の使い方だけにする。
- `README.md` を必ず置く。運用上の事情や管理上の設計意図は `README.md` に分け、`SKILL.md` には書かない。
- タスクパターンが複数あるなら `playbooks/` に分ける。`SKILL.md` はキーワードと playbook の対応だけを持つ。
- 機械的に処理できるものは `scripts/` に置き、`SKILL.md` からは実行方法だけ示す。

## Prompt

- ユーザーが `/name` で明示的に呼ぶもの。スキルにしない。
- 1 ファイル。README、references、scripts は `.agents/deps/<name>/` に置き、prompt から参照する。
- `README.md` を置く。運用上の事情や管理上の設計意図は `.agents/deps/<name>/README.md` に分け、prompt 本体には書かない。
- prompt 本体には起動後の手順と成果物だけを書き、起動前の判断材料は人間向けドキュメントに書く。
- Claude Code は commands ディレクトリを skill としても読むため、`disable-model-invocation: true` を frontmatter に付ける。
- 決定的な処理は `.agents/deps/<name>/scripts/` に落とす。prompt には判断と手順だけを残す。
