# サンドボックス内でリポジトリの .agents/skills/ 配下に書き込めない

## Symptom

Claude Code のサンドボックス内で、このリポジトリの `.agents/skills/` 配下 (`.agents/skills/chezmoi/SKILL.md` など) のファイルを `Bash` (`sed -i`、heredoc、`cp`、`mv`) で書き換えようとすると、次のように失敗する。

```
Operation not permitted
```

`.agents/skills/` は Claude Code 自身が skills の置き場として保護しているパスで、サンドボックスの `denyWithinAllow` に入っている (`~/.agents/skills`、`~/.claude/local-plugins`、`.claude/hooks` なども同様)。リポジトリを書き込み許可に含めていても、このパスだけは拒否される。

## Workaround

- skill の編集は、そのコマンドだけサンドボックスを外して (`dangerouslyDisableSandbox: true`) 実行する。ほかのコマンドはサンドボックス内のまま実行する。
- `Edit`/`Write` ツールで書けるかどうかは、権限設定に依存する。拒否されたら上記に切り替える。

## Why Not Fixed

保護パスは Claude Code の仕様で決まり、このリポジトリの設定では外せない。
