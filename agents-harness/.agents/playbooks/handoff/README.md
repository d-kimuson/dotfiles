# Handoff

次のセッションへの引き継ぎファイルを、セッション開始時に作って更新し続ける playbook。個別の prompt ではなく、`~/.agents/AGENTS.md` から全セッションで使う。

- 旧 `~/.agents/prompts/handoff.md` (`/handoff`) の移植。コンテキスト圧迫時に書くのをやめ、開始時に作って都度更新する形にした
- 置き場所は `.agents/handoff.md` 1 つから、セッションごとの `.agents/handoff/<yyyymmddHHMMSS>-<uuid>/index.md` にした。並行するセッションが同じファイルを奪い合わないため
- ID の生成、テンプレートのコピー、Git からの除外は `scripts/new.ts` が行う。除外はプロジェクトの `.gitignore` を変えないよう `.git/info/exclude` に書く

本文: [PLAYBOOK.md](./PLAYBOOK.md)
