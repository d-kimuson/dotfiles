# Delegate

ユーザーとエージェントの責任の境界と、指示がないときにエージェントがどこまで自律で進めるか。

## 責任の境界

- ユーザーが決めるのは Goal (何をどの範囲まで達成するか)。そこへの進め方はエージェントに任されている。
- 進め方 (SubAgent を使うか、一度にまとめてやるか、どの順で進めるかなど) は、ガイドラインを守る範囲でエージェントが決める。進め方についてユーザーに承認を求めない。
- Goal を勝手に変えない。Scope が大きいと判断して一部を後回しにしたまま完了として報告する、指示された範囲を狭めて終える、などは Goal の変更にあたる。Goal を変えないと達成できないと分かったときだけ、ユーザーに判断を仰ぐ。

## 内部レビュー

実装タスクとして依頼されたら、指示がなくても完了とする前に内部レビューを行う。`docs/guidelines/review/index.md` の表から変更の中身に合うパターンを選び、`review` skill を SubAgent に実行させ、指摘を反映する。指摘が無くなるまで繰り返す。

## 指示がないときの既定

下の節は、指示がないときの既定。指示やコマンド (skill、プロンプト) に書かれていれば、そちらに従う。どちらにも書かれていない操作は、エージェントが判断する。

### やる

- 実機への反映: `chezmoi apply` と `chezmoi verify`、`home-manager switch`、`mise install && mise reshim`、`node internal/src/cli.ts` の `mcp deliver` / `merge-config` / `pi-agent deliver`。反映の結果を検証として使う (AGENTS.md の Feedback Loop、`docs/commands.md`)。ユーザーが反映を明示的に禁止したときは反映しない。
- コミット: 作業の区切りごとにコミットする (`docs/guidelines/commit.md`)。
- `origin/main` への push: Feedback Loop の検証が通ってから push する。
- ブランチ: `main` に直接積むか作業ブランチを切るかは、作業の大きさで決める。
- 外部サービスへの書き込み: GitHub の issue や PR へのコメント、Slack、MCP 経由の外部 API への書き込み。秘密情報の値は送らない (`docs/guidelines/review/index.md` の `Secret Review`)。
- ハーネスの更新: AGENTS.md、`docs/guidelines/`、`.agents/troubleshots/`、skills、prompts の追記と修正 (`docs/guidelines/harness.md`)。変えた箇所をユーザーに報告する。

### 確認してからやる

理由を添えて提案し、承認を得てから実行する。

- ツールと依存の追加・更新: home-manager のパッケージ、mise の CLI とランタイム、`internal/` の npm 依存 (`docs/tool-management.md`、`docs/guidelines/local-dev.md`)。
- 管理している設定・ツールの削除: `chezmoi/` のファイル、home-manager のパッケージ、MCP サーバーなどを管理から外す。反映すると実機から消える。
- 秘密情報の参照の追加・変更: `shell/env-secrets.sh.tpl` や `config/` に置く 1Password の参照 (`op://…`)。値は読まない。

### やらない

明示的に指示されたときだけ行う。

- LLM 利用量の集計のコミット: `observe/llm-usage/aggregate/` の変更はコミットに含めない (`docs/features/llm-usage-observation.md`)。
- 履歴の書き換え: push 済みのコミットの rebase、amend、force push。
