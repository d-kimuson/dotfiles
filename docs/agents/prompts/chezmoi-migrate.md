# chezmoi-migrate

`chezmoi diff` に出る差分を source state に取り込み、`chezmoi diff` を空にする prompt。本体は `.agents/prompts/chezmoi-migrate.md`。

## いつ使うか

ツールやエージェントが target state (`~/.claude/settings.json` など) を直接書き換え、その変更を残したいときに使う。target state の変更を捨てて source state で上書きしたいときは使わず、`chezmoi apply` を実行する。

## 起動

Claude Code と Pi で `/chezmoi-migrate` と入力する。モデルが自分から起動することはない (`disable-model-invocation: true`)。

## 成果物

source state だけを書き換える。`chezmoi apply` は実行しないので、取り込んだ結果は `chezmoi diff` が空になったことで確かめる。
