# `~/.claude/projects/` 配下を glob すると `-` 始まりのディレクトリ名がオプションと誤認される

## Symptom

`~/.claude/projects/` はプロジェクトパスの `/` を `-` に置き換えたディレクトリ名 (`-Users-kaito-...`) を使う。
このディレクトリ内で相対 glob すると、展開結果がそのまま `-` 始まりの引数になり、コマンドのオプションと誤認される。

```
$ cd ~/.claude/projects && grep -l "test" */*.jsonl
grep: invalid option -- 'p'
Usage: grep [OPTION]... PATTERNS [FILE]...
```

## Workaround

- `./` を先頭に付けて展開する (`./*/*.jsonl`)。
- または `--` でオプション解釈を止める (`grep -l -- "test" */*.jsonl`)。

## Why Not Fixed

ディレクトリ名の付け方は Claude Code 側の仕様。
