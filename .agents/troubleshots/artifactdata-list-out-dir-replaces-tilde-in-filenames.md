# ArtifactData の list で out_dir に保存したファイル名では doc id の `~` が `@` になる

## Symptom

`ArtifactData` の `list` に `out_dir` を付けると、doc id に含まれる `~` が保存先のファイル名では `@` に置き換わる。doc id `personal-task-board~card-x~owner` の文書は `attrs/personal-task-board@card-x@owner.json` に保存される。ファイル名から doc id を復元すると、存在しない doc id を `get`・`set`・`delete` に渡すことになる。

Artifact db 自体は `~` を含む doc id をそのまま受け付け、そのまま返す。

## Workaround

`out_dir` に保存した文書の doc id は、ファイル名ではなくファイルの中身の `id` から読む。

## Why Not Fixed

ファイル名への置き換えは ArtifactData 側の挙動であり、このリポジトリからは変えられない。
