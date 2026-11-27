# Harness ガイドライン

Agent 用の Prompt を書く場合のガイドライン

## 原則

- Agent の Context は限られたリソースであり、必要な指示やコンテキストの読み込みを最適化する
- Progressive Disclosure: 段階的な読み込みを前提に、AGENTS.md, SKILL.md と言った入口のファイルを最小限に保つ
- 冗長な表現の禁止: 重複する内容を表現を変えて繰り返さない。端的で明解な表現を採用する
- プロンプトには読み手を意識し、必要な情報のみを記載する。管理上必要な情報や、制約、建付けといった読み手向けではない情報を記載しない
- 決定論的に解ける処理は、手順の指示ではなくスクリプト化して実行方法のみを書く

## AGENTS.md / CLAUDE.md

- 常に必要になる原則に絞って記載

## skills/playbooks/principles

- 標準化された Skill と同様の内部構造を採用した playbooks/principles を利用する

```
~/.agents/{skills,playbooks,principles}/
  ${name}/
    references/
    scripts/
    {SKILL.md,PLAYBOOK.md,PRINCIPLE.md}
    README.md
```

- SKILL.md, PLAYBOOK.md, PRINCIPLE.md:
  - 個別に必要になる情報は references に分離し、最小限に保つ
  - 読み手向けの指示のみを記載。管理上必要になる情報・背景などは本文ではなく README.md に記載する
- description frontmatter は最小限に保ち「いつ有効にすべきか」の判断を目的として記載。内容をサマライズして肥大化させない。

### Principle

- 小さく単一目的の行動原則。何か・いつ適用するか・すること/しないことを短く書く。description は「〜のときに適用する」の形にする
- 件数が増える前提で、見つける主な手段は `principles search`。Playbook は常に必要なものだけを推奨する
- 手順が主体のものは Principle でなく Playbook にする

### Playbook

- 再現性のある実績のある一連の手順を Playbook として用意する
- タスク進行パターン (worker-advisor、coordinate-task など) も Playbook にする
- frontmatter `principles: [<name>, ...]` で、推奨する Principle を列挙する。`playbooks use` が本文の後ろに全文を続ける。`agent-core verify` が存在しない参照を検出する

## prompts

- `~/.agents/prompts/${name}.md` に置く。frontmatter と短い指示だけを持ち、手順の本体は playbook などに置いて参照する
- 本文の末尾は次のブロックで終える。引数は `$ARGUMENTS` として末尾に 1 回だけ置き、本文の途中では参照しない

```md
---

$ARGUMENTS
```

- `agent-core verify` が末尾のブロックを検査する
