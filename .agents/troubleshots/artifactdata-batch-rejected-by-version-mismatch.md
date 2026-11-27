# ArtifactData の batch が既存文書への delete・set で version_mismatch になる

## Symptom

`ArtifactData` の `batch` に既存文書への `delete` か `set` を含めると、`version_mismatch` で batch 全体が拒否され、どの write も適用されない。Personal Task Board の盤面 (Artifact db の `actions` collection) を掃除したときに起きた。

## Workaround

1. 書き換える collection を `list` (または対象文書を `get`) して、各文書の `version` を読む。
2. 既存文書への `delete`・`set` の各 write に、読んだ `version` を `if_version` として付けてから `batch` を送る。
3. 読んでから送るまでに別のセッションが同じ文書を書くと再び `version_mismatch` になるので、その場合は 1 からやり直す。

## Why Not Fixed

楽観ロックは ArtifactData 側の仕様であり、このリポジトリからは変えられない。
