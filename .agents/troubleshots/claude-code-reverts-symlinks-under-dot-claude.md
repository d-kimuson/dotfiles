# Claude Code の Bash で作った ~/.claude の symlink がコマンド終了後に消える

## Symptom

Claude Code の `Bash` から `chezmoi apply` を実行し、`~/.claude/CLAUDE.md`・`~/.claude/skills`・`~/.claude/commands` の symlink を作り直すと、`chezmoi verify` は通る。ところが次のコマンドでは 3 つとも消えていて、`chezmoi status` は `DA` を返す。サンドボックスを外して (`dangerouslyDisableSandbox: true`) 実行しても、同じことが起きる。

2026-11 に `~/.agents` を実ディレクトリから symlink に置き換えたとき、リンク先が一時的に無くなった後に起きた。同じコマンドの中では消えず、コマンドが終わった後に消える。`~/.codex`・`~/.commandcode`・`~/.pi` の symlink は消えない。

## Workaround

- Claude Code を終了してから、別のターミナルで `chezmoi apply --force ~/.claude/CLAUDE.md ~/.claude/commands ~/.claude/skills` を実行する。
  symlink が消えている間に、Claude Code は `~/.claude/skills/synced/` を実ディレクトリとして作り直す。`--force` を付けないと、chezmoi が置き換えの確認を求める。消える中身は、Claude Code が `~/.agents/skills/synced/` に同期し直す。
- エージェントは `~/.claude` の symlink を作り直そうとせず、ユーザーに上記の実行を頼む。

## Why Not Fixed

`~/.claude` の配下は Claude Code が自分の設定として保護するパスで、セッション中にエージェントが書いた変更を Claude Code が戻していると見られる。このリポジトリの設定では外せない。
