# Claude Code の Bash で作った ~/.claude の symlink がコマンド終了後に消える

## Symptom

Claude Code の `Bash` から `chezmoi apply` を実行し、`~/.claude/CLAUDE.md`・`~/.claude/skills`・`~/.claude/commands` の symlink を作り直すと、`chezmoi verify` は通る。ところが次のコマンドでは 3 つとも消えていて、`chezmoi status` は `DA` を返す。サンドボックスを外して (`dangerouslyDisableSandbox: true`) 実行しても、同じことが起きる。

2026-11 に `~/.agents` を実ディレクトリから symlink に置き換えたとき、リンク先が一時的に無くなった後に起きた。同じコマンドの中では消えず、コマンドが終わった後に消える。`~/.codex`・`~/.commandcode`・`~/.pi` の symlink は消えない。

## Workaround

- Claude Code の外のターミナルで `chezmoi apply ~/.claude/CLAUDE.md ~/.claude/commands ~/.claude/skills` を実行する。
- エージェントは `~/.claude` の symlink を作り直そうとせず、ユーザーに上記の実行を頼む。

## Why Not Fixed

`~/.claude` の配下は Claude Code が自分の設定として保護するパスで、セッション中にエージェントが書いた変更を Claude Code が戻していると見られる。このリポジトリの設定では外せない。
